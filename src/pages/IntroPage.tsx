import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../components/shared/LanguageSwitcher'
import { DIMENSIONS } from '../utils/matching'

const TOTAL = Object.values(DIMENSIONS).reduce((s, d) => s + d.questions.length, 0)

const DIMENSION_ICONS: Record<string, string> = {
  security:      '🛡️',
  religion:      '✡️',
  socioeconomic: '📊',
  judicial:      '⚖️',
  minority:      '🤝',
  governance:    '🏛️',
}

export function IntroPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col">
      <header className="flex justify-end p-4">
        <LanguageSwitcher />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-12">
        <div className="max-w-md w-full text-center">
          <div className="text-5xl mb-4">🇮🇱</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('app_title')}
          </h1>
          <p className="text-gray-500 mb-8">
            {t('app_subtitle')}
          </p>

          <p className="text-sm text-gray-600 mb-4 leading-relaxed">
            {t('intro_description', { total: TOTAL })}
          </p>

          <div className="grid grid-cols-2 gap-2 mb-8">
            {Object.entries(DIMENSION_ICONS).map(([dim, icon]) => (
              <div key={dim} className="flex items-center gap-2 bg-white rounded-xl p-3 border border-gray-200 text-start">
                <span>{icon}</span>
                <span className="text-sm text-gray-700">{t(`dimension_${dim}`)}</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400 mb-6">{t('intro_note')}</p>

          <button
            onClick={() => navigate('/priorities')}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl text-lg font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-lg"
          >
            {t('start_survey')} →
          </button>
        </div>
      </main>
    </div>
  )
}
