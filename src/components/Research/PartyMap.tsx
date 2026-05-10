import { useTranslation } from 'react-i18next'
import type { PartyPoint } from '../../utils/research'
import type { Party } from '../../types'
import { TOTAL_QUESTIONS } from '../../utils/matching'

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
const SVG_H = 440
const MARGIN = 126       // left/right margin reserved for labels
const PAD_Y = 36
const DOT_R = 7
const LABEL_GAP = 15    // minimum vertical spacing between labels in a margin

const PLOT_X0 = MARGIN
const PLOT_X1 = SVG_W - MARGIN
const LABEL_X_L = MARGIN / 2          // centre of left margin  = 63
const LABEL_X_R = SVG_W - MARGIN / 2  // centre of right margin = 437

// Axis label positions — all placed OUTSIDE the plot area so no dot or connector line can reach them
const AXIS_LABEL_Y_CENTER = SVG_H / 2  // L/R labels: in the margin columns at vertical centre
const AXIS_LABEL_TOP_Y    = PAD_Y - 18 // above the plot (plot starts at PAD_Y=36, dots at ≥43)
const AXIS_LABEL_BOT_Y    = SVG_H - PAD_Y + 18 // below the plot

// Min distance (px) from a connector segment to any OTHER label centre before the line is suppressed
const LINE_LABEL_CLEAR = 10

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

/** Shortest distance from point (px,py) to segment (ax,ay)→(bx,by) */
function segToPointDist(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(px - ax, py - ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

interface DotItem { svgX: number; svgY: number; name: string; color: string; party_id: string }
interface PlacedLabel {
  labelX: number; labelY: number
  name: string; color: string
  dotX: number; dotY: number
  side: 'left' | 'right'
}

/**
 * Layout labels in one margin column.
 * reservedYs: y positions that must be kept clear (e.g. the axis label at SVG_H/2).
 */
function layoutMargin(items: DotItem[], side: 'left' | 'right', reservedYs: number[] = []): PlacedLabel[] {
  if (items.length === 0) return []
  const minY = PAD_Y + 4
  const maxY = SVG_H - PAD_Y - 4

  // Insert phantom entries at reserved positions so the spacing pass treats them as occupied slots.
  type Entry = { svgY: number; phantom?: true; idx?: number }
  const entries: Entry[] = [
    ...items.map((d, i) => ({ svgY: d.svgY, idx: i })),
    ...reservedYs.map(y => ({ svgY: y, phantom: true as true })),
  ]
  const sorted = [...entries].sort((a, b) => a.svgY - b.svgY)
  const ys = sorted.map(e => Math.max(minY, Math.min(maxY, e.svgY)))

  // push down
  for (let i = 1; i < ys.length; i++) {
    if (ys[i] < ys[i - 1] + LABEL_GAP) ys[i] = ys[i - 1] + LABEL_GAP
  }
  // slide up if overflowed
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
      return {
        labelX,
        labelY: y,
        name: item.name,
        color: item.color,
        dotX: item.svgX,
        dotY: item.svgY,
        side,
      }
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

  // Split by which half of the plot the dot lands in
  const leftDots  = dots.filter(d => d.svgX <= (PLOT_X0 + PLOT_X1) / 2)
  const rightDots = dots.filter(d => d.svgX >  (PLOT_X0 + PLOT_X1) / 2)

  // Reserve the vertical centre in both margin columns (where the L/R axis labels sit)
  const labels: PlacedLabel[] = [
    ...layoutMargin(leftDots,  'left',  [AXIS_LABEL_Y_CENTER]),
    ...layoutMargin(rightDots, 'right', [AXIS_LABEL_Y_CENTER]),
  ]

  const axisColor = '#e5e7eb'
  const axisLabelColor = '#9ca3af'

  const userSvgX = userPoint ? toSvgX(userPoint.x) : null
  const userSvgY = userPoint ? toSvgY(userPoint.y) : null
  const friendSvgX = friendPoint ? toSvgX(friendPoint.x) : null
  const friendSvgY = friendPoint ? toSvgY(friendPoint.y) : null

  return (
    <div>
      {/* Mode toggle */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1 mb-4">
        {(['stated', 'voted'] as const).map(m => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className={[
              'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
              mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            {m === 'stated' ? t('stated_positions') : t('actual_votes')}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-400 mb-3 leading-relaxed">{t('similarity_subtitle', { total: TOTAL_QUESTIONS })}</p>

      <div className="w-full overflow-hidden rounded-xl border border-gray-100 bg-white">
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" style={{ display: 'block' }}>

          {/* Axis lines — full width/height, no gap needed since labels are outside the plot area */}
          <line x1={PLOT_X0} y1={SVG_H / 2} x2={PLOT_X1} y2={SVG_H / 2} stroke={axisColor} strokeWidth={1} />
          <line x1={SVG_W / 2} y1={PAD_Y} x2={SVG_W / 2} y2={SVG_H - PAD_Y} stroke={axisColor} strokeWidth={1} />

          {/* Axis labels — L/R in the margin columns (connector lines start there, so they can't cross these)
              Top/Bottom above/below plot boundary (outside any dot or connector-line y-range) */}
          <text x={LABEL_X_L} y={AXIS_LABEL_Y_CENTER} textAnchor="middle" dominantBaseline="middle"
            fontSize={11} fill={axisLabelColor} fontWeight={700}>{t('map_axis_left')}</text>
          <text x={LABEL_X_R} y={AXIS_LABEL_Y_CENTER} textAnchor="middle" dominantBaseline="middle"
            fontSize={11} fill={axisLabelColor} fontWeight={700}>{t('map_axis_right')}</text>
          <text x={SVG_W / 2} y={AXIS_LABEL_TOP_Y} textAnchor="middle" dominantBaseline="middle"
            fontSize={11} fill={axisLabelColor} fontWeight={700}>{t('map_axis_religious')}</text>
          <text x={SVG_W / 2} y={AXIS_LABEL_BOT_Y} textAnchor="middle" dominantBaseline="middle"
            fontSize={11} fill={axisLabelColor} fontWeight={700}>{t('map_axis_secular')}</text>

          {/* Leader lines: from label centre to dot edge
              Suppressed if the segment passes within LINE_LABEL_CLEAR px of any other label centre */}
          {labels.map((lb, i) => {
            const dx = lb.dotX - lb.labelX, dy = lb.dotY - lb.labelY
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            const endX = lb.dotX - (dx / dist) * (DOT_R + 2)
            const endY = lb.dotY - (dy / dist) * (DOT_R + 2)
            const clearance = Math.min(dist * 0.35, 38)
            const startX = lb.labelX + (dx / dist) * clearance
            const startY = lb.labelY + (dy / dist) * clearance
            if (dist < DOT_R + clearance + 4) return null

            // Suppress if the segment would cross too close to any other label
            const blocked = labels.some((other, j) => {
              if (j === i) return false
              return segToPointDist(startX, startY, endX, endY, other.labelX, other.labelY) < LINE_LABEL_CLEAR
            })
            if (blocked) return null

            return (
              <line key={`line-${i}`}
                x1={startX} y1={startY} x2={endX} y2={endY}
                stroke={lb.color} strokeWidth={0.9} strokeOpacity={0.45} />
            )
          })}

          {/* Party dots */}
          {dots.map(d => (
            <g key={d.party_id}>
              <title>{d.name}</title>
              <circle cx={d.svgX} cy={d.svgY} r={DOT_R} fill={d.color} opacity={0.9} />
            </g>
          ))}

          {/* Labels — textAnchor="middle" is BiDi-neutral; text stays centred in the margin */}
          {labels.map((lb, i) => (
            <text key={`label-${i}`}
              x={lb.labelX}
              y={lb.labelY}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={9}
              fontWeight={600}
              fill={lb.color}
              style={{ userSelect: 'none' }}
            >
              {lb.name}
            </text>
          ))}

          {/* User star */}
          {userSvgX !== null && userSvgY !== null && (
            <g>
              <title>{lang === 'he' ? 'אתם' : 'You'}</title>
              <path d={starPath(userSvgX, userSvgY, 11)} fill="#4f46e5" stroke="white" strokeWidth={1.5} />
              <text x={userSvgX} y={userSvgY + 19}
                textAnchor="middle" fontSize={9} fontWeight={700} fill="#4f46e5"
                style={{ userSelect: 'none' }}>
                {lang === 'he' ? 'אתם' : 'You'}
              </text>
            </g>
          )}

          {/* Friend star */}
          {friendSvgX !== null && friendSvgY !== null && (
            <g>
              <title>{lang === 'he' ? 'חבר/ה' : 'Friend'}</title>
              <path d={starPath(friendSvgX, friendSvgY, 11)} fill="#9333ea" stroke="white" strokeWidth={1.5} />
              <text x={friendSvgX} y={friendSvgY + 19}
                textAnchor="middle" fontSize={9} fontWeight={700} fill="#9333ea"
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
