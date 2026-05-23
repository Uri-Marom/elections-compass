import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Question } from '../../types'
import { useSurveyStore } from '../../store/survey'
import { LearnMoreModal } from './LearnMoreModal'
import { CompassRose, B, DIM_COLOR } from '../bureau/BureauComponents'
import { DIMENSIONS, type DimensionKey } from '../../utils/matching'

interface Props {
  question: Question
  questionNumber: number
  totalQuestions: number
  onSelect: () => void
}

const LIKERT: { score: number; key: string }[] = [
  { score:  2, key: 'strongly_agree'    },
  { score:  1, key: 'agree'             },
  { score:  0, key: 'neutral'           },
  { score: -1, key: 'disagree'          },
  { score: -2, key: 'strongly_disagree' },
]

function getDimForQuestion(qid: string): DimensionKey | undefined {
  return (Object.keys(DIMENSIONS) as DimensionKey[]).find(dim =>
    (DIMENSIONS[dim].questions as readonly string[]).includes(qid)
  )
}

export function QuestionCard({ question, questionNumber, totalQuestions, onSelect }: Props) {
  const { t } = useTranslation()
  const { answers, setAnswer, lang } = useSurveyStore()
  const [showInfo, setShowInfo] = useState(false)

  const current = answers[question.id]
  const text = lang === 'he' ? question.text_he : question.text_en
  const dim = getDimForQuestion(question.id)
  const color = dim ? DIM_COLOR[dim] : B.accent

  function handleSelect(score: number) {
    setAnswer(question.id, score)
    setTimeout(onSelect, 240)
  }

  function handleSkip() {
    setAnswer(question.id, null)
    onSelect()
  }

  return (
    <div style={{
      width: '100%',
      maxWidth: 480,
      padding: '0 20px',
    }}>
      {/* Question label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
        <CompassRose size={18} color={B.inkHint} accent={color} lang={lang} />
        <span style={{
          fontSize: 11,
          color: B.inkHint,
          fontFamily: 'ui-monospace, monospace',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}>
          {t('question_of', { current: questionNumber, total: totalQuestions })}
        </span>
      </div>

      {/* Question text */}
      <p style={{
        fontSize: 19,
        fontWeight: 600,
        color: B.ink,
        lineHeight: 1.45,
        marginBottom: 8,
      }}>
        {text}
      </p>

      {/* Learn more */}
      {(question.agree_en || question.agree_he || question.disagree_en || question.disagree_he) && (
        <button
          onClick={() => setShowInfo(true)}
          style={{
            marginBottom: 24,
            padding: 0,
            border: 'none',
            background: 'transparent',
            fontSize: 12,
            color,
            cursor: 'pointer',
            textDecoration: 'underline',
            textDecorationColor: `${color}55`,
          }}
        >
          {t('learn_more')}
        </button>
      )}

      {!question.agree_en && !question.agree_he && !question.disagree_en && !question.disagree_he && (
        <div style={{ marginBottom: 24 }} />
      )}

      {/* 5-point scale */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {LIKERT.map(({ score, key }) => {
          const isSel = current === score
          return (
            <button
              key={score}
              className="ans-btn"
              onClick={() => handleSelect(score)}
              style={{
                padding: '13px 16px',
                borderRadius: 12,
                border: `1.5px solid ${isSel ? color : B.border}`,
                background: isSel ? `${color}10` : B.white,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                textAlign: 'start',
                cursor: 'pointer',
              }}
            >
              {/* Radio dot */}
              <div style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                border: `2px solid ${isSel ? color : B.borderMid}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {isSel && (
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                )}
              </div>
              <span style={{
                fontSize: 14,
                fontWeight: isSel ? 700 : 400,
                color: isSel ? B.ink : '#3f3f46',
              }}>
                {t(key)}
              </span>
            </button>
          )
        })}
      </div>

      {/* Skip */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 20 }}>
        <button
          onClick={handleSkip}
          style={{
            padding: '8px 16px',
            border: 'none',
            background: 'transparent',
            fontSize: 13,
            color: B.inkHint,
            textDecoration: 'underline',
            textDecorationColor: B.border,
            cursor: 'pointer',
          }}
        >
          {t('skip_question')}
        </button>
      </div>

      {showInfo && (
        <LearnMoreModal question={question} onClose={() => setShowInfo(false)} />
      )}
    </div>
  )
}
