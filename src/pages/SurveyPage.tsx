import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { QuestionCard } from '../components/Survey/QuestionCard'
import { LanguageSwitcher } from '../components/shared/LanguageSwitcher'
import { useSurveyStore } from '../store/survey'
import { DIMENSIONS, type DimensionKey } from '../utils/matching'
import { CompassRose, GridPaper, B, ACCENT, DIM_COLOR, DIM_REGION } from '../components/bureau/BureauComponents'
import questionsData from '../data/questions.json'
import type { Question } from '../types'

const questions = questionsData as Question[]

const DIM_KEYS = Object.keys(DIMENSIONS) as DimensionKey[]

// Flatten questions in dimension order
const orderedQuestions: Question[] = DIM_KEYS.flatMap(dim =>
  (DIMENSIONS[dim].questions as readonly string[])
    .map(qid => questions.find(q => q.id === qid)!)
    .filter(Boolean)
)

function getDimForQuestion(qid: string): DimensionKey {
  return DIM_KEYS.find(dim =>
    (DIMENSIONS[dim].questions as readonly string[]).includes(qid)
  ) ?? DIM_KEYS[0]
}

// ── Dimension transition screen ───────────────────────────────────────────────

interface TransitionScreenProps {
  dim: DimensionKey
  dimIdx: number       // 0-based
  totalDims: number
  lang: 'he' | 'en'
  onContinue: () => void
  currentQIdx: number
  totalQ: number
}

function DimensionTransitionScreen({
  dim, dimIdx, totalDims, lang, onContinue, currentQIdx, totalQ,
}: TransitionScreenProps) {
  const { t } = useTranslation()
  const color = DIM_COLOR[dim]
  const region = DIM_REGION[dim]
  const dimQCount = DIMENSIONS[dim].questions.length
  const progress = currentQIdx / totalQ

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      background: `${color}08`,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <GridPaper color={color} opacity={0.06} dotSize={28} />

      {/* Compass watermark */}
      <div style={{
        position: 'absolute',
        top: '12%',
        left: '50%',
        transform: 'translateX(-50%)',
        opacity: 0.15,
        pointerEvents: 'none',
      }}>
        <CompassRose size={240} color={color} accent={color} lang={lang} />
      </div>

      {/* Center content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 32px 24px',
        textAlign: 'center',
        position: 'relative',
        zIndex: 1,
        maxWidth: 480,
        width: '100%',
        margin: '0 auto',
      }}>
        <div style={{
          display: 'inline-block',
          padding: '5px 14px',
          background: `${color}1a`,
          borderRadius: 99,
          fontSize: 11,
          fontWeight: 700,
          color,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          marginBottom: 18,
        }}>
          {lang === 'he' ? `תחום ${dimIdx + 1}/${totalDims}` : `Topic ${dimIdx + 1}/${totalDims}`}
        </div>

        <h1 style={{
          fontSize: 40,
          fontWeight: 900,
          color: B.ink,
          letterSpacing: '-0.025em',
          lineHeight: 0.95,
          marginBottom: 12,
        }}>
          {t(`dimension_${dim}`)}
        </h1>

        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: 10,
          fontFamily: 'ui-monospace, monospace',
        }}>
          {`· ${lang === 'he' ? region.he : region.en} ·`}
        </div>

        <p style={{ fontSize: 14, color: B.inkSoft, lineHeight: 1.6 }}>
          {lang === 'he'
            ? `${dimQCount} שאלות בתחום זה`
            : `${dimQCount} questions in this area`}
        </p>
      </div>

      {/* Bottom */}
      <div style={{
        padding: '0 24px 40px',
        maxWidth: 480,
        width: '100%',
        margin: '0 auto',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Dimension progress bar */}
        <div style={{ display: 'flex', marginBottom: 16, gap: 2 }}>
          {DIM_KEYS.map((d, i) => (
            <div
              key={d}
              style={{
                flex: 1,
                height: 3,
                background: i <= dimIdx ? DIM_COLOR[d] : B.border,
                borderRadius:
                  i === 0 ? '99px 0 0 99px' :
                  i === DIM_KEYS.length - 1 ? '0 99px 99px 0' : 0,
              }}
            />
          ))}
        </div>

        {/* Overall progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <div style={{ flex: 1, height: 2, background: B.border, borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress * 100}%`, background: color, borderRadius: 99, transition: 'width 0.3s ease' }} />
          </div>
          <span style={{ fontSize: 11, color: B.inkFaint, fontFamily: 'ui-monospace, monospace' }}>
            {currentQIdx}/{totalQ}
          </span>
        </div>

        <button
          onClick={onContinue}
          style={{
            width: '100%',
            padding: '16px',
            background: color,
            color: '#fff',
            border: 'none',
            borderRadius: B.radius,
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {t('continue')}
        </button>
      </div>
    </div>
  )
}

// ── SurveyPage ────────────────────────────────────────────────────────────────

export function SurveyPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setDimension, lang } = useSurveyStore()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showTransition, setShowTransition] = useState(true)
  const [transitionDim, setTransitionDim] = useState<DimensionKey>(DIM_KEYS[0])

  const current = orderedQuestions[currentIndex]
  const total = orderedQuestions.length

  const currentDimKey = getDimForQuestion(current?.id ?? '')

  const qIdxInDim = (DIMENSIONS[currentDimKey].questions as readonly string[]).indexOf(current?.id)
  const dimLength = DIMENSIONS[currentDimKey].questions.length

  useEffect(() => {
    const idx = DIM_KEYS.indexOf(currentDimKey)
    if (idx >= 0) setDimension(idx)
  }, [currentIndex, currentDimKey, setDimension])

  // Show transition for first dim on mount
  useEffect(() => {
    setTransitionDim(DIM_KEYS[0])
    setShowTransition(true)
  }, [])

  function goNext() {
    if (currentIndex >= total - 1) {
      navigate('/results')
      return
    }
    const nextIdx = currentIndex + 1
    const nextQ = orderedQuestions[nextIdx]
    const nextDim = getDimForQuestion(nextQ.id)

    setCurrentIndex(nextIdx)

    if (nextDim !== currentDimKey) {
      setTransitionDim(nextDim)
      setShowTransition(true)
    }
  }

  function goBack() {
    if (showTransition) {
      setShowTransition(false)
      return
    }
    if (currentIndex > 0) setCurrentIndex(i => i - 1)
  }

  if (!current) return null

  const color = DIM_COLOR[currentDimKey]
  const progress = ((currentIndex + 1) / total) * 100

  // Show dimension transition screen
  if (showTransition) {
    return (
      <DimensionTransitionScreen
        dim={transitionDim}
        dimIdx={DIM_KEYS.indexOf(transitionDim)}
        totalDims={DIM_KEYS.length}
        lang={lang}
        onContinue={() => setShowTransition(false)}
        currentQIdx={currentIndex}
        totalQ={total}
      />
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: B.bg, display: 'flex', flexDirection: 'column' }}>

      {/* Top bar */}
      <header style={{
        position: 'sticky',
        top: 0,
        background: `${B.bg}f5`,
        backdropFilter: 'blur(8px)',
        borderBottom: `1px solid ${B.border}`,
        zIndex: 10,
        padding: '12px 20px',
      }}>
        <div style={{
          maxWidth: 480,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={goBack}
              disabled={currentIndex === 0}
              style={{
                width: 34, height: 34,
                border: `1px solid ${B.border}`,
                borderRadius: 99,
                background: B.white,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                color: B.inkSoft,
                cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                opacity: currentIndex === 0 ? 0.35 : 1,
                flexShrink: 0,
              }}
            >
              {lang === 'he' ? '›' : '‹'}
            </button>

            {/* Dimension label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}>
                {t(`dimension_${currentDimKey}`)}
              </span>
              <span style={{ fontSize: 11, color: B.inkFaint, marginInlineStart: 'auto', fontFamily: 'ui-monospace, monospace' }}>
                {qIdxInDim + 1}/{dimLength}
              </span>
            </div>

            <span style={{ fontSize: 12, color: B.inkFaint, fontFamily: 'ui-monospace, monospace', flexShrink: 0 }}>
              {currentIndex + 1}/{total}
            </span>

            <LanguageSwitcher />
          </div>

          {/* Progress bar */}
          <div style={{ height: 3, background: B.border, borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: color,
              borderRadius: 99,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      </header>

      {/* Question */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 0 100px',
      }}>
        <QuestionCard
          key={current.id}
          question={current}
          questionNumber={currentIndex + 1}
          totalQuestions={total}
          onSelect={goNext}
        />
      </main>

      {/* Footer — show on last question */}
      {currentIndex === total - 1 && (
        <footer style={{
          position: 'sticky',
          bottom: 0,
          background: `${B.bg}f5`,
          backdropFilter: 'blur(8px)',
          borderTop: `1px solid ${B.border}`,
          padding: '16px 20px',
          zIndex: 10,
        }}>
          <div style={{ maxWidth: 480, margin: '0 auto' }}>
            <button
              onClick={() => navigate('/results')}
              style={{
                width: '100%',
                padding: '16px',
                background: ACCENT,
                color: '#fff',
                border: 'none',
                borderRadius: B.radius,
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {t('see_results')}
            </button>
          </div>
        </footer>
      )}
    </div>
  )
}
