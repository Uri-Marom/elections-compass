import { useState, useMemo } from 'react'
import type { Party, KnessetMember, PartyPosition } from '../../types'
import {
  computeMKAxisMap, computeUserMKPoint,
  MK_DIM_LABELS,
  type MKDimKey,
} from '../../utils/research'
import { B, ACCENT, DIM_COLOR, CompassWatermarkSVG } from '../bureau/BureauComponents'

interface Props {
  allPartyPositions: Record<string, PartyPosition[]>
  mks: KnessetMember[]
  mkPositions: Record<string, Record<string, number | null>>
  parties: Party[]
  lang: 'he' | 'en'
  userAnswers?: Record<string, number | null>
}

const SVG_W = 500
const SVG_H = 460
const MARGIN = 100
const PAD_Y = 36
const PARTY_R = 7
const MK_R = 3.5
const LABEL_GAP = 15
const FONT = "'Heebo', 'Rubik', system-ui, sans-serif"

const PLOT_X0 = MARGIN
const PLOT_X1 = SVG_W - MARGIN
const LABEL_X_L = MARGIN / 2
const LABEL_X_R = SVG_W - MARGIN / 2

const DIMS: MKDimKey[] = ['religion', 'judicial', 'governance']
const DIM_TO_KEY: Record<MKDimKey, string> = {
  religion: 'religion', judicial: 'judicial', governance: 'governance',
}

// Lighten colors that are too dark to read on the dark map background
function forDark(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  if (lum < 0.28) {
    const f = 1 - lum / 0.28
    return `rgb(${Math.round(r + (220 - r) * f)},${Math.round(g + (220 - g) * f)},${Math.round(b + (220 - b) * f)})`
  }
  return hex
}

function toSvgX(x: number) { return PLOT_X0 + ((x + 1) / 2) * (PLOT_X1 - PLOT_X0) }
function toSvgY(y: number) { return PAD_Y + ((1 - y) / 2) * (SVG_H - PAD_Y * 2) }

function starPath(cx: number, cy: number, r: number): string {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2
    const radius = i % 2 === 0 ? r : r * 0.42
    pts.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`)
  }
  return `M${pts.join('L')}Z`
}

interface LabelItem { svgX: number; svgY: number; name: string; color: string }
interface PlacedLabel { labelX: number; labelY: number; name: string; color: string; dotX: number; dotY: number; side: 'left' | 'right' }

function layoutMargin(items: LabelItem[], side: 'left' | 'right'): PlacedLabel[] {
  if (!items.length) return []
  const minY = PAD_Y + 4, maxY = SVG_H - PAD_Y - 4
  const sorted = [...items].sort((a, b) => a.svgY - b.svgY)
  const ys = sorted.map(d => Math.max(minY, Math.min(maxY, d.svgY)))
  for (let i = 1; i < ys.length; i++) {
    if (ys[i] < ys[i - 1] + LABEL_GAP) ys[i] = ys[i - 1] + LABEL_GAP
  }
  if (ys[ys.length - 1] > maxY) {
    ys[ys.length - 1] = maxY
    for (let i = ys.length - 2; i >= 0; i--) {
      if (ys[i] > ys[i + 1] - LABEL_GAP) ys[i] = ys[i + 1] - LABEL_GAP
    }
  }
  const labelX = side === 'left' ? LABEL_X_L : LABEL_X_R
  return sorted.map((d, i) => ({ labelX, labelY: ys[i], name: d.name, color: d.color, dotX: d.svgX, dotY: d.svgY, side }))
}

export function MKMap({ allPartyPositions, mks, mkPositions, parties, lang, userAnswers }: Props) {
  const [xDim, setXDim] = useState<MKDimKey>('religion')
  const [yDim, setYDim] = useState<MKDimKey>('judicial')

  const result = useMemo(
    () => computeMKAxisMap(allPartyPositions, mks, mkPositions, xDim, yDim),
    [xDim, yDim] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const userPoint = useMemo(
    () => userAnswers ? computeUserMKPoint(userAnswers, result) : null,
    [userAnswers, result]
  )

  const partyDots = result.partyPoints.map(pt => {
    const party = parties.find(p => p.id === pt.party_id)
    return {
      party_id: pt.party_id, color: forDark(party?.color ?? '#888'),
      name: party ? (lang === 'he' ? party.name_he : party.name_en) : pt.party_id,
      svgX: toSvgX(pt.x), svgY: toSvgY(pt.y),
    }
  })

  const mkDots = result.mkPoints.map(pt => {
    const party = parties.find(p => p.id === pt.party_id)
    return {
      mk_id: pt.mk_id, color: forDark(party?.color ?? '#888'),
      svgX: toSvgX(pt.x), svgY: toSvgY(pt.y),
    }
  })

  const midX = (PLOT_X0 + PLOT_X1) / 2
  const labels: PlacedLabel[] = [
    ...layoutMargin(partyDots.filter(d => d.svgX <= midX), 'left'),
    ...layoutMargin(partyDots.filter(d => d.svgX > midX),  'right'),
  ]

  const userSvgX = userPoint ? toSvgX(userPoint.x) : null
  const userSvgY = userPoint ? toSvgY(userPoint.y) : null
  const xL = MK_DIM_LABELS[xDim], yL = MK_DIM_LABELS[yDim]
  const cx = SVG_W / 2, cy = SVG_H / 2

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontFamily: B.font }}>

      {/* Axis selectors */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {([['x', xDim, setXDim], ['y', yDim, setYDim]] as const).map(([axis, current, setter]) => (
          <div key={axis}>
            <p style={{
              fontSize: 10, color: B.inkHint, marginBottom: 4,
              fontFamily: 'ui-monospace, monospace', letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              {axis === 'x' ? (lang === 'he' ? 'ציר אופקי' : 'X axis') : (lang === 'he' ? 'ציר אנכי' : 'Y axis')}
            </p>
            <div style={{ display: 'flex', background: B.bgMid, borderRadius: B.radius, padding: 3, gap: 2 }}>
              {DIMS.map(d => {
                const isSel = current === d
                const dimColor = DIM_COLOR[DIM_TO_KEY[d]] ?? ACCENT
                return (
                  <button key={d} onClick={() => setter(d as MKDimKey)} style={{
                    flex: 1, padding: '6px 2px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    fontSize: 10, fontWeight: 700, lineHeight: 1.3, fontFamily: B.font,
                    background: isSel ? B.white : 'transparent',
                    color: isSel ? dimColor : B.inkFaint,
                    boxShadow: isSel ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  }}>
                    {MK_DIM_LABELS[d][lang === 'he' ? 'he' : 'en']}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Map */}
      <div style={{ width: '100%', overflow: 'hidden', borderRadius: B.radiusLg, background: B.ink }}>
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" style={{ display: 'block' }}>
          <defs>
            <pattern id="mk-grid" x="0" y="0" width="18" height="18" patternUnits="userSpaceOnUse">
              <circle cx="9" cy="9" r="0.5" fill="white" />
            </pattern>
            <radialGradient id="mk-glow" cx="50%" cy="50%" r="40%">
              <stop offset="0%" stopColor="white" stopOpacity="0.025" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>

          {/* Background layers */}
          <rect width={SVG_W} height={SVG_H} fill={B.ink} />
          <rect width={SVG_W} height={SVG_H} fill="url(#mk-grid)" opacity="0.3" />
          <rect width={SVG_W} height={SVG_H} fill="url(#mk-glow)" />

          {/* Compass rose watermark */}
          <CompassWatermarkSVG cx={cx} cy={cy} size={300} opacity={0.1} />

          {/* Full-bleed axis lines */}
          <line x1={0} y1={cy} x2={SVG_W} y2={cy} stroke="white" strokeWidth={0.7} opacity={0.1} strokeDasharray="5 8" />
          <line x1={cx} y1={0} x2={cx} y2={SVG_H} stroke="white" strokeWidth={0.7} opacity={0.1} strokeDasharray="5 8" />

          {/* Axis labels — inside the plot area to avoid clipping */}
          <text x={PLOT_X0 + 6} y={cy - 9} textAnchor="start" fontSize={9} fill="white" fillOpacity={0.4}
            fontWeight={700} fontFamily="ui-monospace, monospace" letterSpacing="0.05em">
            {lang === 'he' ? xL.lowHe : xL.lowEn}
          </text>
          <text x={PLOT_X1 - 6} y={cy - 9} textAnchor="end" fontSize={9} fill="white" fillOpacity={0.4}
            fontWeight={700} fontFamily="ui-monospace, monospace" letterSpacing="0.05em">
            {lang === 'he' ? xL.highHe : xL.highEn}
          </text>
          <text x={cx} y={PAD_Y + 8} textAnchor="middle" fontSize={9} fill="white" fillOpacity={0.4}
            fontWeight={700} fontFamily="ui-monospace, monospace" letterSpacing="0.05em">
            {lang === 'he' ? yL.highHe : yL.highEn}
          </text>
          <text x={cx} y={SVG_H - PAD_Y - 6} textAnchor="middle" fontSize={9} fill="white" fillOpacity={0.4}
            fontWeight={700} fontFamily="ui-monospace, monospace" letterSpacing="0.05em">
            {lang === 'he' ? yL.lowHe : yL.lowEn}
          </text>

          {/* Leader lines */}
          {labels.map((lb, i) => {
            const dx = lb.dotX - lb.labelX, dy = lb.dotY - lb.labelY
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            const endX = lb.dotX - (dx / dist) * (PARTY_R + 2)
            const endY = lb.dotY - (dy / dist) * (PARTY_R + 2)
            const clearance = Math.min(dist * 0.35, 36)
            const startX = lb.labelX + (dx / dist) * clearance
            const startY = lb.labelY + (dy / dist) * clearance
            if (dist < PARTY_R + clearance + 4) return null
            return <line key={`line-${i}`} x1={startX} y1={startY} x2={endX} y2={endY}
              stroke={lb.color} strokeWidth={0.8} strokeOpacity={0.4} />
          })}

          {/* MK dots */}
          {mkDots.map(d => (
            <circle key={d.mk_id}
              cx={d.svgX} cy={d.svgY}
              r={MK_R}
              fill={d.color}
              opacity={0.5}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={0.5}
            />
          ))}

          {/* Party dots — larger, glow */}
          {partyDots.map(d => (
            <g key={d.party_id}>
              <circle cx={d.svgX} cy={d.svgY} r={PARTY_R + 7} fill={d.color} opacity={0.12} />
              <circle cx={d.svgX} cy={d.svgY} r={PARTY_R + 3} fill={d.color} opacity={0.1} />
              <circle cx={d.svgX} cy={d.svgY} r={PARTY_R} fill={d.color} stroke="rgba(255,255,255,0.22)" strokeWidth={1} />
            </g>
          ))}

          {/* Party labels */}
          {labels.map((lb, i) => (
            <text key={`label-${i}`}
              x={lb.labelX} y={lb.labelY}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={9} fontWeight={700} fill={lb.color} fontFamily={FONT}
              style={{ userSelect: 'none' }}>
              {lb.name}
            </text>
          ))}

          {/* User star */}
          {userSvgX !== null && userSvgY !== null && (
            <g>
              <circle cx={userSvgX} cy={userSvgY} r={22} fill={ACCENT} opacity={0.15} />
              <circle cx={userSvgX} cy={userSvgY} r={14} fill={ACCENT} opacity={0.12} />
              <path d={starPath(userSvgX, userSvgY, 10)} fill={ACCENT} stroke="rgba(255,255,255,0.6)" strokeWidth={1.5} />
              <text x={userSvgX} y={userSvgY + 20}
                textAnchor="middle" fontSize={9} fontWeight={700} fill={ACCENT} fontFamily={FONT}
                style={{ userSelect: 'none' }}>
                {lang === 'he' ? 'אתם' : 'You'}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11, color: B.inkHint }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width={16} height={12} style={{ display: 'inline-block' }}>
            <circle cx={8} cy={6} r={PARTY_R - 1} fill={B.inkFaint} />
          </svg>
          {lang === 'he' ? 'מפלגה' : 'Party'}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width={16} height={12} style={{ display: 'inline-block' }}>
            <circle cx={8} cy={6} r={MK_R} fill={B.inkFaint} opacity={0.5} />
          </svg>
          {lang === 'he' ? 'ח"כ' : 'MK'}
        </span>
        {userAnswers && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width={16} height={12} style={{ display: 'inline-block' }}>
              <path d={starPath(8, 6, 6)} fill={ACCENT} />
            </svg>
            {lang === 'he' ? 'אתם' : 'You'}
          </span>
        )}
      </div>
    </div>
  )
}
