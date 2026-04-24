import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PartyMatch, DimensionKey } from '../../utils/matching'
import { DIMENSIONS } from '../../utils/matching'
import type { Party } from '../../types'
import { useSurveyStore } from '../../store/survey'

interface Props {
  match: PartyMatch
  party: Party
  rank: number
  mode: 'stated' | 'voted'
}

export function PartyCard({ match, party, rank, mode }: Props) {
  const { t } = useTranslation()
  const { lang } = useSurveyStore()
  const [expanded, setExpanded] = useState(false)

  const name = lang === 'he' ? party.name_he : party.name_en
  const score = mode === 'stated' ? match.overall_stated : (match.overall_voted ?? match.overall_stated)
  const otherScore = mode === 'stated' ? match.overall_voted : match.overall_stated
  const hasVotingData = match.overall_voted !== null

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
            style={{ backgroundColor: party.color }}
          >
            {rank}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900">{name}</div>
            <div className="text-xs text-gray-500">
              {party.seats > 0 && `${party.seats} ${t('seats')}`}
              {party.poll_seats !== undefined && (
                <span className="text-gray-400">
                  {party.seats > 0 ? ' ' : ''}{`(${party.poll_seats} ${t('poll_seats')})`}
                </span>
              )}
              {(party.seats > 0 || party.poll_seats !== undefined) && ' · '}
              {t(party.bloc === 'arab' ? 'opposition' : party.bloc)}
            </div>
          </div>
          <div className="text-2xl font-bold" style={{ color: party.color }}>
            {score}%
          </div>
        </div>

        {/* Match bar */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-2 rounded-full transition-all"
                style={{ width: `${score}%`, backgroundColor: party.color }}
              />
            </div>
          </div>

          {/* Divergence indicator */}
          {hasVotingData && otherScore !== null && Math.abs(score - otherScore) >= 5 && (
            <div className="flex items-center gap-1 text-xs text-amber-600">
              <span>⚠</span>
              <span>
                {mode === 'stated' ? t('actual_votes') : t('stated_positions')}: {otherScore}%
                {' '}({t('divergence_label')}: {Math.abs(score - otherScore)}%)
              </span>
            </div>
          )}

          {mode === 'voted' && !hasVotingData && (
            <div className="text-xs text-gray-400">{t('no_voting_data')}</div>
          )}
        </div>

        {/* Expand button */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-xs text-blue-600 hover:underline"
        >
          {expanded ? '▲' : '▼'} {t('dimension_breakdown')}
        </button>
      </div>

      {/* Dimension breakdown */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-2">
          {(Object.keys(DIMENSIONS) as DimensionKey[]).map(dim => {
            const dimScore = mode === 'stated'
              ? match.by_dimension[dim]?.stated
              : (match.by_dimension[dim]?.voted ?? match.by_dimension[dim]?.stated)
            const label = lang === 'he' ? DIMENSIONS[dim].label_he : DIMENSIONS[dim].label_en

            return (
              <div key={dim} className="flex items-center gap-2">
                <div className="text-xs text-gray-600 w-32 shrink-0">{label}</div>
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  {dimScore !== null && dimScore !== undefined && (
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${dimScore}%`, backgroundColor: party.color }}
                    />
                  )}
                </div>
                <div className="text-xs text-gray-500 w-8 text-end">
                  {dimScore !== null && dimScore !== undefined ? `${dimScore}%` : '—'}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
