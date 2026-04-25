import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSurveyStore } from '../../store/survey'
import type { MKMatch, KnessetMember, Party } from '../../types'

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-green-50 text-green-700 border-green-200',
  B: 'bg-blue-50 text-blue-700 border-blue-200',
  C: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  D: 'bg-orange-50 text-orange-700 border-orange-200',
  F: 'bg-red-50 text-red-700 border-red-200',
}

interface Props {
  topMKs: MKMatch[]
  mks: KnessetMember[]
  parties: Party[]
}

export function MKMatchList({ topMKs, mks, parties }: Props) {
  const { t } = useTranslation()
  const { lang } = useSurveyStore()
  const [expanded, setExpanded] = useState(false)

  const visible = topMKs.slice(0, 10)
  if (visible.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
      >
        <div>
          <p className="text-sm font-semibold text-gray-900">{t('mk_matches')}</p>
          <p className="text-xs text-gray-400 mt-0.5">{t('mk_matches_subtitle')}</p>
        </div>
        <span className="text-xs text-gray-400 shrink-0 ms-2">
          {expanded ? t('mk_matches_hide') : t('mk_matches_show')}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {visible.map((match, i) => {
            const mk = mks.find(m => m.id === match.mk_id)
            if (!mk) return null
            const party = parties.find(p => p.id === mk.party_id)
            const name = lang === 'he' ? mk.name_he : (mk.name_en || mk.name_he)

            return (
              <div key={match.mk_id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-xs font-bold text-gray-400 w-5 text-center shrink-0">{i + 1}</span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 truncate">{name}</span>
                    {mk.activity_grade && (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded-full border font-semibold shrink-0 ${GRADE_COLORS[mk.activity_grade] ?? ''}`}
                        title={`${mk.attendance_pct}% attendance · ${mk.bill_count} bills`}
                      >
                        {mk.activity_grade}
                      </span>
                    )}
                    {mk.is_current && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100 shrink-0">
                        {t('current_mk')}
                      </span>
                    )}
                  </div>
                  {party && (
                    <span
                      className="text-xs font-medium mt-0.5 inline-block"
                      style={{ color: party.color }}
                    >
                      {lang === 'he' ? party.name_he : party.name_en}
                    </span>
                  )}
                </div>

                <div className="flex flex-col items-end shrink-0">
                  <span
                    className="text-sm font-bold"
                    style={{ color: party?.color ?? '#888' }}
                  >
                    {match.overall}%
                  </span>
                  <span className="text-xs text-gray-400">{t('coverage_questions', { n: match.question_count })}</span>
                </div>
              </div>
            )
          })}

          <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-400">{t('data_note_knessets')}</span>
          </div>
        </div>
      )}
    </div>
  )
}
