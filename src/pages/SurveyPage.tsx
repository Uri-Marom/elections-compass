import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { QuestionCard } from '../components/Survey/QuestionCard'
import { DimensionHeader } from '../components/Survey/DimensionHeader'
import { LanguageSwitcher } from '../components/shared/LanguageSwitcher'
import { useSurveyStore } from '../store/survey'
import { DIMENSIONS, type DimensionKey } from '../utils/matching'
import questionsData from '../data/questions.json'
import type { Question } from '../types'

const questions = questionsData as Question[]

// Flatten questions in dimension order
const orderedQuestions: Question[] = (Object.keys(DIMENSIONS) as DimensionKey[]).flatMap(dim =>
  DIMENSIONS[dim].questions.map(qid => questions.find(q => q.id === qid)!).filter(Boolean)
)

export function SurveyPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setDimension } = useSurveyStore()
  const [currentIndex, setCurrentIndex] = useState(0)

  const current = orderedQuestions[currentIndex]
  const total = orderedQuestions.length
  const progress = (currentIndex / total) * 100

  // Track current dimension for header
  useEffect(() => {
    const dimIdx = (Object.keys(DIMENSIONS) as DimensionKey[]).findIndex(dim =>
      (DIMENSIONS[dim].questions as readonly string[]).includes(current?.id)
    )
    if (dimIdx >= 0) setDimension(dimIdx)
  }, [currentIndex, current, setDimension])

  function goNext() {
    if (currentIndex < total - 1) {
      setCurrentIndex(i => i + 1)
    } else {
      navigate('/results')
    }
  }

  function goBack() {
    if (currentIndex > 0) setCurrentIndex(i => i - 1)
  }

  if (!current) return null

  const currentDimKey = (Object.keys(DIMENSIONS) as DimensionKey[]).find(dim =>
    (DIMENSIONS[dim].questions as readonly string[]).includes(current.id)
  )!
  const qIdxInDim = (DIMENSIONS[currentDimKey].questions as readonly string[]).indexOf(current.id)
  const dimLength = DIMENSIONS[currentDimKey].questions.length

  const isLast = currentIndex === total - 1

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={goBack} disabled={currentIndex === 0}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xl w-8 h-8 flex items-center justify-center"
          >
            ‹
          </button>
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-2 bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 shrink-0">
            {currentIndex + 1}/{total}
          </span>
          <LanguageSwitcher />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-center py-8">
        <DimensionHeader
          dimension={currentDimKey}
          questionIndex={qIdxInDim}
          totalInDimension={dimLength}
        />
        <QuestionCard
          question={current}
          questionNumber={currentIndex + 1}
          totalQuestions={total}
          onSelect={goNext}
        />
      </main>

      {/* Footer */}
      <footer className="sticky bottom-0 bg-white border-t border-gray-100 p-4">
        <div className="max-w-2xl mx-auto flex gap-3">
          <button
            onClick={goBack}
            disabled={currentIndex === 0}
            className="flex-1 py-4 rounded-2xl text-base font-semibold border-2 border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            {t('back')}
          </button>
          {isLast && (
            <button
              onClick={() => navigate('/results')}
              className="flex-1 py-4 rounded-2xl text-base font-semibold bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-md transition-all"
            >
              {t('see_results')}
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}
