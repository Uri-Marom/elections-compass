import { useTranslation } from 'react-i18next'
import type { Question } from '../../types'
import { useSurveyStore } from '../../store/survey'

interface Props {
  question: Question
  onClose: () => void
}

export function LearnMoreModal({ question, onClose }: Props) {
  const { t } = useTranslation()
  const { lang } = useSurveyStore()
  const isRtl = lang === 'he'
  const info = lang === 'he' ? question.info_he : question.info_en

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/30"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 p-5 mb-2"
      >
        <div className="flex items-start justify-between mb-3 gap-3">
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
            {t('learn_more')}
          </span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none flex-shrink-0"
            aria-label={t('learn_more_close')}
          >
            ×
          </button>
        </div>

        {info && (
          <p className="text-sm text-gray-700 leading-relaxed mb-4">{info}</p>
        )}

        {question.info_source_url && question.info_source && (
          <a
            href={question.info_source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
          >
            <span>{t('learn_more_source')}:</span>
            <span>{question.info_source}</span>
            <span>↗</span>
          </a>
        )}

        <button
          onClick={onClose}
          className="w-full mt-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          {t('learn_more_close')}
        </button>
      </div>
    </div>
  )
}
