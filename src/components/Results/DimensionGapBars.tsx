import { useTranslation } from 'react-i18next'
import { DIMENSIONS, type DimensionKey } from '../../utils/matching'
import type { PartyPosition } from '../../types'
import { useSurveyStore } from '../../store/survey'

const DIMENSION_ICONS: Record<string, string> = {
  security: '🛡️', religion: '✡️', socioeconomic: '📊',
  judicial: '⚖️', minority: '🤝', governance: '🏛️',
}

interface Props {
  userAnswers: Record<string, number | null>
  partyPositions: PartyPosition[]
  partyColor: string
  partyName: string
  mode: 'stated' | 'voted'
}

function dimAvg(scores: number[]): number | null {
  return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
}

function toPct(score: number) {
  // [-2, +2] → [0%, 100%]
  return ((score + 2) / 4) * 100
}

function gapColor(gap: number): string {
  if (gap < 0.6) return '#22c55e'  // green
  if (gap < 1.4) return '#f59e0b'  // amber
  return '#ef4444'                  // red
}

export function DimensionGapBars({ userAnswers, partyPositions, partyColor, partyName, mode }: Props) {
  const { t } = useTranslation()
  const { lang } = useSurveyStore()
  const dims = Object.keys(DIMENSIONS) as DimensionKey[]

  return (
    <div className="flex flex-col gap-4">
      {dims.map(dim => {
        const qids = DIMENSIONS[dim].questions as readonly string[]
        const label = lang === 'he' ? DIMENSIONS[dim].label_he : DIMENSIONS[dim].label_en

        const userScores = qids
          .map(qid => userAnswers[qid])
          .filter((v): v is number => v !== null && v !== undefined)
        const partyScores = qids
          .map(qid => {
            const pos = partyPositions.find(p => p.question_id === qid)
            if (!pos) return null
            const s = mode === 'stated'
              ? pos.stated_position?.score
              : (pos.voted_position?.score ?? pos.stated_position?.score)
            return s !== null && s !== undefined ? s : null
          })
          .filter((v): v is number => v !== null)

        const userAvg = dimAvg(userScores)
        const partyAvg = dimAvg(partyScores)

        const userPct = userAvg !== null ? toPct(userAvg) : null
        const partyPct = partyAvg !== null ? toPct(partyAvg) : null
        const gap = userAvg !== null && partyAvg !== null ? Math.abs(userAvg - partyAvg) : null
        const color = gap !== null ? gapColor(gap) : '#d1d5db'

        const gapLeft = userPct !== null && partyPct !== null ? Math.min(userPct, partyPct) : null
        const gapWidth = userPct !== null && partyPct !== null ? Math.abs(userPct - partyPct) : null

        return (
          <div key={dim}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                <span>{DIMENSION_ICONS[dim]}</span>
                {label}
              </span>
              {gap !== null && (
                <span
                  className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ color, backgroundColor: color + '20' }}
                >
                  {gap < 0.3 ? '✓ קרוב' : `פער ${gap.toFixed(1)}`}
                </span>
              )}
            </div>

            {/* Track */}
            <div className="relative h-5 flex items-center">
              {/* Background track */}
              <div className="absolute inset-0 top-1/2 -translate-y-1/2 h-2 bg-gray-100 rounded-full" />
              {/* Center marker */}
              <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gray-300" />

              {/* Gap fill */}
              {gapLeft !== null && gapWidth !== null && gapWidth > 1 && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-2 rounded-full"
                  style={{
                    left: `${gapLeft}%`,
                    width: `${gapWidth}%`,
                    backgroundColor: color,
                    opacity: 0.25,
                  }}
                />
              )}

              {/* User dot */}
              {userPct !== null && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-indigo-500 border-2 border-white shadow z-10"
                  style={{ left: `calc(${userPct}% - 8px)` }}
                  title={t('radar_you')}
                />
              )}

              {/* Party dot */}
              {partyPct !== null && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow z-10"
                  style={{
                    left: `calc(${partyPct}% - 8px)`,
                    backgroundColor: partyColor,
                  }}
                  title={partyName}
                />
              )}
            </div>
          </div>
        )
      })}

      {/* Legend */}
      <div className="flex items-center gap-4 pt-1 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-full bg-indigo-500 inline-block shrink-0" />
          {t('radar_you')}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="w-3.5 h-3.5 rounded-full inline-block shrink-0"
            style={{ backgroundColor: partyColor }}
          />
          {partyName}
        </span>
      </div>
    </div>
  )
}
