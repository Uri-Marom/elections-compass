import { useTranslation } from 'react-i18next'
import type { DimensionKey } from '../../utils/matching'
import { DIMENSIONS } from '../../utils/matching'
import type { PartyPosition, Question } from '../../types'
import { useSurveyStore } from '../../store/survey'

const DIMENSION_ICONS: Record<string, string> = {
  security: '🛡️', religion: '✡️', socioeconomic: '📊',
  judicial: '⚖️', minority: '🤝', governance: '🏛️',
}

function scoreLabel(score: number, t: (k: string) => string): string {
  const rounded = Math.round(score)
  if (rounded === 2)  return t('strongly_agree')
  if (rounded === 1)  return t('agree')
  if (rounded === 0)  return t('neutral')
  if (rounded === -1) return t('disagree')
  if (rounded === -2) return t('strongly_disagree')
  return String(score)
}

function scoreBg(score: number): string {
  if (score >= 1.5) return '#dcfce7'
  if (score >= 0.5) return '#d1fae5'
  if (score > -0.5) return '#f3f4f6'
  if (score > -1.5) return '#fee2e2'
  return '#fecaca'
}

function scoreText(score: number): string {
  if (score >= 0.5) return '#15803d'
  if (score > -0.5) return '#6b7280'
  return '#b91c1c'
}

interface Props {
  dim: DimensionKey
  userAnswers: Record<string, number | null>
  partyPositions: PartyPosition[]
  partyName: string
  partyColor: string
  mode: 'stated' | 'voted'
  questions: Question[]
  onClose: () => void
}

export function DimensionDetailModal({
  dim, userAnswers, partyPositions, partyName, partyColor, mode, questions, onClose,
}: Props) {
  const { t } = useTranslation()
  const { lang } = useSurveyStore()
  const dimLabel = lang === 'he' ? DIMENSIONS[dim].label_he : DIMENSIONS[dim].label_en
  const qids = DIMENSIONS[dim].questions as readonly string[]

  const rows = qids.map(qid => {
    const question = questions.find(q => q.id === qid)
    const userScore = userAnswers[qid] ?? null
    const pos = partyPositions.find(p => p.question_id === qid)
    const partyScore = pos
      ? (mode === 'stated'
          ? pos.stated_position?.score
          : (pos.voted_position?.score ?? pos.stated_position?.score))
      : null
    const source = pos?.stated_position?.source ?? null
    const sourceUrl = pos?.stated_position?.source_url ?? null
    return { qid, question, userScore, partyScore: partyScore ?? null, source, sourceUrl }
  }).filter(r => r.question && (r.userScore !== null || r.partyScore !== null))

  const answeredRows = rows.filter(r => r.userScore !== null && r.partyScore !== null)
  const agreementCount = answeredRows.filter(r =>
    Math.sign(r.userScore!) === Math.sign(r.partyScore!) || (Math.abs(r.userScore! - r.partyScore!) < 1)
  ).length

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <span className="text-lg">{DIMENSION_ICONS[dim]}</span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900 text-sm">{dimLabel}</div>
            <div className="text-xs text-gray-500">
              {lang === 'he'
                ? `${agreementCount} מתוך ${answeredRows.length} שאלות — עמדות קרובות`
                : `${agreementCount} of ${answeredRows.length} questions — close positions`}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Party label row */}
        <div className="flex items-center gap-2 px-5 py-2 bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
          <span className="flex items-center gap-1 w-[45%]">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block shrink-0" />
            {t('radar_you')}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: partyColor }} />
            {partyName}
          </span>
        </div>

        {/* Question rows */}
        <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
          {rows.map(({ qid, question, userScore, partyScore, source, sourceUrl }) => {
            const text = lang === 'he' ? question!.text_he : question!.text_en
            const diffSignificant = userScore !== null && partyScore !== null && Math.abs(userScore - partyScore) >= 1.5

            return (
              <div key={qid} className={`px-5 py-4 ${diffSignificant ? 'bg-red-50/40' : ''}`}>
                <p className="text-sm text-gray-800 mb-3 leading-snug">{text}</p>
                <div className="flex gap-2">
                  {/* User answer */}
                  <div className="flex-1">
                    {userScore !== null ? (
                      <span
                        className="inline-block text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: scoreBg(userScore), color: scoreText(userScore) }}
                      >
                        {scoreLabel(userScore, t)}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 italic">
                        {lang === 'he' ? 'לא ענית' : 'Not answered'}
                      </span>
                    )}
                  </div>

                  {/* Party position */}
                  <div className="flex-1">
                    {partyScore !== null ? (
                      <span
                        className="inline-block text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: scoreBg(partyScore), color: scoreText(partyScore) }}
                      >
                        {scoreLabel(partyScore, t)}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 italic">—</span>
                    )}
                  </div>
                </div>

                {/* Source */}
                {source && (
                  <div className="mt-2 text-xs text-gray-400">
                    {t('source')}: {sourceUrl
                      ? <a href={sourceUrl} target="_blank" rel="noreferrer" className="underline hover:text-gray-600">{source}</a>
                      : source}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
