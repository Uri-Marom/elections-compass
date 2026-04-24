import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend,
} from 'recharts'
import { useTranslation } from 'react-i18next'
import { DIMENSIONS, type DimensionKey } from '../../utils/matching'
import { useSurveyStore } from '../../store/survey'

interface Props {
  userDimScores: Record<DimensionKey, number>
  partyDimScores: Record<DimensionKey, number>
  partyName: string
  partyColor: string
}

export function MatchRadarChart({ userDimScores, partyDimScores, partyName, partyColor }: Props) {
  const { t } = useTranslation()
  const { lang } = useSurveyStore()

  const youLabel = t('radar_you')
  const dims = Object.keys(DIMENSIONS) as DimensionKey[]

  const data = dims.map(dim => ({
    dimension: lang === 'he' ? DIMENSIONS[dim].label_he : DIMENSIONS[dim].label_en,
    [youLabel]: userDimScores[dim] ?? 50,
    [partyName]: partyDimScores[dim] ?? 50,
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="#e5e7eb" />
        <PolarAngleAxis
          dataKey="dimension"
          tick={{ fontSize: 11, fill: '#6B7280' }}
        />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          name={youLabel}
          dataKey={youLabel}
          stroke="#6366F1"
          fill="#6366F1"
          fillOpacity={0.25}
          strokeWidth={2.5}
          dot={{ r: 3, fill: '#6366F1', strokeWidth: 0 }}
        />
        <Radar
          name={partyName}
          dataKey={partyName}
          stroke={partyColor}
          fill={partyColor}
          fillOpacity={0.15}
          strokeWidth={2}
          dot={{ r: 3, fill: partyColor, strokeWidth: 0 }}
          strokeDasharray="5 3"
        />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          formatter={(value) => <span style={{ color: value === youLabel ? '#6366F1' : partyColor }}>{value}</span>}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
