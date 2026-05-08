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

// Short 2-char abbreviations shown inside each dot
const ABBREV_HE: Record<string, string> = {
  likud:             'לכ',
  beyachad:          'בי',
  national_unity:    'מח',
  shas:              'שס',
  utj:               'יה',
  religious_zionism: 'צד',
  otzma:             'עצ',
  yisrael_beitenu:   'יב',
  hadash_taal:       'חד',
  raam:              'רע',
  democrats:         'דמ',
  yashar:            'יש',
  miluimnikim:       'מי',
}
const ABBREV_EN: Record<string, string> = {
  likud:             'LK',
  beyachad:          'YA',
  national_unity:    'NU',
  shas:              'SH',
  utj:               'YH',
  religious_zionism: 'RZ',
  otzma:             'OJ',
  yisrael_beitenu:   'YB',
  hadash_taal:       'HT',
  raam:              'RA',
  democrats:         'DM',
  yashar:            'YS',
  miluimnikim:       'ML',
}

const SVG_W = 460
const SVG_H = 400
const PAD_X = 40
const PAD_Y = 36
const DOT_R = 13

function toSvgX(x: number) { return PAD_X + ((x + 1) / 2) * (SVG_W - PAD_X * 2) }
function toSvgY(y: number) { return PAD_Y + ((1 - y) / 2) * (SVG_H - PAD_Y * 2) }

export function PartyMap({ points, parties, mode, onModeChange, lang }: Props) {
  const { t } = useTranslation()
  const abbrevMap = lang === 'he' ? ABBREV_HE : ABBREV_EN

  const dots = points.map(pt => {
    const party = parties.find(p => p.id === pt.party_id)
    return {
      party_id: pt.party_id,
      color: party?.color ?? '#888',
      name: party ? (lang === 'he' ? party.name_he : party.name_en) : pt.party_id,
      abbrev: abbrevMap[pt.party_id] ?? pt.party_id.slice(0, 2).toUpperCase(),
      svgX: toSvgX(pt.x),
      svgY: toSvgY(pt.y),
    }
  })

  const axisColor = '#d1d5db'
  const axisLabelColor = '#6b7280'
  const axisLabelSize = 9

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

          {/* Dots with abbreviations */}
          {dots.map(d => (
            <g key={d.party_id}>
              <title>{d.name}</title>
              <circle cx={d.svgX} cy={d.svgY} r={DOT_R} fill={d.color} opacity={0.92} />
              <text
                x={d.svgX}
                y={d.svgY}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={7.5}
                fontWeight={800}
                fill="white"
                style={{ userSelect: 'none' }}
              >
                {d.abbrev}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {dots.map(d => (
          <div key={d.party_id} className="flex items-center gap-2 min-w-0">
            <span
              className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: d.color, fontSize: '6px' }}
            >
              {d.abbrev}
            </span>
            <span className="text-xs text-gray-700 truncate">{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
