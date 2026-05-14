import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { rankParties, type PartyMatch, DIMENSIONS, type DimensionKey } from '../../utils/matching'
import type { Party, PartyPosition, DimensionWeights } from '../../types'
import { B, ACCENT } from '../bureau/BureauComponents'

const FRIEND_COLOR = '#9333ea'

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
  return mode === 'stated' ? match.overall_stated : (match.overall_voted ?? match.overall_stated)
}

export function ComparisonPanel({ myAnswers, friendAnswers, allPositions, parties, lang, mode, myDimScores, friendDimScores }: Props) {
  const { t } = useTranslation()

  const myRanked  = useMemo(() => rankParties(myAnswers, allPositions, DEFAULT_WEIGHTS), [myAnswers, allPositions])
  const friendRanked = useMemo(() => rankParties(friendAnswers, allPositions, DEFAULT_WEIGHTS), [friendAnswers, allPositions])

  const myTop5 = new Set(myRanked.slice(0, 5).map(m => m.party_id))
  const friendTop5 = new Set(friendRanked.slice(0, 5).map(m => m.party_id))

  const sharedCount = [...myTop5].filter(id => friendTop5.has(id)).length
  const compatibility = Math.round((sharedCount / Math.max(myTop5.size, friendTop5.size, 1)) * 100)

  const friendScoreMap = new Map(friendRanked.map(m => [m.party_id, getScore(m, mode)]))
  const sharedRows = myRanked
    .filter(m => myTop5.has(m.party_id) && friendTop5.has(m.party_id))
    .map(m => ({ party_id: m.party_id, myScore: getScore(m, mode), friendScore: friendScoreMap.get(m.party_id) ?? 0 }))
    .sort((a, b) => (b.myScore + b.friendScore) - (a.myScore + a.friendScore))

  const dimKeys = Object.keys(DIMENSIONS) as DimensionKey[]
  const dimDiffs = (myDimScores && friendDimScores)
    ? dimKeys.map(dim => ({
        dim,
        label: lang === 'he' ? DIMENSIONS[dim].label_he : DIMENSIONS[dim].label_en,
        diff: Math.abs((myDimScores[dim] ?? 50) - (friendDimScores[dim] ?? 50)),
      }))
    : []

  const agreeDims    = dimDiffs.filter(d => d.diff < 12).slice(0, 3)
  const disagreeDims = [...dimDiffs].sort((a, b) => b.diff - a.diff).filter(d => d.diff > 25).slice(0, 3)

  const compatColor = compatibility >= 60 ? '#16a34a' : compatibility >= 30 ? '#d97706' : '#dc2626'
  const isRtl = lang === 'he'

  return (
    <section
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        background: B.white, border: `1px solid ${B.border}`,
        borderRadius: B.radiusLg, padding: '16px 16px 20px',
        display: 'flex', flexDirection: 'column', gap: 14,
        fontFamily: B.font,
      }}
    >
      <h2 style={{ fontSize: 13, fontWeight: 700, color: B.ink, margin: 0 }}>{t('comparison_title')}</h2>

      {/* Compatibility score */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: B.inkFaint }}>{t('compatibility_score')}:</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: compatColor }}>{compatibility}%</span>
      </div>

      {/* Verbal summary */}
      {dimDiffs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {agreeDims.length > 0 && (
            <div style={{ fontSize: 12, color: B.inkSoft }}>
              <span style={{ fontWeight: 700, color: '#15803d' }}>{t('you_both_agree')}</span>{' '}
              {agreeDims.map(d => d.label).join(isRtl ? '، ' : ', ')}
            </div>
          )}
          {disagreeDims.length > 0 && (
            <div style={{ fontSize: 12, color: B.inkSoft }}>
              <span style={{ fontWeight: 700, color: '#dc2626' }}>{t('you_disagree')}</span>{' '}
              {disagreeDims.map(d => d.label).join(isRtl ? '، ' : ', ')}
            </div>
          )}
        </div>
      )}

      {/* Shared top-5 table */}
      <div>
        <p style={{ fontSize: 11, color: B.inkHint, marginBottom: 8 }}>{t('comparison_shared_top5')}</p>

        {sharedRows.length === 0 ? (
          <p style={{ fontSize: 12, color: B.inkHint, fontStyle: 'italic' }}>{t('comparison_no_shared')}</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', columnGap: 12, rowGap: 8, alignItems: 'center' }}>
            {/* Header */}
            <div />
            <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, textAlign: 'center' }}>{t('comparison_you')}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: FRIEND_COLOR, textAlign: 'center' }}>{t('comparison_friend')}</div>

            {sharedRows.map(row => {
              const party = parties.find(p => p.id === row.party_id)
              if (!party) return null
              const name = lang === 'he' ? party.name_he : party.name_en
              return (
                <div key={row.party_id} style={{ display: 'contents' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: party.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: B.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {name}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, textAlign: 'center', color: ACCENT }}>{row.myScore}%</div>
                  <div style={{ fontSize: 12, fontWeight: 700, textAlign: 'center', color: FRIEND_COLOR }}>{row.friendScore}%</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
