import { useTranslation } from 'react-i18next'
import type { Question } from '../../types'
import { useSurveyStore } from '../../store/survey'

interface Props {
  question: Question
  questionNumber: number
  totalQuestions: number
  onSelect: () => void
}

const LIKERT: { score: number; key: string }[] = [
  { score: 2,  key: 'strongly_agree' },
  { score: 1,  key: 'agree' },
  { score: 0,  key: 'neutral' },
  { score: -1, key: 'disagree' },
  { score: -2, key: 'strongly_disagree' },
]

export function QuestionCard({ question, questionNumber, totalQuestions, onSelect }: Props) {
  const { t } = useTranslation()
  const { answers, setAnswer, lang } = useSurveyStore()
  const current = answers[question.id]
  const text = lang === 'he' ? question.text_he : question.text_en

  function handleSelect(score: number) {
    setAnswer(question.id, score)
    setTimeout(onSelect, 220)
  }

  function handleSkip() {
    setAnswer(question.id, null)
    onSelect()
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      <div className="text-xs text-gray-400 mb-3">
        {t('question_of', { current: questionNumber, total: totalQuestions })}
      </div>

      <p className="text-lg font-medium text-gray-900 leading-snug mb-6">
        {text}
      </p>

      <div className="flex flex-col gap-2">
        {LIKERT.map(({ score, key }) => (
          <button
            key={score}
            onClick={() => handleSelect(score)}
            className={[
              'w-full py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all text-start',
              current === score
                ? 'border-blue-600 bg-blue-50 text-blue-800'
                : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50/50',
            ].join(' ')}
          >
            {t(key)}
          </button>
        ))}

        <button
          onClick={handleSkip}
          className="w-full py-2 px-4 rounded-xl border border-dashed border-gray-300 text-sm text-gray-400 hover:border-gray-400 transition-all"
        >
          {t('skip_question')}
        </button>
      </div>
    </div>
  )
}
