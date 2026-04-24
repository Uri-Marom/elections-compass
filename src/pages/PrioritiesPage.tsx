import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../components/shared/LanguageSwitcher'
import { useSurveyStore } from '../store/survey'
import { DIMENSIONS, type DimensionKey } from '../utils/matching'

const DIMENSION_ICONS: Record<string, string> = {
  security:      '🛡️',
  religion:      '✡️',
  socioeconomic: '📊',
  judicial:      '⚖️',
  minority:      '🤝',
  governance:    '🏛️',
}

// Maps the 3-level UI choice to a numeric weight used in the algorithm
const WEIGHT_VALUES = { low: 0.2, medium: 1, high: 3 } as const
type Level = keyof typeof WEIGHT_VALUES

function weightToLevel(w: number): Level {
  if (w <= 0.2) return 'low'
  if (w >= 3)   return 'high'
  return 'medium'
}

export function PrioritiesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { weights, setWeight } = useSurveyStore()

  const dims = Object.keys(DIMENSIONS) as DimensionKey[]

  function handleLevel(dim: DimensionKey, level: Level) {
    setWeight(dim, WEIGHT_VALUES[level])
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-gray-600 text-xl w-8 h-8 flex items-center justify-center"
          >
            ‹
          </button>
          <span className="text-sm font-medium text-gray-500">{t('priorities_title')}</span>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center py-8 px-4">
        <div className="w-full max-w-2xl">
          <p className="text-gray-500 text-sm mb-6 text-center">{t('priorities_subtitle')}</p>

          <div className="flex flex-col gap-3">
            {dims.map(dim => {
              const current = weightToLevel(weights[dim] ?? 1)
              return (
                <div key={dim} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3">
                  <span className="text-xl shrink-0">{DIMENSION_ICONS[dim]}</span>
                  <span className="flex-1 text-sm font-medium text-gray-800">
                    {t(`dimension_${dim}`)}
                  </span>
                  <div className="flex gap-1 shrink-0">
                    {(['low', 'medium', 'high'] as Level[]).map(level => (
                      <button
                        key={level}
                        onClick={() => handleLevel(dim, level)}
                        className={[
                          'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                          current === level
                            ? level === 'high'
                              ? 'bg-blue-600 text-white'
                              : level === 'low'
                                ? 'bg-gray-400 text-white'
                                : 'bg-blue-200 text-blue-800'
                            : 'bg-white border border-gray-200 text-gray-500 hover:border-blue-300',
                        ].join(' ')}
                      >
                        {t(`weight_${level}`)}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>

      <footer className="sticky bottom-0 bg-white border-t border-gray-100 p-4">
        <div className="max-w-2xl mx-auto flex flex-col gap-2">
          <button
            onClick={() => navigate('/survey')}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl text-base font-semibold hover:bg-blue-700 active:bg-blue-800 shadow-md transition-all"
          >
            {t('priorities_continue')}
          </button>
          <button
            onClick={() => navigate('/survey')}
            className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            {t('priorities_skip')}
          </button>
        </div>
      </footer>
    </div>
  )
}
