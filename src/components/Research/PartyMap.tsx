import { useTranslation } from 'react-i18next'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from 'recharts'
import type { PartyPoint } from '../../utils/research'
import type { Party } from '../../types'

interface Props {
  points: PartyPoint[]
  parties: Party[]
  mode: 'stated' | 'voted'
  onModeChange: (m: 'stated' | 'voted') => void
  lang: 'he' | 'en'
}

interface ChartEntry {
  x: number
  y: number
  party_id: string
  color: string
  name: string
}

// Custom dot: colored circle + party name label above
function PartyDot(props: Record<string, unknown>) {
  const { cx, cy, payload } = props as { cx: number; cy: number; payload: ChartEntry }
  if (cx == null || cy == null) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={9} fill={payload.color} opacity={0.92} />
      <text
        x={cx}
        y={cy - 13}
        textAnchor="middle"
        fontSize={9}
        fontWeight={700}
        fill="#1f2937"
        style={{ pointerEvents: 'none' }}
      >
        {payload.name}
      </text>
    </g>
  )
}

export function PartyMap({ points, parties, mode, onModeChange, lang }: Props) {
  const { t } = useTranslation()

  const data: ChartEntry[] = points.map(pt => {
    const party = parties.find(p => p.id === pt.party_id)
    return {
      x: Math.round(pt.x * 100) / 100,
      y: Math.round(pt.y * 100) / 100,
      party_id: pt.party_id,
      color: party?.color ?? '#888',
      name: party ? (lang === 'he' ? party.name_he : party.name_en) : pt.party_id,
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
              mode === m
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            {m === 'stated' ? t('stated_positions') : t('actual_votes')}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-400 mb-3 leading-relaxed">{t('similarity_subtitle')}</p>

      <div className="w-full" style={{ height: 360 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 28, right: 28, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              type="number"
              dataKey="x"
              domain={[-1.15, 1.15]}
              tick={false}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={false}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={[-1.15, 1.15]}
              tick={false}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={false}
              width={8}
            />
            <Scatter
              data={data}
              isAnimationActive={false}
              shape={<PartyDot cx={0} cy={0} payload={data[0]} />}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
