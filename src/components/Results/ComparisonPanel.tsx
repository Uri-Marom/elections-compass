import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { rankParties, type PartyMatch, DIMENSIONS, type DimensionKey } from '../../utils/matching'
import type { Party, PartyPosition, DimensionWeights } from '../../types'

const DEFAULT_WEIGHTS: DimensionWeights = {
  security: 1, religion: 1, socioeconomic: 1, judicial: 1, minority: 1, governance: 1,
}

interface Props {
  myAnswers: Record<string, number | null>
  friendAnswers: Record<string, number | null>
  allPositions: Record<string, PartyPosition[]>
  parties: Party[]
  lang: 'he' | 'en'
  mode: 'stated' | 'voted'
  myDimScores?: Record<DimensionKey, number> | null
  friendDimScores?: Record<DimensionKey, number> | null
}

function getScore(match: PartyMatch, mode: 'stated' | 'voted'): number {
  return mode === 'stated'
    ? match.overall_stated
    : (match.overall_voted ?? match.overall_stated)
}

export function ComparisonPanel({ myAnswers, friendAnswers, allPositions, parties, lang, mode, myDimScores, friendDimScores }: Props) {
  const { t } = useTranslation()

  const myRanked = useMemo(
    () => rankParties(myAnswers, allPositions, DEFAULT_WEIGHTS),
    [myAnswers, allPositions]
  )

  const friendRanked = useMemo(
    () => rankParties(friendAnswers, allPositions, DEFAULT_WEIGHTS),
    [friendAnswers, allPositions]
  )

  const myTop5 = new Set(myRanked.slice(0, 5).map(m => m.party_id))
  const friendTop5 = new Set(friendRanked.slice(0, 5).map(m => m.party_id))

  // Compatibility: fraction of parties in the other's top-5 that match
  const sharedCount = [...myTop5].filter(id => friendTop5.has(id)).length
  const compatibility = Math.round((sharedCount / Math.max(myTop5.size, friendTop5.size, 1)) * 100)

  // Only parties in BOTH top 5s, sorted by combined score
  const friendScoreMap = new Map(friendRanked.map(m => [m.party_id, getScore(m, mode)]))

  const sharedRows = myRanked
    .filter(m => myTop5.has(m.party_id) && friendTop5.has(m.party_id))
    .map(m => ({
      party_id: m.party_id,
      myScore: getScore(m, mode),
      friendScore: friendScoreMap.get(m.party_id) ?? 0,
    }))
    .sort((a, b) => (b.myScore + b.friendScore) - (a.myScore + a.friendScore))

  // Verbal summary: agree/disagree by dimension
  const dimKeys = Object.keys(DIMENSIONS) as DimensionKey[]
  const dimDiffs = (myDimScores && friendDimScores)
    ? dimKeys.map(dim => ({
        dim,
        label: lang === 'he' ? DIMENSIONS[dim].label_he : DIMENSIONS[dim].label_en,
        diff: Math.abs((myDimScores[dim] ?? 50) - (friendDimScores[dim] ?? 50)),
      }))
    : []

  const agreeDims = dimDiffs.filter(d => d.diff < 12).slice(0, 3)
  const disagreeDims = [...dimDiffs].sort((a, b) => b.diff - a.diff).filter(d => d.diff > 25).slice(0, 3)

  const isRtl = lang === 'he'

  return (
    <section dir={isRtl ? 'rtl' : 'ltr'} className="bg-white rounded-2xl border border-gray-200 shadow-sm px-4 pt-4 pb-5 space-y-4">
      <h2 className="text-sm font-bold text-gray-900">{t('comparison_title')}</h2>

      {/* Compatibility score */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">{t('compatibility_score')}:</span>
        <span className={[
          'text-sm font-bold',
          compatibility >= 60 ? 'text-green-600' : compatibility >= 30 ? 'text-amber-500' : 'text-red-500',
        ].join(' ')}>
          {compatibility}%
        </span>
      </div>

      {/* Verbal summary */}
      {dimDiffs.length > 0 && (
        <div className="space-y-2">
          {agreeDims.length > 0 && (
            <div className="text-xs text-gray-600">
              <span className="font-semibold text-green-700">{t('you_both_agree')}</span>{' '}
              {agreeDims.map(d => d.label).join(` ${isRtl ? '،' : ','} `)}
            </div>
          )}
          {disagreeDims.length > 0 && (
            <div className="text-xs text-gray-600">
              <span className="font-semibold text-red-600">{t('you_disagree')}</span>{' '}
              {disagreeDims.map(d => d.label).join(` ${isRtl ? '،' : ','} `)}
            </div>
          )}
        </div>
      )}

      {/* Shared top 5 table */}
      <div>
        <p className="text-xs text-gray-400 mb-2">{t('comparison_shared_top5')}</p>

        {sharedRows.length === 0 ? (
          <p className="text-xs text-gray-400 italic">{t('comparison_no_shared')}</p>
        ) : (
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1.5 items-center">
            {/* Header */}
            <div className="text-xs text-gray-400" />
            <div className="text-xs font-semibold text-blue-600 text-center">{t('comparison_you')}</div>
            <div className="text-xs font-semibold text-purple-600 text-center">{t('comparison_friend')}</div>

            {sharedRows.map(row => {
              const party = parties.find(p => p.id === row.party_id)
              if (!party) return null
              const name = lang === 'he' ? party.name_he : party.name_en

              return (
                <div key={row.party_id} className="contents">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: party.color }}
                    />
                    <span className="text-xs text-gray-700 truncate">{name}</span>
                  </div>
                  <div className="text-xs font-semibold text-center" style={{ color: '#2563eb' }}>
                    {row.myScore}%
                  </div>
                  <div className="text-xs font-semibold text-center" style={{ color: '#9333ea' }}>
                    {row.friendScore}%
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
