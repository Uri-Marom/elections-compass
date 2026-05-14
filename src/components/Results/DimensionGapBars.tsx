import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DIMENSIONS, type DimensionKey } from '../../utils/matching'
import type { PartyPosition, Question } from '../../types'
import { useSurveyStore } from '../../store/survey'
import { DimensionDetailModal } from './DimensionDetailModal'
import { B, ACCENT, DIM_COLOR } from '../bureau/BureauComponents'

const FRIEND_COLOR = '#9333ea'

interface Props {
  userAnswers: Record<string, number | null>
  partyPositions: PartyPosition[]
  partyColor: string
  partyName: string
  mode: 'stated' | 'voted'
  questions: Question[]
  friendAnswers?: Record<string, number | null> | null
}

function dimAvg(scores: number[]): number | null {
  return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
}

function toPct(score: number) { return ((score + 2) / 4) * 100 }

function gapColor(gap: number): string {
  if (gap < 0.6) return '#16a34a'
  if (gap < 1.4) return '#d97706'
  return '#dc2626'
}

export function DimensionGapBars({ userAnswers, partyPositions, partyColor, partyName, mode, questions, friendAnswers }: Props) {
  const { t } = useTranslation()
  const { lang } = useSurveyStore()
  const dims = Object.keys(DIMENSIONS) as DimensionKey[]
  const [activeDim, setActiveDim] = useState<DimensionKey | null>(null)

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: B.font }}>
        {dims.map(dim => {
          const qids = DIMENSIONS[dim].questions as readonly string[]
          const label = lang === 'he' ? DIMENSIONS[dim].label_he : DIMENSIONS[dim].label_en
          const dimColor = DIM_COLOR[dim]

          const paired = qids.flatMap(qid => {
            const userScore = userAnswers[qid]
            if (userScore === null || userScore === undefined) return []
            const pos = partyPositions.find(p => p.question_id === qid)
            if (!pos) return []
            const partyScore = mode === 'stated'
              ? pos.stated_position?.score
              : (pos.voted_position?.score ?? pos.stated_position?.score)
            if (partyScore === null || partyScore === undefined) return []
            const polarity = questions.find(q => q.id === qid)?.polarity ?? 1
            return [{ user: userScore, party: partyScore, polarity }]
          })

          const userAvg  = paired.length > 0 ? dimAvg(paired.map(p => p.user * p.polarity)) : null
          const partyAvg = paired.length > 0 ? dimAvg(paired.map(p => p.party * p.polarity)) : null
          const userPct  = userAvg  !== null ? toPct(userAvg)  : null
          const partyPct = partyAvg !== null ? toPct(partyAvg) : null

          const friendScores = friendAnswers
            ? qids.flatMap(qid => {
                const fv = friendAnswers[qid]
                if (fv === null || fv === undefined) return []
                const polarity = questions.find(q => q.id === qid)?.polarity ?? 1
                return [fv * polarity]
              })
            : []
          const friendAvg = friendScores.length > 0 ? dimAvg(friendScores) : null
          const friendPct = friendAvg !== null ? toPct(friendAvg) : null

          const gap = paired.length > 0
            ? paired.reduce((sum, p) => sum + Math.abs(p.user - p.party), 0) / paired.length
            : null
          const color = gap !== null ? gapColor(gap) : B.borderMid

          const gapLeft  = userPct !== null && partyPct !== null ? Math.min(userPct, partyPct) : null
          const gapWidth = userPct !== null && partyPct !== null ? Math.abs(userPct - partyPct) : null
          const isClickable = gap !== null && gap >= 0.3

          return (
            <div key={dim}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: dimColor, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {label}
                </span>
                {gap !== null && (
                  <button
                    onClick={() => isClickable && setActiveDim(dim)}
                    style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                      border: 'none', cursor: isClickable ? 'pointer' : 'default',
                      color, background: `${color}18`,
                      fontFamily: B.font, opacity: 1,
                    }}
                    title={isClickable ? (lang === 'he' ? 'לחץ להסבר' : 'Click to explain') : undefined}
                  >
                    {gap < 0.3 ? '✓ קרוב' : `פער ${gap.toFixed(1)} ↗`}
                  </button>
                )}
              </div>

              {/* Track */}
              <div style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
                {/* Background */}
                <div style={{
                  position: 'absolute', inset: 0, top: '50%', transform: 'translateY(-50%)',
                  height: 6, background: B.bgMid, borderRadius: 99,
                }} />
                {/* Centre marker */}
                <div style={{
                  position: 'absolute', top: 0, bottom: 0, left: '50%',
                  width: 1, background: B.borderMid,
                }} />
                {/* Gap fill */}
                {gapLeft !== null && gapWidth !== null && gapWidth > 1 && (
                  <div style={{
                    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                    height: 6, borderRadius: 99,
                    left: `${gapLeft}%`, width: `${gapWidth}%`,
                    background: color, opacity: 0.22,
                  }} />
                )}
                {/* User dot */}
                {userPct !== null && (
                  <div style={{
                    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                    width: 16, height: 16, borderRadius: '50%',
                    background: ACCENT, border: `2px solid ${B.white}`,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.15)', zIndex: 10,
                    left: `calc(${userPct}% - 8px)`,
                  }} title={t('radar_you')} />
                )}
                {/* Party dot */}
                {partyPct !== null && (
                  <div style={{
                    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                    width: 16, height: 16, borderRadius: '50%',
                    background: partyColor, border: `2px solid ${B.white}`,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.15)', zIndex: 10,
                    left: `calc(${partyPct}% - 8px)`,
                  }} title={partyName} />
                )}
                {/* Friend dot — diamond */}
                {friendPct !== null && (
                  <div style={{
                    position: 'absolute', top: '50%', transform: 'translateY(-50%) rotate(45deg)',
                    width: 13, height: 13,
                    background: FRIEND_COLOR, border: `2px solid ${B.white}`,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.15)', zIndex: 10,
                    left: `calc(${friendPct}% - 6.5px)`,
                  }} title={t('comparison_friend')} />
                )}
              </div>
            </div>
          )
        })}

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 4, fontSize: 11, color: B.inkFaint, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 13, height: 13, borderRadius: '50%', background: ACCENT, display: 'inline-block', flexShrink: 0 }} />
            {t('radar_you')}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 13, height: 13, borderRadius: '50%', background: partyColor, display: 'inline-block', flexShrink: 0 }} />
            {partyName}
          </span>
          {friendAnswers && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 11, height: 11, background: FRIEND_COLOR, display: 'inline-block', flexShrink: 0, transform: 'rotate(45deg)' }} />
              {t('comparison_friend')}
            </span>
          )}
        </div>
      </div>

      {activeDim && (
        <DimensionDetailModal
          dim={activeDim}
          userAnswers={userAnswers}
          partyPositions={partyPositions}
          partyName={partyName}
          partyColor={partyColor}
          mode={mode}
          questions={questions}
          onClose={() => setActiveDim(null)}
        />
      )}
    </>
  )
}
