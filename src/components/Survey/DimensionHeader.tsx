import { useTranslation } from 'react-i18next'
import type { DimensionKey } from '../../utils/matching'

interface Props {
  dimension: DimensionKey
  questionIndex: number
  totalInDimension: number
}

const DIMENSION_ICONS: Record<string, string> = {
  security:      '🛡️',
  religion:      '✡️',
  socioeconomic: '📊',
  judicial:      '⚖️',
  minority:      '🤝',
  governance:    '🏛️',
}

export function DimensionHeader({ dimension, questionIndex, totalInDimension }: Props) {
  const { t } = useTranslation()
  const icon = DIMENSION_ICONS[dimension] ?? '•'

  return (
    <div className="w-full max-w-2xl mx-auto px-4 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{icon}</span>
        <h2 className="text-base font-semibold text-gray-700">
          {t(`dimension_${dimension}`)}
        </h2>
        <span className="text-xs text-gray-400 ms-auto">
          {questionIndex + 1} / {totalInDimension}
        </span>
      </div>
      <div className="h-1 bg-gray-100 rounded-full">
        <div
          className="h-1 bg-blue-500 rounded-full transition-all"
          style={{ width: `${((questionIndex + 1) / totalInDimension) * 100}%` }}
        />
      </div>
    </div>
  )
}
