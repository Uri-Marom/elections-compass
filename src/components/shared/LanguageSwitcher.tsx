import { useTranslation } from 'react-i18next'
import { useSurveyStore } from '../../store/survey'

export function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const { lang, setLang } = useSurveyStore()

  function toggle() {
    const next = lang === 'he' ? 'en' : 'he'
    setLang(next)
    i18n.changeLanguage(next)
    document.documentElement.setAttribute('dir', next === 'he' ? 'rtl' : 'ltr')
    document.documentElement.setAttribute('lang', next)
  }

  return (
    <button
      onClick={toggle}
      className="text-sm font-medium px-3 py-1 rounded-full border border-gray-300 hover:bg-gray-100 transition-colors"
    >
      {lang === 'he' ? 'English' : 'עברית'}
    </button>
  )
}
