import { useTranslation } from 'react-i18next'
import type { PartyPoint } from '../../utils/research'
import type { Party } from '../../types'

interface Props {
  points: PartyPoint[]
  parties: Party[]
  mode: 'stated' | 'voted'
  onModeChange: (m: 'stated' | 'voted') => void
  lang: 'he' | 'en'
}

const SVG_W = 380
const SVG_H = 380
const PAD = 44
const DOT_R = 8
const FONT_SIZE = 9
const CHAR_W = 5.0   // px per character at 9px font
const LABEL_H = FONT_SIZE + 2

function toSvgX(x: number) { return PAD + ((x + 1) / 2) * (SVG_W - PAD * 2) }
function toSvgY(y: number) { return PAD + ((1 - y) / 2) * (SVG_H - PAD * 2) }

function labelW(name: string) { return name.length * CHAR_W }

function placeLabelsFD(
  dots: Array<{ svgX: number; svgY: number; name: string }>
): Array<{ lx: number; ly: number }> {
  // Start above each dot
  const pos = dots.map(d => ({ lx: d.svgX, ly: d.svgY - DOT_R - 5 }))

  for (let iter = 0; iter < 200; iter++) {
    const forces = pos.map(() => ({ fx: 0, fy: 0 }))

    // Label ↔ label repulsion (treat as rectangles)
    for (let i = 0; i < pos.length; i++) {
      const wi = labelW(dots[i].name)
      for (let j = i + 1; j < pos.length; j++) {
        const wj = labelW(dots[j].name)
        const dx = pos[i].lx - pos[j].lx
        const dy = pos[i].ly - pos[j].ly
        const overlapX = (wi + wj) / 2 + 8 - Math.abs(dx)
        const overlapY = LABEL_H + 6 - Math.abs(dy)
        if (overlapX > 0 && overlapY > 0) {
          const fx = Math.sign(dx || 0.01) * overlapX * 0.55
          const fy = Math.sign(dy || 0.01) * overlapY * 0.55
          forces[i].fx += fx; forces[i].fy += fy
          forces[j].fx -= fx; forces[j].fy -= fy
        }
      }
    }

    // Label ↔ dot repulsion
    for (let i = 0; i < pos.length; i++) {
      for (let j = 0; j < dots.length; j++) {
        const dx = pos[i].lx - dots[j].svgX
        const dy = pos[i].ly - dots[j].svgY
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01
        const minDist = DOT_R + LABEL_H / 2 + 5
        if (dist < minDist) {
          forces[i].fx += (dx / dist) * (minDist - dist) * 0.6
          forces[i].fy += (dy / dist) * (minDist - dist) * 0.6
        }
      }
    }

    // Spring toward ideal position (above own dot)
    for (let i = 0; i < pos.length; i++) {
      forces[i].fx += (dots[i].svgX - pos[i].lx) * 0.025
      forces[i].fy += (dots[i].svgY - DOT_R - 7 - pos[i].ly) * 0.025
    }

    // Apply forces
    for (let i = 0; i < pos.length; i++) {
      pos[i].lx += forces[i].fx
      pos[i].ly += forces[i].fy
    }
  }

  // Clamp to SVG bounds
  return pos.map((p, i) => {
    const w = labelW(dots[i].name)
    return {
      lx: Math.max(w / 2 + 3, Math.min(SVG_W - w / 2 - 3, p.lx)),
      ly: Math.max(LABEL_H + 2, Math.min(SVG_H - 4, p.ly)),
    }
  })
}

export function PartyMap({ points, parties, mode, onModeChange, lang }: Props) {
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

  const labelPositions = placeLabelsFD(dots)

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
          {/* Grid crosshairs */}
          <line x1={PAD} y1={SVG_H / 2} x2={SVG_W - PAD} y2={SVG_H / 2} stroke="#e5e7eb" strokeWidth={1} />
          <line x1={SVG_W / 2} y1={PAD} x2={SVG_W / 2} y2={SVG_H - PAD} stroke="#e5e7eb" strokeWidth={1} />

          {/* Leader lines from dot to displaced label */}
          {dots.map((d, i) => {
            const lp = labelPositions[i]
            const dx = lp.lx - d.svgX
            const dy = lp.ly - d.svgY
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < DOT_R + 10) return null
            // Start line at edge of dot, end near label
            const ux = dx / dist, uy = dy / dist
            return (
              <line
                key={`line-${d.party_id}`}
                x1={d.svgX + ux * (DOT_R + 1)}
                y1={d.svgY + uy * (DOT_R + 1)}
                x2={lp.lx - ux * 4}
                y2={lp.ly + LABEL_H / 2}
                stroke={d.color}
                strokeWidth={0.8}
                opacity={0.5}
              />
            )
          })}

          {/* Dots */}
          {dots.map(d => (
            <circle key={`dot-${d.party_id}`} cx={d.svgX} cy={d.svgY} r={DOT_R} fill={d.color} opacity={0.9} />
          ))}

          {/* Labels */}
          {dots.map((d, i) => {
            const lp = labelPositions[i]
            return (
              <text
                key={`label-${d.party_id}`}
                x={lp.lx}
                y={lp.ly}
                textAnchor="middle"
                fontSize={FONT_SIZE}
                fontWeight={700}
                fill="#1f2937"
              >
                {d.name}
              </text>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
