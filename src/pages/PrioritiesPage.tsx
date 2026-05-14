import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../components/shared/LanguageSwitcher'
import { useSurveyStore } from '../store/survey'
import { DIMENSIONS, type DimensionKey } from '../utils/matching'
import { GridPaper, B, ACCENT, DIM_COLOR } from '../components/bureau/BureauComponents'

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
  const { weights, setWeight, lang } = useSurveyStore()
  const isHe = lang === 'he'
  const dims = Object.keys(DIMENSIONS) as DimensionKey[]

  function handleLevel(dim: DimensionKey, level: Level) {
    setWeight(dim, WEIGHT_VALUES[level])
  }

  return (
    <div style={{ minHeight: '100dvh', background: B.bg, display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <GridPaper opacity={0.03} />

      {/* Header */}
      <header style={{
        position: 'sticky',
        top: 0,
        background: `${B.bg}f5`,
        backdropFilter: 'blur(8px)',
        borderBottom: `1px solid ${B.border}`,
        zIndex: 10,
      }}>
        <div style={{
          maxWidth: 480,
          margin: '0 auto',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <button
            onClick={() => navigate('/')}
            style={{
              width: 36, height: 36,
              border: `1px solid ${B.border}`,
              borderRadius: 99,
              background: B.white,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              color: B.inkSoft,
              cursor: 'pointer',
            }}
          >
            {isHe ? '›' : '‹'}
          </button>
          <span style={{ fontSize: 14, fontWeight: 700, color: B.ink }}>{t('priorities_title')}</span>
          <LanguageSwitcher />
        </div>
      </header>

      {/* Content */}
      <main style={{
        flex: 1,
        maxWidth: 480,
        width: '100%',
        margin: '0 auto',
        padding: '24px 20px 140px',
        position: 'relative',
        zIndex: 1,
      }}>
        <p style={{ fontSize: 13, color: B.inkFaint, lineHeight: 1.6, marginBottom: 20, textAlign: 'center' }}>
          {t('priorities_subtitle')}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {dims.map(dim => {
            const current = weightToLevel(weights[dim] ?? 1)
            const dimColor = DIM_COLOR[dim]
            return (
              <div key={dim} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: B.white,
                border: `1px solid ${B.border}`,
                borderRadius: B.radius,
                padding: '14px 16px',
              }}>
                {/* Dimension color dot */}
                <div style={{
                  width: 10, height: 10,
                  borderRadius: '50%',
                  background: dimColor,
                  flexShrink: 0,
                }} />
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: B.ink }}>
                  {t(`dimension_${dim}`)}
                </span>
                {/* Weight buttons */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {(['low', 'medium', 'high'] as Level[]).map(level => {
                    const isActive = current === level
                    const activeBg =
                      level === 'high'   ? dimColor :
                      level === 'medium' ? `${dimColor}33` :
                      B.bgMid
                    const activeColor =
                      level === 'high'   ? '#fff' :
                      level === 'medium' ? dimColor :
                      B.inkFaint
                    return (
                      <button
                        key={level}
                        onClick={() => handleLevel(dim, level)}
                        style={{
                          padding: '5px 10px',
                          borderRadius: 8,
                          border: isActive ? 'none' : `1px solid ${B.border}`,
                          background: isActive ? activeBg : B.white,
                          fontSize: 11,
                          fontWeight: isActive ? 700 : 400,
                          color: isActive ? activeColor : B.inkFaint,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {t(`weight_${level}`)}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        position: 'sticky',
        bottom: 0,
        background: `${B.bg}f5`,
        backdropFilter: 'blur(8px)',
        borderTop: `1px solid ${B.border}`,
        padding: '16px 20px',
        zIndex: 10,
      }}>
        <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => navigate('/survey')}
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
            {t('priorities_continue')}
          </button>
          <button
            onClick={() => navigate('/survey')}
            style={{
              width: '100%',
              padding: '10px',
              background: 'transparent',
              color: B.inkHint,
              border: 'none',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {t('priorities_skip')}
          </button>
        </div>
      </footer>
    </div>
  )
}
