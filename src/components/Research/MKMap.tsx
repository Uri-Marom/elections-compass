import { useState, useMemo } from 'react'
import type { Party, KnessetMember, PartyPosition } from '../../types'
import {
  computeMKAxisMap, computeUserMKPoint,
  MK_DIM_LABELS,
  type MKDimKey,
} from '../../utils/research'

interface Props {
  allPartyPositions: Record<string, PartyPosition[]>
  mks: KnessetMember[]
  mkPositions: Record<string, Record<string, number | null>>
  parties: Party[]
  lang: 'he' | 'en'
  userAnswers?: Record<string, number | null>
}

const SVG_W = 500
const SVG_H = 440
const MARGIN = 126
const PAD_Y = 36
const PARTY_R = 7
const MK_R = 3.5
const LABEL_GAP = 15

const PLOT_X0 = MARGIN
const PLOT_X1 = SVG_W - MARGIN
const LABEL_X_L = MARGIN / 2
const LABEL_X_R = SVG_W - MARGIN / 2

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

const DIMS: MKDimKey[] = ['religion', 'judicial', 'governance']

export function MKMap({ allPartyPositions, mks, mkPositions, parties, lang, userAnswers }: Props) {
  const [xDim, setXDim] = useState<MKDimKey>('religion')
  const [yDim, setYDim] = useState<MKDimKey>('judicial')
  const [hoveredMkId, setHoveredMkId] = useState<string | null>(null)

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
    return { party_id: pt.party_id, color: party?.color ?? '#888',
      name: party ? (lang === 'he' ? party.name_he : party.name_en) : pt.party_id,
      svgX: toSvgX(pt.x), svgY: toSvgY(pt.y) }
  })

  const mkDots = result.mkPoints.map(pt => {
    const mk = mks.find(m => m.id === pt.mk_id)
    const party = parties.find(p => p.id === pt.party_id)
    return { mk_id: pt.mk_id, color: party?.color ?? '#888',
      name: mk ? (lang === 'he' ? mk.name_he : (mk.name_en || mk.name_he)) : pt.mk_id,
      partyName: party ? (lang === 'he' ? party.name_he : party.name_en) : '',
      partyColor: party?.color ?? '#888',
      svgX: toSvgX(pt.x), svgY: toSvgY(pt.y) }
  })

  const midX = (PLOT_X0 + PLOT_X1) / 2
  const leftParties = partyDots.filter(d => d.svgX <= midX)
  const rightParties = partyDots.filter(d => d.svgX > midX)
  const labels: PlacedLabel[] = [
    ...layoutMargin(leftParties, 'left'),
    ...layoutMargin(rightParties, 'right'),
  ]

  const hoveredMk = hoveredMkId ? mkDots.find(d => d.mk_id === hoveredMkId) : null
  const userSvgX = userPoint ? toSvgX(userPoint.x) : null
  const userSvgY = userPoint ? toSvgY(userPoint.y) : null
  const axisColor = '#e4e4e7'
  const axisLabelColor = '#a1a1aa'
  const xL = MK_DIM_LABELS[xDim], yL = MK_DIM_LABELS[yDim]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Axis selectors */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {([['x', xDim, setXDim], ['y', yDim, setYDim]] as const).map(([axis, current, setter]) => (
          <div key={axis}>
            <p style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 4 }}>
              {axis === 'x' ? (lang === 'he' ? 'ציר אופקי' : 'X axis') : (lang === 'he' ? 'ציר אנכי' : 'Y axis')}
            </p>
            <div style={{ display: 'flex', background: '#f4f4f5', borderRadius: 10, padding: 3, gap: 2 }}>
              {DIMS.map(d => (
                <button key={d} onClick={() => setter(d as MKDimKey)}
                  style={{
                    flex: 1, padding: '5px 2px', borderRadius: 7, border: 'none', cursor: 'pointer',
                    fontSize: 10, fontWeight: 600, lineHeight: 1.3,
                    background: current === d ? '#ffffff' : 'transparent',
                    color: current === d ? '#0a0a0a' : '#71717a',
                    boxShadow: current === d ? '0 1px 2px rgba(0,0,0,0.07)' : 'none',
                  }}>
                  {MK_DIM_LABELS[d][lang === 'he' ? 'he' : 'en']}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Hovered MK tooltip */}
      {hoveredMk ? (
        <div style={{
          padding: '8px 12px', background: '#ffffff', borderRadius: 12,
          border: '1px solid #e4e4e7', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0a' }}>{hoveredMk.name}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: hoveredMk.partyColor }}>{hoveredMk.partyName}</span>
        </div>
      ) : (
        <p style={{ fontSize: 11, color: '#a1a1aa' }}>{lang === 'he' ? 'עברו על נקודה לשם הח״כ' : 'Hover a dot to see the MK name'}</p>
      )}

      {/* Map */}
      <div style={{ width: '100%', overflow: 'hidden', borderRadius: 14, border: '1px solid #e4e4e7', background: '#ffffff' }}>
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" style={{ display: 'block' }}>

          {/* Axis lines with gaps at ends for labels */}
          <line x1={PLOT_X0 + 28} y1={SVG_H / 2} x2={PLOT_X1 - 28} y2={SVG_H / 2} stroke={axisColor} strokeWidth={1} />
          <line x1={SVG_W / 2} y1={PAD_Y + 14} x2={SVG_W / 2} y2={SVG_H - PAD_Y - 14} stroke={axisColor} strokeWidth={1} />

          {/* Axis end labels */}
          <text x={PLOT_X0 + 14} y={SVG_H / 2} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill={axisLabelColor} fontWeight={700}>
            {lang === 'he' ? xL.lowHe : xL.lowEn}
          </text>
          <text x={PLOT_X1 - 14} y={SVG_H / 2} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill={axisLabelColor} fontWeight={700}>
            {lang === 'he' ? xL.highHe : xL.highEn}
          </text>
          <text x={SVG_W / 2} y={PAD_Y + 7} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill={axisLabelColor} fontWeight={700}>
            {lang === 'he' ? yL.highHe : yL.highEn}
          </text>
          <text x={SVG_W / 2} y={SVG_H - PAD_Y - 7} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill={axisLabelColor} fontWeight={700}>
            {lang === 'he' ? yL.lowHe : yL.lowEn}
          </text>

          {/* Leader lines */}
          {labels.map((lb, i) => {
            const dx = lb.dotX - lb.labelX, dy = lb.dotY - lb.labelY
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            const endX = lb.dotX - (dx / dist) * (PARTY_R + 2)
            const endY = lb.dotY - (dy / dist) * (PARTY_R + 2)
            const clearance = Math.min(dist * 0.35, 38)
            const startX = lb.labelX + (dx / dist) * clearance
            const startY = lb.labelY + (dy / dist) * clearance
            if (dist < PARTY_R + clearance + 4) return null
            return <line key={`line-${i}`} x1={startX} y1={startY} x2={endX} y2={endY}
              stroke={lb.color} strokeWidth={0.8} strokeOpacity={0.4} />
          })}

          {/* MK dots — rendered below party dots */}
          {mkDots.map(d => {
            const isHov = d.mk_id === hoveredMkId
            return (
              <circle key={d.mk_id}
                cx={d.svgX} cy={d.svgY}
                r={isHov ? MK_R + 2 : MK_R}
                fill={d.color}
                opacity={isHov ? 1 : 0.5}
                stroke={isHov ? '#fff' : 'none'}
                strokeWidth={isHov ? 1.5 : 0}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredMkId(d.mk_id)}
                onMouseLeave={() => setHoveredMkId(null)}
                onTouchStart={() => setHoveredMkId(d.mk_id)}
              />
            )
          })}

          {/* Party dots */}
          {partyDots.map(d => (
            <circle key={d.party_id} cx={d.svgX} cy={d.svgY} r={PARTY_R} fill={d.color} opacity={0.9} />
          ))}

          {/* Party labels */}
          {labels.map((lb, i) => (
            <text key={`label-${i}`}
              x={lb.labelX} y={lb.labelY}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={9} fontWeight={600} fill={lb.color}
              style={{ userSelect: 'none' }}>
              {lb.name}
            </text>
          ))}

          {/* User star */}
          {userSvgX !== null && userSvgY !== null && (
            <g>
              <path d={starPath(userSvgX, userSvgY, 10)} fill="#0891b2" stroke="white" strokeWidth={1.5} />
              <text x={userSvgX} y={userSvgY + 18}
                textAnchor="middle" fontSize={9} fontWeight={700} fill="#0891b2"
                style={{ userSelect: 'none' }}>
                {lang === 'he' ? 'אתם' : 'You'}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11, color: '#a1a1aa' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width={16} height={12} style={{ display: 'inline-block' }}>
            <circle cx={8} cy={6} r={PARTY_R - 1} fill="#888" opacity={0.9} />
          </svg>
          {lang === 'he' ? 'מפלגה' : 'Party'}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width={16} height={12} style={{ display: 'inline-block' }}>
            <circle cx={8} cy={6} r={MK_R} fill="#888" opacity={0.5} />
          </svg>
          {lang === 'he' ? 'ח"כ' : 'MK'}
        </span>
      </div>
    </div>
  )
}
