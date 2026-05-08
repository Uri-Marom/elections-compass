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
const SVG_H = 420
const MARGIN = 112      // horizontal margin reserved for labels on each side
const PAD_Y = 36
const DOT_R = 7
const LABEL_GAP = 13   // min vertical spacing between labels in a margin

const PLOT_X0 = MARGIN
const PLOT_X1 = SVG_W - MARGIN

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

interface LabelItem {
  svgX: number; svgY: number
  name: string; color: string; party_id: string
}
interface PlacedLabel {
  labelX: number; labelY: number
  anchor: 'start' | 'end'
  name: string; color: string
  dotX: number; dotY: number
}

function layoutMargin(items: LabelItem[], side: 'left' | 'right'): PlacedLabel[] {
  if (items.length === 0) return []
  const minY = PAD_Y + 2
  const maxY = SVG_H - PAD_Y - 2
  const sorted = [...items].sort((a, b) => a.svgY - b.svgY)

  // Start each label at its dot's Y, clamped
  const ys = sorted.map(d => Math.max(minY, Math.min(maxY, d.svgY)))

  // Push down to avoid overlap
  for (let i = 1; i < ys.length; i++) {
    if (ys[i] < ys[i - 1] + LABEL_GAP) ys[i] = ys[i - 1] + LABEL_GAP
  }

  // If gone past bottom, slide up from the end
  if (ys[ys.length - 1] > maxY) {
    ys[ys.length - 1] = maxY
    for (let i = ys.length - 2; i >= 0; i--) {
      if (ys[i] > ys[i + 1] - LABEL_GAP) ys[i] = ys[i + 1] - LABEL_GAP
    }
  }

  const labelX = side === 'left' ? PLOT_X0 - 6 : PLOT_X1 + 6
  const anchor: 'start' | 'end' = side === 'left' ? 'end' : 'start'

  return sorted.map((d, i) => ({
    labelX,
    labelY: ys[i],
    anchor,
    name: d.name,
    color: d.color,
    dotX: d.svgX,
    dotY: d.svgY,
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

  // Split by which half of the plot area the dot falls in
  const leftDots  = dots.filter(d => d.svgX <= SVG_W / 2)
  const rightDots = dots.filter(d => d.svgX >  SVG_W / 2)
  const labels = [
    ...layoutMargin(leftDots,  'left'),
    ...layoutMargin(rightDots, 'right'),
  ]

  const axisColor = '#d1d5db'
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

          {/* Axis lines */}
          <line x1={PLOT_X0} y1={SVG_H / 2} x2={PLOT_X1} y2={SVG_H / 2} stroke={axisColor} strokeWidth={1} />
          <line x1={SVG_W / 2} y1={PAD_Y} x2={SVG_W / 2} y2={SVG_H - PAD_Y} stroke={axisColor} strokeWidth={1} />

          {/* Axis labels */}
          <text x={PLOT_X0 + 3} y={SVG_H / 2 - 4} fontSize={8} fill={axisLabelColor} fontWeight={600}>{t('map_axis_left')}</text>
          <text x={PLOT_X1 - 3} y={SVG_H / 2 - 4} fontSize={8} fill={axisLabelColor} fontWeight={600} textAnchor="end">{t('map_axis_right')}</text>
          <text x={SVG_W / 2} y={PAD_Y - 8} fontSize={8} fill={axisLabelColor} fontWeight={600} textAnchor="middle">{t('map_axis_religious')}</text>
          <text x={SVG_W / 2} y={SVG_H - PAD_Y + 14} fontSize={8} fill={axisLabelColor} fontWeight={600} textAnchor="middle">{t('map_axis_secular')}</text>

          {/* Leader lines */}
          {labels.map((lb, i) => {
            const dx = lb.dotX - lb.labelX, dy = lb.dotY - lb.labelY
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            // shorten at dot end by DOT_R, at label end by 2px
            const ex = lb.dotX - (dx / dist) * (DOT_R + 1)
            const ey = lb.dotY - (dy / dist) * (DOT_R + 1)
            const sx = lb.labelX + (dx / dist) * 2
            const sy = lb.labelY + (dy / dist) * 2
            return (
              <line key={`l${i}`} x1={sx} y1={sy} x2={ex} y2={ey}
                stroke={lb.color} strokeWidth={0.8} strokeOpacity={0.35} />
            )
          })}

          {/* Party dots */}
          {dots.map(d => (
            <g key={d.party_id}>
              <title>{d.name}</title>
              <circle cx={d.svgX} cy={d.svgY} r={DOT_R} fill={d.color} opacity={0.9} />
            </g>
          ))}

          {/* Labels */}
          {labels.map((lb, i) => (
            <text key={`t${i}`}
              x={lb.labelX} y={lb.labelY}
              textAnchor={lb.anchor}
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
              <text x={userSvgX} y={userSvgY + 18}
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
