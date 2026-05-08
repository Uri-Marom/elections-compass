import { useTranslation } from 'react-i18next'
import type { PartyPoint } from '../../utils/research'
import type { Party } from '../../types'

interface Props {
  points: PartyPoint[]
  parties: Party[]
  mode: 'stated' | 'voted'
  onModeChange: (m: 'stated' | 'voted') => void
  lang: 'he' | 'en'
  userPoint?: { x: number; y: number } | null
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

interface DotItem { svgX: number; svgY: number; name: string; color: string; party_id: string }
interface PlacedLabel {
  labelX: number; labelY: number
  name: string; color: string
  dotX: number; dotY: number
  side: 'left' | 'right'
}

function layoutMargin(items: DotItem[], side: 'left' | 'right'): PlacedLabel[] {
  if (items.length === 0) return []
  const minY = PAD_Y + 4
  const maxY = SVG_H - PAD_Y - 4

  const sorted = [...items].sort((a, b) => a.svgY - b.svgY)
  const ys = sorted.map(d => Math.max(minY, Math.min(maxY, d.svgY)))

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

  return sorted.map((d, i) => ({
    labelX,
    labelY: ys[i],
    name: d.name,
    color: d.color,
    dotX: d.svgX,
    dotY: d.svgY,
    side,
  }))
}

export function PartyMap({ points, parties, mode, onModeChange, lang, userPoint }: Props) {
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
  const labels: PlacedLabel[] = [
    ...layoutMargin(leftDots,  'left'),
    ...layoutMargin(rightDots, 'right'),
  ]

  const axisColor = '#e5e7eb'
  const axisLabelColor = '#9ca3af'

  const userSvgX = userPoint ? toSvgX(userPoint.x) : null
  const userSvgY = userPoint ? toSvgY(userPoint.y) : null

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

      <p className="text-xs text-gray-400 mb-3 leading-relaxed">{t('similarity_subtitle')}</p>

      <div className="w-full overflow-hidden rounded-xl border border-gray-100 bg-white">
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" style={{ display: 'block' }}>

          {/* Axis lines — leave 28px gap at each end for the labels */}
          <line x1={PLOT_X0 + 28} y1={SVG_H / 2} x2={PLOT_X1 - 28} y2={SVG_H / 2} stroke={axisColor} strokeWidth={1} />
          <line x1={SVG_W / 2} y1={PAD_Y + 14} x2={SVG_W / 2} y2={SVG_H - PAD_Y - 14} stroke={axisColor} strokeWidth={1} />

          {/* Axis labels */}
          <text x={PLOT_X0 + 14} y={SVG_H / 2} textAnchor="middle" dominantBaseline="middle"
            fontSize={11} fill={axisLabelColor} fontWeight={700}>{t('map_axis_left')}</text>
          <text x={PLOT_X1 - 14} y={SVG_H / 2} textAnchor="middle" dominantBaseline="middle"
            fontSize={11} fill={axisLabelColor} fontWeight={700}>{t('map_axis_right')}</text>
          <text x={SVG_W / 2} y={PAD_Y + 7} textAnchor="middle" dominantBaseline="middle"
            fontSize={11} fill={axisLabelColor} fontWeight={700}>{t('map_axis_religious')}</text>
          <text x={SVG_W / 2} y={SVG_H - PAD_Y - 7} textAnchor="middle" dominantBaseline="middle"
            fontSize={11} fill={axisLabelColor} fontWeight={700}>{t('map_axis_secular')}</text>

          {/* Leader lines: from label centre to dot edge */}
          {labels.map((lb, i) => {
            const dx = lb.dotX - lb.labelX, dy = lb.dotY - lb.labelY
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            // shorten at dot end so the line doesn't overlap the circle
            const endX = lb.dotX - (dx / dist) * (DOT_R + 2)
            const endY = lb.dotY - (dy / dist) * (DOT_R + 2)
            // shorten at label end (~half the text width to clear the label)
            const clearance = Math.min(dist * 0.35, 38)
            const startX = lb.labelX + (dx / dist) * clearance
            const startY = lb.labelY + (dy / dist) * clearance
            if (dist < DOT_R + clearance + 4) return null
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
        </svg>
      </div>
    </div>
  )
}
