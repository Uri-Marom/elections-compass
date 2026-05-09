import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { rankParties, type PartyMatch } from '../../utils/matching'
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
}

function getScore(match: PartyMatch, mode: 'stated' | 'voted'): number {
  return mode === 'stated'
    ? match.overall_stated
    : (match.overall_voted ?? match.overall_stated)
}

export function ComparisonPanel({ myAnswers, friendAnswers, allPositions, parties, lang, mode }: Props) {
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
  const sharedTop5 = [...myTop5].filter(id => friendTop5.has(id))

  // Compatibility: fraction of parties in the other's top-5 that match
  const compatibility = Math.round(
    (sharedTop5.length / Math.max(myTop5.size, friendTop5.size, 1)) * 100
  )

  // Build merged ranking: union of both top 8, sorted by combined score
  const friendScoreMap = new Map(friendRanked.map(m => [m.party_id, getScore(m, mode)]))
  const myScoreMap = new Map(myRanked.map(m => [m.party_id, getScore(m, mode)]))

  const unionIds = [...new Set([
    ...myRanked.slice(0, 8).map(m => m.party_id),
    ...friendRanked.slice(0, 8).map(m => m.party_id),
  ])]
  const rows = unionIds
    .map(id => ({
      party_id: id,
      myScore: myScoreMap.get(id) ?? 0,
      friendScore: friendScoreMap.get(id) ?? 0,
    }))
    .sort((a, b) => (b.myScore + b.friendScore) - (a.myScore + a.friendScore))
    .slice(0, 10)

  const isRtl = lang === 'he'

  return (
    <section dir={isRtl ? 'rtl' : 'ltr'} className="bg-white rounded-2xl border border-gray-200 shadow-sm px-4 pt-4 pb-5">
      <h2 className="text-sm font-bold text-gray-900 mb-1">{t('comparison_title')}</h2>

      {/* Compatibility score */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-gray-500">{t('compatibility_score')}:</span>
        <span className={[
          'text-sm font-bold',
          compatibility >= 60 ? 'text-green-600' : compatibility >= 30 ? 'text-amber-500' : 'text-red-500',
        ].join(' ')}>
          {compatibility}%
        </span>
        {sharedTop5.length > 0 && (
          <span className="text-xs text-gray-400">
            {t('comparison_shared')}: {sharedTop5
              .map(id => {
                const p = parties.find(pp => pp.id === id)
                return p ? (lang === 'he' ? p.name_he : p.name_en) : id
              })
              .join(', ')}
          </span>
        )}
      </div>

      {/* Side-by-side table */}
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1.5 items-center">
        {/* Header */}
        <div className="text-xs text-gray-400" />
        <div className="text-xs font-semibold text-blue-600 text-center">{t('comparison_you')}</div>
        <div className="text-xs font-semibold text-purple-600 text-center">{t('comparison_friend')}</div>

        {rows.map(row => {
          const party = parties.find(p => p.id === row.party_id)
          if (!party) return null
          const name = lang === 'he' ? party.name_he : party.name_en
          const both = myTop5.has(row.party_id) && friendTop5.has(row.party_id)

          return (
            <div key={row.party_id} className="contents">
              <div className="flex items-center gap-1.5 min-w-0">
                {both && (
                  <span className="text-green-500 text-xs shrink-0">✓</span>
                )}
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: party.color }}
                />
                <span className="text-xs text-gray-700 truncate">{name}</span>
              </div>
              <div
                className="text-xs font-semibold text-center"
                style={{ color: '#2563eb' }}
              >
                {row.myScore}%
              </div>
              <div
                className="text-xs font-semibold text-center"
                style={{ color: '#9333ea' }}
              >
                {row.friendScore}%
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
