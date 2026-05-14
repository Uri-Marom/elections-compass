// DimensionHeader is now minimal — the dimension transition screen in SurveyPage
// handles the full dimension intro. This component renders a compact indicator
// above the question card during the question flow.

import { useTranslation } from 'react-i18next'
import type { DimensionKey } from '../../utils/matching'
import { B, DIM_COLOR } from '../bureau/BureauComponents'

interface Props {
  dimension: DimensionKey
  questionIndex: number
  totalInDimension: number
}

export function DimensionHeader({ dimension, questionIndex, totalInDimension }: Props) {
  const { t } = useTranslation()
  const color = DIM_COLOR[dimension]

  return (
    <div style={{
      width: '100%',
      maxWidth: 480,
      margin: '0 auto',
      padding: '0 20px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {t(`dimension_${dimension}`)}
        </span>
        <span style={{ fontSize: 11, color: B.inkHint, marginInlineStart: 'auto', fontFamily: 'ui-monospace, monospace' }}>
          {questionIndex + 1} / {totalInDimension}
        </span>
      </div>
      <div style={{ height: 2, background: B.border, borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${((questionIndex + 1) / totalInDimension) * 100}%`,
          background: color,
          borderRadius: 99,
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  )
}
