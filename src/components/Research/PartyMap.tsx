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
const SVG_H = 460
const PAD_X = 44
const PAD_Y = 38
const DOT_R = 8

function toSvgX(x: number) { return PAD_X + ((x + 1) / 2) * (SVG_W - PAD_X * 2) }
function toSvgY(y: number) { return PAD_Y + ((1 - y) / 2) * (SVG_H - PAD_Y * 2) }

// Star polygon path centred at (cx, cy)
function starPath(cx: number, cy: number, r: number, n = 5): string {
  const pts: string[] = []
  for (let i = 0; i < n * 2; i++) {
    const angle = (Math.PI / n) * i - Math.PI / 2
    const radius = i % 2 === 0 ? r : r * 0.45
    pts.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`)
  }
  return `M${pts.join('L')}Z`
}

interface LabelPos { x: number; y: number; text: string; color: string; dotX: number; dotY: number }

function forcePlaceLabels(dots: { svgX: number; svgY: number; name: string; color: string }[]): LabelPos[] {
  const FONT_H = 10
  const CHAR_W = 5.5
  const PAD = 3

  // Initialize label positions radially from dot based on dot's quadrant from center
  const cx = SVG_W / 2, cy = SVG_H / 2
  const labels: { x: number; y: number; vx: number; vy: number; w: number; h: number; dotX: number; dotY: number; name: string; color: string }[] = dots.map(d => {
    const w = d.name.length * CHAR_W + PAD * 2
    const h = FONT_H + PAD * 2
    const dx = d.svgX - cx, dy = d.svgY - cy
    const angle = Math.atan2(dy, dx)
    const offset = DOT_R + 4
    return {
      x: d.svgX + Math.cos(angle) * offset,
      y: d.svgY + Math.sin(angle) * offset - h / 2,
      vx: 0, vy: 0,
      w, h,
      dotX: d.svgX,
      dotY: d.svgY,
      name: d.name,
      color: d.color,
    }
  })

  const ITERATIONS = 600
  const DOT_REPULSE = 1.4
  const LABEL_REPULSE = 1.1
  const SPRING = 0.06

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const cooling = 1 - iter / ITERATIONS

    // Repulsion from dots
    for (const lb of labels) {
      const lcx = lb.x + lb.w / 2, lcy = lb.y + lb.h / 2
      for (const d of dots) {
        const dx = lcx - d.svgX, dy = lcy - d.svgY
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.1
        const minDist = DOT_R + Math.max(lb.w, lb.h) / 2 + 4
        if (dist < minDist) {
          const force = (minDist - dist) / dist * DOT_REPULSE * cooling
          lb.vx += dx * force; lb.vy += dy * force
        }
      }
    }

    // Repulsion between labels
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i], b = labels[j]
        const acx = a.x + a.w / 2, acy = a.y + a.h / 2
        const bcx = b.x + b.w / 2, bcy = b.y + b.h / 2
        const overlapX = (a.w + b.w) / 2 - Math.abs(acx - bcx)
        const overlapY = (a.h + b.h) / 2 - Math.abs(acy - bcy)
        if (overlapX > 0 && overlapY > 0) {
          const dx = acx - bcx, dy = acy - bcy
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.1
          const force = Math.min(overlapX, overlapY) / dist * LABEL_REPULSE * cooling
          a.vx += dx * force; a.vy += dy * force
          b.vx -= dx * force; b.vy -= dy * force
        }
      }
    }

    // Spring toward dot
    for (const lb of labels) {
      const lcx = lb.x + lb.w / 2, lcy = lb.y + lb.h / 2
      const idealAngle = Math.atan2(lcy - lb.dotY, lcx - lb.dotX)
      const idealDist = DOT_R + lb.h / 2 + 6
      const tx = lb.dotX + Math.cos(idealAngle) * idealDist - lb.w / 2
      const ty = lb.dotY + Math.sin(idealAngle) * idealDist - lb.h / 2
      lb.vx += (tx - lb.x) * SPRING * cooling
      lb.vy += (ty - lb.y) * SPRING * cooling
    }

    // Apply velocity + damp + clamp
    for (const lb of labels) {
      lb.x += lb.vx; lb.y += lb.vy
      lb.vx *= 0.5; lb.vy *= 0.5
      lb.x = Math.max(2, Math.min(SVG_W - lb.w - 2, lb.x))
      lb.y = Math.max(2, Math.min(SVG_H - lb.h - 2, lb.y))
    }
  }

  return labels.map(lb => ({
    x: lb.x,
    y: lb.y,
    text: lb.name,
    color: lb.color,
    dotX: lb.dotX,
    dotY: lb.dotY,
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

  const labels = forcePlaceLabels(dots)

  const axisColor = '#d1d5db'
  const axisLabelColor = '#6b7280'
  const axisLabelSize = 9

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
          <line x1={PAD_X} y1={SVG_H / 2} x2={SVG_W - PAD_X} y2={SVG_H / 2} stroke={axisColor} strokeWidth={1} />
          <line x1={SVG_W / 2} y1={PAD_Y} x2={SVG_W / 2} y2={SVG_H - PAD_Y} stroke={axisColor} strokeWidth={1} />

          {/* X-axis labels */}
          <text x={PAD_X - 4} y={SVG_H / 2} textAnchor="end" dominantBaseline="middle"
            fontSize={axisLabelSize} fill={axisLabelColor} fontWeight={600}>
            {t('map_axis_left')}
          </text>
          <text x={SVG_W - PAD_X + 4} y={SVG_H / 2} textAnchor="start" dominantBaseline="middle"
            fontSize={axisLabelSize} fill={axisLabelColor} fontWeight={600}>
            {t('map_axis_right')}
          </text>

          {/* Y-axis labels */}
          <text x={SVG_W / 2} y={PAD_Y - 10} textAnchor="middle" dominantBaseline="auto"
            fontSize={axisLabelSize} fill={axisLabelColor} fontWeight={600}>
            {t('map_axis_religious')}
          </text>
          <text x={SVG_W / 2} y={SVG_H - PAD_Y + 16} textAnchor="middle" dominantBaseline="auto"
            fontSize={axisLabelSize} fill={axisLabelColor} fontWeight={600}>
            {t('map_axis_secular')}
          </text>

          {/* Leader lines from label centre to dot */}
          {labels.map((lb, i) => {
            const lbCx = lb.x + (lb.text.length * 5.5 + 6) / 2
            const lbCy = lb.y + 8
            const dx = lb.dotX - lbCx, dy = lb.dotY - lbCy
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            // shorten line so it doesn't overlap dot or label box
            const startX = lbCx + (dx / dist) * 6
            const startY = lbCy + (dy / dist) * 6
            const endX = lb.dotX - (dx / dist) * DOT_R
            const endY = lb.dotY - (dy / dist) * DOT_R
            if (dist < DOT_R + 8) return null
            return (
              <line key={`line-${i}`}
                x1={startX} y1={startY} x2={endX} y2={endY}
                stroke={lb.color} strokeWidth={0.7} strokeOpacity={0.45} />
            )
          })}

          {/* Label background rects */}
          {labels.map((lb, i) => (
            <rect key={`rect-${i}`}
              x={lb.x} y={lb.y}
              width={lb.text.length * 5.5 + 6}
              height={16}
              rx={3}
              fill="white"
              fillOpacity={0.88}
              stroke={lb.color}
              strokeWidth={0.6}
            />
          ))}

          {/* Label texts */}
          {labels.map((lb, i) => (
            <text key={`label-${i}`}
              x={lb.x + 3} y={lb.y + 11}
              fontSize={9}
              fontWeight={600}
              fill={lb.color}
              style={{ userSelect: 'none' }}
            >
              {lb.text}
            </text>
          ))}

          {/* Party dots */}
          {dots.map(d => (
            <g key={d.party_id}>
              <title>{d.name}</title>
              <circle cx={d.svgX} cy={d.svgY} r={DOT_R} fill={d.color} opacity={0.92} />
            </g>
          ))}

          {/* User star */}
          {userSvgX !== null && userSvgY !== null && (
            <g>
              <title>{lang === 'he' ? 'אתם' : 'You'}</title>
              <path d={starPath(userSvgX, userSvgY, 11)} fill="#4f46e5" stroke="white" strokeWidth={1.5} />
              <text x={userSvgX} y={userSvgY + 20}
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
