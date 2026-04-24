import { useTranslation } from 'react-i18next'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Cell, LabelList,
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

      <p className="text-xs text-gray-400 mb-4 leading-relaxed">{t('similarity_subtitle')}</p>

      <div className="w-full" style={{ height: 340 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 24, bottom: 20, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              type="number"
              dataKey="x"
              domain={[-1.1, 1.1]}
              tick={false}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={false}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={[-1.1, 1.1]}
              tick={false}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={false}
              width={8}
            />
            <Scatter data={data} isAnimationActive={false}>
              {data.map(entry => (
                <Cell key={entry.party_id} fill={entry.color} />
              ))}
              <LabelList
                dataKey="name"
                position="top"
                style={{ fontSize: '10px', fontWeight: 600, fill: '#374151' }}
              />
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-2">
        {data.map(entry => (
          <span key={entry.party_id} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
            {entry.name}
          </span>
        ))}
      </div>
    </div>
  )
}
