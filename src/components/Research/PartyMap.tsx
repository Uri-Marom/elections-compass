import { useTranslation } from 'react-i18next'
import type { PartyPoint } from '../../utils/research'
import type { Party } from '../../types'
import { TOTAL_QUESTIONS } from '../../utils/matching'
import { B, ACCENT, CompassWatermarkSVG } from '../bureau/BureauComponents'

interface Props {
  points: PartyPoint[]
  parties: Party[]
  mode: 'stated' | 'voted'
  onModeChange: (m: 'stated' | 'voted') => void
  lang: 'he' | 'en'
  userPoint?: { x: number; y: number } | null
  friendPoint?: { x: number; y: number } | null
}

const SVG_W = 500
const SVG_H = 460
const MARGIN = 100
const PAD_Y = 36
const DOT_R = 7
const LABEL_GAP = 15
const FONT = "'Heebo', 'Rubik', system-ui, sans-serif"
const FRIEND_COLOR = '#9333ea'
const LINE_LABEL_CLEAR = 10

const PLOT_X0 = MARGIN
const PLOT_X1 = SVG_W - MARGIN
const LABEL_X_L = MARGIN / 2
const LABEL_X_R = SVG_W - MARGIN / 2

function toSvgX(x: number) { return PLOT_X0 + ((x + 1) / 2) * (PLOT_X1 - PLOT_X0) }
function toSvgY(y: number) { return PAD_Y + ((1 - y) / 2) * (SVG_H - PAD_Y * 2) }

function starPath(cx: number, cy: number, r: number, n = 5): string {
  const pts: string[] = []
  for (let i = 0; i < n * 2; i++) {
    const angle = (Math.PI / n) * i - Math.PI / 2
    const radius = i % 2 === 0 ? r : r * 0.42
    pts.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`)
  }
  return `M${pts.join('L')}Z`
}

function segToPointDist(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(px - ax, py - ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

interface DotItem { svgX: number; svgY: number; name: string; color: string; party_id: string }
interface PlacedLabel { labelX: number; labelY: number; name: string; color: string; dotX: number; dotY: number; side: 'left' | 'right' }

function layoutMargin(items: DotItem[], side: 'left' | 'right'): PlacedLabel[] {
  if (items.length === 0) return []
  const minY = PAD_Y + 4, maxY = SVG_H - PAD_Y - 4
  const sorted = [...items].sort((a, b) => a.svgY - b.svgY)
  const ys = sorted.map(e => Math.max(minY, Math.min(maxY, e.svgY)))
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
  return sorted.map((e, i) => ({
    labelX, labelY: ys[i], name: e.name, color: e.color, dotX: e.svgX, dotY: e.svgY, side,
  }))
}

export function PartyMap({ points, parties, mode, onModeChange, lang, userPoint, friendPoint }: Props) {
  const { t } = useTranslation()

  const dots = points.map(pt => {
    const party = parties.find(p => p.id === pt.party_id)
    return {
      party_id: pt.party_id,
      color: party?.color ?? '#888',
      name: party ? (lang === 'he' ? party.name_he : party.name_en) : pt.party_id,
      svgX: toSvgX(pt.x),
      svgY: toSvgY(pt.y),
    }
  })

  const leftDots  = dots.filter(d => d.svgX <= (PLOT_X0 + PLOT_X1) / 2)
  const rightDots = dots.filter(d => d.svgX >  (PLOT_X0 + PLOT_X1) / 2)
  const labels: PlacedLabel[] = [
    ...layoutMargin(leftDots,  'left'),
    ...layoutMargin(rightDots, 'right'),
  ]

  const userSvgX  = userPoint   ? toSvgX(userPoint.x)   : null
  const userSvgY  = userPoint   ? toSvgY(userPoint.y)   : null
  const friendSvgX = friendPoint ? toSvgX(friendPoint.x) : null
  const friendSvgY = friendPoint ? toSvgY(friendPoint.y) : null

  const cx = SVG_W / 2, cy = SVG_H / 2

  return (
    <div>
      {/* Mode toggle */}
      <div style={{ display: 'flex', background: B.bgMid, borderRadius: B.radius, padding: 4, gap: 4, marginBottom: 14 }}>
        {(['stated', 'voted'] as const).map(m => (
          <button key={m} onClick={() => onModeChange(m)} style={{
            flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, fontFamily: B.font,
            background: mode === m ? B.white : 'transparent',
            color: mode === m ? B.ink : B.inkFaint,
            boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
          }}>
            {m === 'stated' ? t('stated_positions') : t('actual_votes')}
          </button>
        ))}
      </div>

      <p style={{ fontSize: 11, color: B.inkHint, marginBottom: 12, lineHeight: 1.55, fontFamily: B.font }}>
        {t('similarity_subtitle', { total: TOTAL_QUESTIONS })}
      </p>

      {/* Map */}
      <div style={{ width: '100%', overflow: 'hidden', borderRadius: B.radiusLg, background: B.ink }}>
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" style={{ display: 'block' }}>
          <defs>
            <pattern id="pm-grid" x="0" y="0" width="18" height="18" patternUnits="userSpaceOnUse">
              <circle cx="9" cy="9" r="0.5" fill="white" />
            </pattern>
            <radialGradient id="pm-glow" cx="50%" cy="50%" r="40%">
              <stop offset="0%" stopColor="white" stopOpacity="0.025" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>

          {/* Background layers */}
          <rect width={SVG_W} height={SVG_H} fill={B.ink} />
          <rect width={SVG_W} height={SVG_H} fill="url(#pm-grid)" opacity="0.3" />
          <rect width={SVG_W} height={SVG_H} fill="url(#pm-glow)" />

          {/* Compass rose — the map's visual anchor */}
          <CompassWatermarkSVG cx={cx} cy={cy} size={300} opacity={0.1} />

          {/* Full-bleed axis lines */}
          <line x1={0} y1={cy} x2={SVG_W} y2={cy} stroke="white" strokeWidth={0.7} opacity={0.1} strokeDasharray="5 8" />
          <line x1={cx} y1={0} x2={cx} y2={SVG_H} stroke="white" strokeWidth={0.7} opacity={0.1} strokeDasharray="5 8" />

          {/* Axis labels at the four cardinal edges */}
          <text x={8} y={cy - 7} textAnchor="start" dominantBaseline="auto"
            fontSize={9} fill="white" fillOpacity={0.35} fontWeight={700}
            fontFamily="ui-monospace, monospace" letterSpacing="0.06em">
            {t('map_axis_left')}
          </text>
          <text x={SVG_W - 8} y={cy - 7} textAnchor="end" dominantBaseline="auto"
            fontSize={9} fill="white" fillOpacity={0.35} fontWeight={700}
            fontFamily="ui-monospace, monospace" letterSpacing="0.06em">
            {t('map_axis_right')}
          </text>
          <text x={cx} y={12} textAnchor="middle" dominantBaseline="auto"
            fontSize={9} fill="white" fillOpacity={0.35} fontWeight={700}
            fontFamily="ui-monospace, monospace" letterSpacing="0.06em">
            {t('map_axis_religious')}
          </text>
          <text x={cx} y={SVG_H - 5} textAnchor="middle" dominantBaseline="auto"
            fontSize={9} fill="white" fillOpacity={0.35} fontWeight={700}
            fontFamily="ui-monospace, monospace" letterSpacing="0.06em">
            {t('map_axis_secular')}
          </text>

          {/* Leader lines */}
          {labels.map((lb, i) => {
            const dx = lb.dotX - lb.labelX, dy = lb.dotY - lb.labelY
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            const endX = lb.dotX - (dx / dist) * (DOT_R + 2)
            const endY = lb.dotY - (dy / dist) * (DOT_R + 2)
            const clearance = Math.min(dist * 0.35, 36)
            const startX = lb.labelX + (dx / dist) * clearance
            const startY = lb.labelY + (dy / dist) * clearance
            if (dist < DOT_R + clearance + 4) return null
            const blocked = labels.some((other, j) => {
              if (j === i) return false
              return segToPointDist(startX, startY, endX, endY, other.labelX, other.labelY) < LINE_LABEL_CLEAR
            })
            if (blocked) return null
            return <line key={`line-${i}`} x1={startX} y1={startY} x2={endX} y2={endY}
              stroke={lb.color} strokeWidth={0.8} strokeOpacity={0.45} />
          })}

          {/* Party dots — glow + fill */}
          {dots.map(d => (
            <g key={d.party_id}>
              <circle cx={d.svgX} cy={d.svgY} r={DOT_R + 7} fill={d.color} opacity={0.12} />
              <circle cx={d.svgX} cy={d.svgY} r={DOT_R + 3} fill={d.color} opacity={0.1} />
              <circle cx={d.svgX} cy={d.svgY} r={DOT_R} fill={d.color} stroke="rgba(255,255,255,0.22)" strokeWidth={1} />
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

          {/* Friend star */}
          {friendSvgX !== null && friendSvgY !== null && (
            <g>
              <circle cx={friendSvgX} cy={friendSvgY} r={22} fill={FRIEND_COLOR} opacity={0.12} />
              <circle cx={friendSvgX} cy={friendSvgY} r={14} fill={FRIEND_COLOR} opacity={0.1} />
              <path d={starPath(friendSvgX, friendSvgY, 11)} fill={FRIEND_COLOR} stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} />
              <text x={friendSvgX} y={friendSvgY + 21}
                textAnchor="middle" fontSize={9} fontWeight={700} fill={FRIEND_COLOR} fontFamily={FONT}
                style={{ userSelect: 'none' }}>
                {lang === 'he' ? 'חבר/ה' : 'Friend'}
              </text>
            </g>
          )}

          {/* User star */}
          {userSvgX !== null && userSvgY !== null && (
            <g>
              <circle cx={userSvgX} cy={userSvgY} r={22} fill={ACCENT} opacity={0.15} />
              <circle cx={userSvgX} cy={userSvgY} r={14} fill={ACCENT} opacity={0.12} />
              <path d={starPath(userSvgX, userSvgY, 11)} fill={ACCENT} stroke="rgba(255,255,255,0.6)" strokeWidth={1.5} />
              <text x={userSvgX} y={userSvgY + 21}
                textAnchor="middle" fontSize={9} fontWeight={700} fill={ACCENT} fontFamily={FONT}
                style={{ userSelect: 'none' }}>
                {lang === 'he' ? 'אתם' : 'You'}
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  )
}
