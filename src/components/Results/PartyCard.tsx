import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PartyMatch, DimensionKey } from '../../utils/matching'
import { DIMENSIONS } from '../../utils/matching'
import type { Party } from '../../types'
import { useSurveyStore } from '../../store/survey'
import { B, ACCENT, DIM_COLOR } from '../bureau/BureauComponents'

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
    <div style={{
      background: B.white,
      border: `1px solid ${B.border}`,
      borderRadius: B.radiusLg,
      overflow: 'hidden',
      fontFamily: B.font,
    }}>
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          {/* Rank badge */}
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: party.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 13, fontWeight: 800, flexShrink: 0,
          }}>
            {rank}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: B.ink }}>{name}</div>
            <div style={{ fontSize: 12, color: B.inkFaint, marginTop: 1 }}>
              {party.seats > 0 && `${party.seats} ${t('seats')}`}
              {party.poll_seats !== undefined && (
                <span style={{ color: B.inkHint }}>
                  {party.seats > 0 ? ' ' : ''}{`(${party.poll_seats} ${t('poll_seats')})`}
                </span>
              )}
              {(party.seats > 0 || party.poll_seats !== undefined) && ' · '}
              {t(party.bloc === 'arab' ? 'opposition' : party.bloc)}
            </div>
          </div>

          <div style={{ fontSize: 22, fontWeight: 900, color: party.color, flexShrink: 0 }}>
            {score}%
          </div>
        </div>

        {/* Match bar */}
        <div style={{ marginBottom: 4 }}>
          <div style={{
            height: 6, background: B.bgMid, borderRadius: 99, overflow: 'hidden',
          }}>
            <div style={{
              height: 6, borderRadius: 99,
              width: `${score}%`, background: party.color,
              transition: 'width 0.4s',
            }} />
          </div>

          {hasVotingData && otherScore !== null && Math.abs(score - otherScore) >= 5 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 12, color: '#d97706' }}>
              <span>⚠</span>
              <span>
                {mode === 'stated' ? t('actual_votes') : t('stated_positions')}: {otherScore}%
                {' '}({t('divergence_label')}: {Math.abs(score - otherScore)}%)
              </span>
            </div>
          )}

          {mode === 'voted' && !hasVotingData && (
            <div style={{ fontSize: 12, color: B.inkHint, marginTop: 4 }}>{t('no_voting_data')}</div>
          )}
        </div>

        {/* Expand */}
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            marginTop: 10, padding: 0, border: 'none', background: 'transparent',
            fontSize: 12, color: ACCENT, cursor: 'pointer', fontFamily: B.font,
          }}
        >
          {expanded ? '▲' : '▼'} {t('dimension_breakdown')}
        </button>
      </div>

      {/* Dimension breakdown */}
      {expanded && (
        <div style={{
          borderTop: `1px solid ${B.border}`,
          padding: 16,
          background: B.bg,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {(Object.keys(DIMENSIONS) as DimensionKey[]).map(dim => {
            const dimScore = mode === 'stated'
              ? match.by_dimension[dim]?.stated
              : (match.by_dimension[dim]?.voted ?? match.by_dimension[dim]?.stated)
            const label = lang === 'he' ? DIMENSIONS[dim].label_he : DIMENSIONS[dim].label_en
            const dimColor = DIM_COLOR[dim] ?? party.color

            return (
              <div key={dim} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 11, color: dimColor, width: 88, flexShrink: 0, fontWeight: 600 }}>{label}</div>
                <div style={{ flex: 1, height: 5, background: B.bgMid, borderRadius: 99, overflow: 'hidden' }}>
                  {dimScore !== null && dimScore !== undefined && (
                    <div style={{ height: 5, borderRadius: 99, width: `${dimScore}%`, background: dimColor }} />
                  )}
                </div>
                <div style={{ fontSize: 11, color: B.inkFaint, width: 28, textAlign: 'end', flexShrink: 0 }}>
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
