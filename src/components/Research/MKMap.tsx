import type { PartyPoint, MKPoint } from '../../utils/research'
import type { Party, KnessetMember } from '../../types'

interface Props {
  partyPoints: PartyPoint[]
  mkPoints: MKPoint[]
  parties: Party[]
  mks: KnessetMember[]
  lang: 'he' | 'en'
  highlightMkId?: string | null
  onMKHover?: (mkId: string | null) => void
}

const SVG_W = 380
const SVG_H = 380
const PAD = 48
const PARTY_R = 10
const MK_R = 4
const FONT_SIZE = 9

function toSvgX(x: number) { return PAD + ((x + 1) / 2) * (SVG_W - PAD * 2) }
function toSvgY(y: number) { return PAD + ((1 - y) / 2) * (SVG_H - PAD * 2) }

export function MKMap({ partyPoints, mkPoints, parties, mks, lang, highlightMkId, onMKHover }: Props) {
  const partyDots = partyPoints.map(pt => {
    const party = parties.find(p => p.id === pt.party_id)
    return {
      id: pt.party_id,
      color: party?.color ?? '#888',
      name: party ? (lang === 'he' ? party.name_he : party.name_en) : pt.party_id,
      svgX: toSvgX(pt.x),
      svgY: toSvgY(pt.y),
    }
  })

  const mkDots = mkPoints.map(pt => {
    const mk = mks.find(m => m.id === pt.mk_id)
    const party = parties.find(p => p.id === pt.party_id)
    return {
      id: pt.mk_id,
      partyId: pt.party_id,
      color: party?.color ?? '#888',
      name: mk ? (lang === 'he' ? mk.name_he : mk.name_en || mk.name_he) : pt.mk_id,
      svgX: toSvgX(pt.x),
      svgY: toSvgY(pt.y),
      isCurrent: mk?.is_current ?? false,
    }
  })

  return (
    <div className="w-full overflow-hidden rounded-xl border border-gray-100 bg-white">
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        width="100%"
        style={{ display: 'block' }}
      >
        {/* Grid crosshairs */}
        <line x1={PAD} y1={SVG_H / 2} x2={SVG_W - PAD} y2={SVG_H / 2} stroke="#e5e7eb" strokeWidth={1} />
        <line x1={SVG_W / 2} y1={PAD} x2={SVG_W / 2} y2={SVG_H - PAD} stroke="#e5e7eb" strokeWidth={1} />

        {/* MK dots (rendered first, below parties) */}
        {mkDots.map(d => {
          const isHighlighted = d.id === highlightMkId
          return (
            <g key={d.id}>
              <circle
                cx={d.svgX}
                cy={d.svgY}
                r={isHighlighted ? MK_R + 2 : MK_R}
                fill={d.color}
                opacity={isHighlighted ? 1 : 0.55}
                stroke={isHighlighted ? '#fff' : 'none'}
                strokeWidth={isHighlighted ? 1.5 : 0}
                style={{ cursor: onMKHover ? 'pointer' : 'default' }}
                onMouseEnter={() => onMKHover?.(d.id)}
                onMouseLeave={() => onMKHover?.(null)}
              />
              {isHighlighted && (
                <text
                  x={d.svgX}
                  y={d.svgY - MK_R - 4}
                  textAnchor="middle"
                  fontSize={FONT_SIZE}
                  fontWeight={700}
                  fill={d.color}
                >
                  {d.name}
                </text>
              )}
            </g>
          )
        })}

        {/* Party dots (on top) */}
        {partyDots.map(d => (
          <g key={d.id}>
            <circle cx={d.svgX} cy={d.svgY} r={PARTY_R} fill={d.color} opacity={0.9} />
            <text
              x={d.svgX}
              y={d.svgY - PARTY_R - 4}
              textAnchor="middle"
              fontSize={FONT_SIZE}
              fontWeight={700}
              fill={d.color}
            >
              {d.name}
            </text>
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="px-3 pb-3 flex items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <svg width={20} height={12}>
            <circle cx={10} cy={6} r={PARTY_R - 1} fill="#888" opacity={0.9} />
          </svg>
          {lang === 'he' ? 'מפלגה' : 'Party'}
        </span>
        <span className="flex items-center gap-1.5">
          <svg width={20} height={12}>
            <circle cx={10} cy={6} r={MK_R} fill="#888" opacity={0.55} />
          </svg>
          {lang === 'he' ? 'ח"כ' : 'MK'}
        </span>
      </div>
    </div>
  )
}
