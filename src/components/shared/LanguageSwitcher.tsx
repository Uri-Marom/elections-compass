import { useTranslation } from 'react-i18next'
import { useSurveyStore } from '../../store/survey'
import { B } from '../bureau/BureauComponents'

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
      style={{
        padding: '4px 10px',
        borderRadius: 99,
        border: `1px solid ${B.border}`,
        background: B.white,
        fontSize: 12,
        fontWeight: 600,
        color: B.inkSoft,
        cursor: 'pointer',
        letterSpacing: '0.02em',
        transition: 'border-color 0.15s ease',
        flexShrink: 0,
      }}
    >
      {lang === 'he' ? 'EN' : 'עב'}
    </button>
  )
}
