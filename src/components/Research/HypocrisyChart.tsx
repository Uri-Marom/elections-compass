import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { HypocrisyResult } from '../../utils/research'
import type { Party, Question } from '../../types'

interface Props {
  results: HypocrisyResult[]
  parties: Party[]
  questions: Question[]
  lang: 'he' | 'en'
}

function scoreColor(score: number): string {
  if (score < 15) return '#22c55e'
  if (score < 30) return '#f59e0b'
  return '#ef4444'
}

function ScoreLabel({ score }: { score: number }) {
  const color = scoreColor(score)
  return (
    <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: color }}>
      {Math.round(score)}
    </span>
  )
}

export function HypocrisyChart({ results, parties, questions, lang }: Props) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState<string | null>(null)

  const withData = results.filter(r => r.coverage > 0)
  const noData = results.filter(r => r.coverage === 0)

  function getParty(id: string) {
    return parties.find(p => p.id === id)
  }

  function getQuestion(qid: string) {
    return questions.find(q => q.id === qid)
  }

  function formatScore(s: number): string {
    const labels = lang === 'he'
      ? ['מתנגד בחוזקה', 'מתנגד', 'ניטרלי', 'תומך', 'תומך בחוזקה']
      : ['Strongly Against', 'Against', 'Neutral', 'In Favor', 'Strongly In Favor']
    const idx = Math.round(s + 2)
    return labels[Math.min(Math.max(idx, 0), 4)]
  }

  return (
    <div className="space-y-2">
      {withData.map(result => {
        const party = getParty(result.party_id)
        if (!party) return null
        const name = lang === 'he' ? party.name_he : party.name_en
        const isExpanded = expanded === result.party_id
        const pct = Math.round(result.coverage * 100)

        return (
          <div key={result.party_id} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
            <button
              onClick={() => setExpanded(isExpanded ? null : result.party_id)}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
            >
              {/* Party color dot */}
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: party.color }} />

              {/* Party name */}
              <span className="flex-1 text-sm font-medium text-gray-900 text-start">{name}</span>

              {/* Coverage */}
              <span className="text-xs text-gray-400 shrink-0">{t('hypocrisy_coverage', { pct })}</span>

              {/* Score badge */}
              <ScoreLabel score={result.score} />

              {/* Bar */}
              <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden shrink-0">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${result.score}%`,
                    backgroundColor: scoreColor(result.score),
                  }}
                />
              </div>

              <span className="text-gray-400 text-xs shrink-0">{isExpanded ? '▲' : '▼'}</span>
            </button>

            {isExpanded && result.topGaps.length > 0 && (
              <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 mt-3 mb-2">{t('top_gaps')}</p>
                <div className="space-y-2">
                  {result.topGaps.map(gap => {
                    const q = getQuestion(gap.question_id)
                    if (!q) return null
                    const text = lang === 'he' ? q.text_he : q.text_en
                    return (
                      <div key={gap.question_id} className="bg-white rounded-lg p-3 border border-gray-200">
                        <p className="text-xs text-gray-700 mb-2 leading-relaxed line-clamp-2">{text}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-gray-400">{t('gap_stated')}:</span>
                          <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                            {formatScore(gap.stated)}
                          </span>
                          <span className="text-gray-300">→</span>
                          <span className="text-xs text-gray-400">{t('gap_voted')}:</span>
                          <span className="text-xs font-medium text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">
                            {formatScore(gap.voted)}
                          </span>
                          <span className="ms-auto text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                            {t('gap_label')} {gap.gap.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {noData.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-gray-400 mb-2">{t('no_data_parties')}</p>
          <div className="flex flex-wrap gap-2">
            {noData.map(r => {
              const party = getParty(r.party_id)
              if (!party) return null
              const name = lang === 'he' ? party.name_he : party.name_en
              return (
                <span key={r.party_id} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full text-xs text-gray-500">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: party.color }} />
                  {name}
                  <span className="text-gray-400">— {t('hypocrisy_na')}</span>
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
