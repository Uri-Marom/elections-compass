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
const SVG_H = 340
const PAD = 40  // padding so labels don't clip

// Map coordinate from [-1, 1] to SVG pixel range
function toSvgX(x: number) { return PAD + ((x + 1) / 2) * (SVG_W - PAD * 2) }
function toSvgY(y: number) { return PAD + ((1 - y) / 2) * (SVG_H - PAD * 2) }  // flip Y

export function PartyMap({ points, parties, mode, onModeChange, lang }: Props) {
  const { t } = useTranslation()

  const entries = points.map(pt => {
    const party = parties.find(p => p.id === pt.party_id)
    return {
      ...pt,
      color: party?.color ?? '#888',
      name: party ? (lang === 'he' ? party.name_he : party.name_en) : pt.party_id,
      svgX: toSvgX(pt.x),
      svgY: toSvgY(pt.y),
    }
  })

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
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          width="100%"
          style={{ display: 'block' }}
        >
          {/* Grid lines */}
          <line x1={PAD} y1={SVG_H / 2} x2={SVG_W - PAD} y2={SVG_H / 2} stroke="#e5e7eb" strokeWidth={1} />
          <line x1={SVG_W / 2} y1={PAD} x2={SVG_W / 2} y2={SVG_H - PAD} stroke="#e5e7eb" strokeWidth={1} />

          {/* Party dots + labels */}
          {entries.map(e => {
            const { svgX, svgY, color, name, party_id } = e
            // Nudge label above or below based on vertical position
            const labelDy = svgY < SVG_H / 2 + 20 ? 22 : -13
            return (
              <g key={party_id}>
                <circle cx={svgX} cy={svgY} r={9} fill={color} opacity={0.9} />
                <text
                  x={svgX}
                  y={svgY + labelDy}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={700}
                  fill="#1f2937"
                >
                  {name}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
