import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend,
} from 'recharts'
import { useTranslation } from 'react-i18next'
import { DIMENSIONS, type DimensionKey } from '../../utils/matching'
import { useSurveyStore } from '../../store/survey'
import { B, ACCENT } from '../bureau/BureauComponents'

interface Props {
  userDimScores: Record<DimensionKey, number>
  partyDimScores: Record<DimensionKey, number>
  partyName: string
  partyColor: string
  friendDimScores?: Record<DimensionKey, number> | null
}

const FRIEND_COLOR = '#9333ea'

export function MatchRadarChart({ userDimScores, partyDimScores, partyName, partyColor, friendDimScores }: Props) {
  const { t } = useTranslation()
  const { lang } = useSurveyStore()

  const youLabel = t('radar_you')
  const friendLabel = t('comparison_friend')
  const dims = Object.keys(DIMENSIONS) as DimensionKey[]

  const data = dims.map(dim => ({
    dimension: lang === 'he' ? DIMENSIONS[dim].label_he : DIMENSIONS[dim].label_en,
    [youLabel]: userDimScores[dim] ?? 50,
    [partyName]: partyDimScores[dim] ?? 50,
    ...(friendDimScores ? { [friendLabel]: friendDimScores[dim] ?? 50 } : {}),
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke={B.border} />
        <PolarAngleAxis
          dataKey="dimension"
          tick={{ fontSize: 11, fill: B.inkFaint, fontFamily: B.font }}
        />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          name={youLabel}
          dataKey={youLabel}
          stroke={ACCENT}
          fill={ACCENT}
          fillOpacity={0.2}
          strokeWidth={2.5}
          dot={{ r: 3, fill: ACCENT, strokeWidth: 0 }}
        />
        <Radar
          name={partyName}
          dataKey={partyName}
          stroke={partyColor}
          fill={partyColor}
          fillOpacity={0.15}
          strokeWidth={2.5}
          strokeDasharray="6 3"
          dot={{ r: 4, fill: partyColor, stroke: B.white, strokeWidth: 1.5 }}
        />
        {friendDimScores && (
          <Radar
            name={friendLabel}
            dataKey={friendLabel}
            stroke={FRIEND_COLOR}
            fill={FRIEND_COLOR}
            fillOpacity={0.08}
            strokeWidth={1.5}
            strokeDasharray="2 4"
            dot={{ r: 3, fill: B.white, stroke: FRIEND_COLOR, strokeWidth: 2 }}
          />
        )}
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 8, fontFamily: B.font }}
          formatter={(value) => (
            <span style={{ color: value === youLabel ? ACCENT : value === friendLabel ? FRIEND_COLOR : partyColor }}>
              {value}
            </span>
          )}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
