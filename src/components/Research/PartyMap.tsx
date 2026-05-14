import { useTranslation } from 'react-i18next'
import type { PartyPoint } from '../../utils/research'
import type { Party } from '../../types'
import { TOTAL_QUESTIONS } from '../../utils/matching'
import { B, ACCENT } from '../bureau/BureauComponents'

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
const MARGIN = 126
const PAD_Y = 44
const DOT_R = 7
const LABEL_GAP = 15

const PLOT_X0 = MARGIN
const PLOT_X1 = SVG_W - MARGIN
const LABEL_X_L = MARGIN / 2
const LABEL_X_R = SVG_W - MARGIN / 2

const AXIS_LABEL_Y_CENTER = SVG_H / 2
const AXIS_LABEL_TOP_Y    = PAD_Y - 22
const AXIS_LABEL_BOT_Y    = SVG_H - PAD_Y + 22

const LINE_LABEL_CLEAR = 10
const FONT = "'Heebo', 'Rubik', system-ui, sans-serif"

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

function layoutMargin(items: DotItem[], side: 'left' | 'right', reservedYs: number[] = []): PlacedLabel[] {
  if (items.length === 0) return []
  const minY = PAD_Y + 4, maxY = SVG_H - PAD_Y - 4
  type Entry = { svgY: number; phantom?: true; idx?: number }
  const entries: Entry[] = [
    ...items.map((d, i) => ({ svgY: d.svgY, idx: i })),
    ...reservedYs.map(y => ({ svgY: y, phantom: true as true })),
  ]
  const sorted = [...entries].sort((a, b) => a.svgY - b.svgY)
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
  return sorted
    .map((e, i) => ({ e, y: ys[i] }))
    .filter(({ e }) => e.phantom !== true)
    .map(({ e, y }) => {
      const item = items[e.idx!]
      return { labelX, labelY: y, name: item.name, color: item.color, dotX: item.svgX, dotY: item.svgY, side }
    })
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
    ...layoutMargin(leftDots,  'left',  [AXIS_LABEL_Y_CENTER]),
    ...layoutMargin(rightDots, 'right', [AXIS_LABEL_Y_CENTER]),
  ]

  const userSvgX = userPoint ? toSvgX(userPoint.x) : null
  const userSvgY = userPoint ? toSvgY(userPoint.y) : null
  const friendSvgX = friendPoint ? toSvgX(friendPoint.x) : null
  const friendSvgY = friendPoint ? toSvgY(friendPoint.y) : null

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
      <div style={{
        width: '100%', overflow: 'hidden',
        borderRadius: B.radiusLg, border: `1px solid ${B.border}`,
        background: B.bg,
      }}>
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" style={{ display: 'block' }}>
          <defs>
            <pattern id="pm-dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="10" cy="10" r="0.55" fill={B.ink} opacity="0.12" />
            </pattern>
          </defs>

          {/* Full background */}
          <rect width={SVG_W} height={SVG_H} fill={B.bg} />
          {/* Dot-grid on margins only */}
          <rect x={0} y={0} width={PLOT_X0} height={SVG_H} fill="url(#pm-dots)" />
          <rect x={PLOT_X1} y={0} width={SVG_W - PLOT_X1} height={SVG_H} fill="url(#pm-dots)" />

          {/* Plot area — white with border */}
          <rect
            x={PLOT_X0} y={PAD_Y}
            width={PLOT_X1 - PLOT_X0} height={SVG_H - PAD_Y * 2}
            fill={B.white} rx={4}
            stroke={B.border} strokeWidth={0.8}
          />

          {/* Axis lines */}
          <line x1={PLOT_X0} y1={SVG_H / 2} x2={PLOT_X1} y2={SVG_H / 2} stroke={B.borderMid} strokeWidth={1} strokeDasharray="4 4" />
          <line x1={SVG_W / 2} y1={PAD_Y} x2={SVG_W / 2} y2={SVG_H - PAD_Y} stroke={B.borderMid} strokeWidth={1} strokeDasharray="4 4" />

          {/* Axis labels */}
          <text x={LABEL_X_L} y={AXIS_LABEL_Y_CENTER} textAnchor="middle" dominantBaseline="middle"
            fontSize={10} fill={B.inkHint} fontWeight={700} fontFamily="ui-monospace, monospace"
            letterSpacing="0.04em">{t('map_axis_left')}</text>
          <text x={LABEL_X_R} y={AXIS_LABEL_Y_CENTER} textAnchor="middle" dominantBaseline="middle"
            fontSize={10} fill={B.inkHint} fontWeight={700} fontFamily="ui-monospace, monospace"
            letterSpacing="0.04em">{t('map_axis_right')}</text>
          <text x={SVG_W / 2} y={AXIS_LABEL_TOP_Y} textAnchor="middle" dominantBaseline="middle"
            fontSize={10} fill={B.inkHint} fontWeight={700} fontFamily="ui-monospace, monospace"
            letterSpacing="0.04em">{t('map_axis_religious')}</text>
          <text x={SVG_W / 2} y={AXIS_LABEL_BOT_Y} textAnchor="middle" dominantBaseline="middle"
            fontSize={10} fill={B.inkHint} fontWeight={700} fontFamily="ui-monospace, monospace"
            letterSpacing="0.04em">{t('map_axis_secular')}</text>

          {/* Leader lines */}
          {labels.map((lb, i) => {
            const dx = lb.dotX - lb.labelX, dy = lb.dotY - lb.labelY
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            const endX = lb.dotX - (dx / dist) * (DOT_R + 2)
            const endY = lb.dotY - (dy / dist) * (DOT_R + 2)
            const clearance = Math.min(dist * 0.35, 38)
            const startX = lb.labelX + (dx / dist) * clearance
            const startY = lb.labelY + (dy / dist) * clearance
            if (dist < DOT_R + clearance + 4) return null
            const blocked = labels.some((other, j) => {
              if (j === i) return false
              return segToPointDist(startX, startY, endX, endY, other.labelX, other.labelY) < LINE_LABEL_CLEAR
            })
            if (blocked) return null
            return <line key={`line-${i}`} x1={startX} y1={startY} x2={endX} y2={endY}
              stroke={lb.color} strokeWidth={0.8} strokeOpacity={0.5} />
          })}

          {/* Party dots */}
          {dots.map(d => (
            <g key={d.party_id}>
              <title>{d.name}</title>
              <circle cx={d.svgX} cy={d.svgY} r={DOT_R + 2} fill={B.white} opacity={0.6} />
              <circle cx={d.svgX} cy={d.svgY} r={DOT_R} fill={d.color} />
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
              <title>{lang === 'he' ? 'אתם' : 'You'}</title>
              <circle cx={userSvgX} cy={userSvgY} r={16} fill={ACCENT} opacity={0.1} />
              <path d={starPath(userSvgX, userSvgY, 11)} fill={ACCENT} stroke={B.white} strokeWidth={1.5} />
              <text x={userSvgX} y={userSvgY + 21}
                textAnchor="middle" fontSize={9} fontWeight={700} fill={ACCENT} fontFamily={FONT}
                style={{ userSelect: 'none' }}>
                {lang === 'he' ? 'אתם' : 'You'}
              </text>
            </g>
          )}

          {/* Friend star */}
          {friendSvgX !== null && friendSvgY !== null && (
            <g>
              <title>{lang === 'he' ? 'חבר/ה' : 'Friend'}</title>
              <circle cx={friendSvgX} cy={friendSvgY} r={16} fill="#9333ea" opacity={0.08} />
              <path d={starPath(friendSvgX, friendSvgY, 11)} fill="#9333ea" stroke={B.white} strokeWidth={1.5} />
              <text x={friendSvgX} y={friendSvgY + 21}
                textAnchor="middle" fontSize={9} fontWeight={700} fill="#9333ea" fontFamily={FONT}
                style={{ userSelect: 'none' }}>
                {lang === 'he' ? 'חבר/ה' : 'Friend'}
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  )
}
