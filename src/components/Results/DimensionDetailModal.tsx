import { useTranslation } from 'react-i18next'
import type { DimensionKey } from '../../utils/matching'
import { DIMENSIONS } from '../../utils/matching'
import type { PartyPosition, Question } from '../../types'
import { useSurveyStore } from '../../store/survey'
import { B, ACCENT, DIM_COLOR } from '../bureau/BureauComponents'

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
  if (score >= 1.5)  return '#f0fdf4'
  if (score >= 0.5)  return '#ecfef3'
  if (score > -0.5)  return B.bgMid
  if (score > -1.5)  return '#fef2f2'
  return '#fecaca'
}

function scoreText(score: number): string {
  if (score >= 0.5)  return '#15803d'
  if (score > -0.5)  return B.inkFaint
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
  const dimColor = DIM_COLOR[dim] ?? ACCENT

  const rows = qids.map(qid => {
    const question = questions.find(q => q.id === qid)
    const userScore = userAnswers[qid] ?? null
    const pos = partyPositions.find(p => p.question_id === qid)
    const partyScore = pos
      ? (mode === 'stated'
          ? pos.stated_position?.score
          : (pos.voted_position?.score ?? pos.stated_position?.score))
      : null
    const source = (mode === 'voted' && pos?.voted_position?.source)
      ? pos.voted_position.source
      : (pos?.stated_position?.source ?? null)
    const sourceUrl = mode === 'voted' ? null : (pos?.stated_position?.source_url ?? null)
    return { qid, question, userScore, partyScore: partyScore ?? null, source, sourceUrl }
  }).filter(r => r.question && (r.userScore !== null || r.partyScore !== null))

  const answeredRows = rows.filter(r => r.userScore !== null && r.partyScore !== null)
  const agreementCount = answeredRows.filter(r =>
    Math.sign(r.userScore!) === Math.sign(r.partyScore!) || (Math.abs(r.userScore! - r.partyScore!) < 1)
  ).length

  const scorePillStyle = (score: number): React.CSSProperties => ({
    display: 'inline-block', fontSize: 11, fontWeight: 600,
    padding: '2px 8px', borderRadius: 99,
    background: scoreBg(score), color: scoreText(score),
  })

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(10,10,10,0.4)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: 520,
          background: B.white,
          borderRadius: `${B.radiusXl}px ${B.radiusXl}px 0 0`,
          maxHeight: '85dvh',
          display: 'flex', flexDirection: 'column',
          fontFamily: B.font,
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '16px 20px',
          borderBottom: `1px solid ${B.border}`,
          flexShrink: 0,
        }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%', background: dimColor, flexShrink: 0,
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: B.ink }}>{dimLabel}</div>
            <div style={{ fontSize: 11, color: B.inkFaint, marginTop: 1 }}>
              {lang === 'he'
                ? `${agreementCount} מתוך ${answeredRows.length} שאלות — עמדות קרובות`
                : `${agreementCount} of ${answeredRows.length} questions — close positions`}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', fontSize: 20, color: B.inkHint, cursor: 'pointer', padding: 0 }}
            aria-label="Close"
          >×</button>
        </div>

        {/* Party label row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 20px',
          background: B.bg,
          borderBottom: `1px solid ${B.border}`,
          fontSize: 11, color: B.inkFaint,
          flexShrink: 0,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, width: '45%' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: ACCENT, display: 'inline-block', flexShrink: 0 }} />
            {t('radar_you')}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: partyColor, display: 'inline-block', flexShrink: 0 }} />
            {partyName}
          </span>
        </div>

        {/* Question rows */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {rows.map(({ qid, question, userScore, partyScore, source, sourceUrl }) => {
            const text = lang === 'he' ? question!.text_he : question!.text_en
            const diffSignificant = userScore !== null && partyScore !== null && Math.abs(userScore - partyScore) >= 1.5

            return (
              <div
                key={qid}
                style={{
                  padding: '14px 20px',
                  borderBottom: `1px solid ${B.bg}`,
                  background: diffSignificant ? '#fef2f2' : B.white,
                }}
              >
                <p style={{ fontSize: 13, color: B.ink, marginBottom: 10, lineHeight: 1.5 }}>{text}</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    {userScore !== null
                      ? <span style={scorePillStyle(userScore)}>{scoreLabel(userScore, t)}</span>
                      : <span style={{ fontSize: 11, color: B.inkHint, fontStyle: 'italic' }}>{lang === 'he' ? 'לא ענית' : 'Not answered'}</span>
                    }
                  </div>
                  <div style={{ flex: 1 }}>
                    {partyScore !== null
                      ? <span style={scorePillStyle(partyScore)}>{scoreLabel(partyScore, t)}</span>
                      : <span style={{ fontSize: 11, color: B.inkHint, fontStyle: 'italic' }}>—</span>
                    }
                  </div>
                </div>
                {source && (
                  <div style={{ marginTop: 8, fontSize: 11, color: B.inkHint }}>
                    {t('source')}: {sourceUrl
                      ? <a href={sourceUrl} target="_blank" rel="noreferrer" style={{ color: ACCENT, textDecoration: 'underline' }}>{source}</a>
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
