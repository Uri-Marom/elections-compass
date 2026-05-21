import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../components/shared/LanguageSwitcher'
import { DIMENSIONS, type DimensionKey } from '../utils/matching'
import { CompassRose, GridPaper, B, ACCENT, DIM_COLOR } from '../components/bureau/BureauComponents'
import { useSurveyStore } from '../store/survey'
import { useSurveyMode, SHORT_QUESTION_COUNT } from '../utils/surveyMode'

const TOTAL = Object.values(DIMENSIONS).reduce((s, d) => s + d.questions.length, 0)

function hasPendingCompare() {
  try { return !!sessionStorage.getItem('pendingCompare') } catch { return false }
}

export function IntroPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { lang, reset } = useSurveyStore()
  const { mode, prefix } = useSurveyMode()
  const pendingCompare = hasPendingCompare()
  const [showAbout, setShowAbout] = useState(false)
  const isHe = lang === 'he'
  const isShort = mode === 'short'
  const activeTotal = isShort ? SHORT_QUESTION_COUNT : TOTAL

  return (
    <div style={{
      minHeight: '100dvh',
      background: B.bg,
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <GridPaper opacity={0.035} />

      {/* Compass watermark */}
      <div style={{
        position: 'absolute',
        top: '6%',
        left: '50%',
        transform: 'translateX(-50%)',
        opacity: 0.06,
        pointerEvents: 'none',
        zIndex: 0,
      }}>
        <CompassRose size={300} lang={lang} />
      </div>

      {/* Header */}
      <header style={{
        padding: '20px 24px 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative',
        zIndex: 1,
        maxWidth: 480,
        width: '100%',
        alignSelf: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CompassRose size={22} accent={ACCENT} lang={lang} />
          <span style={{ fontSize: 14, fontWeight: 700, color: B.ink, letterSpacing: '0.02em' }}>
            {isHe ? 'מצפן הבחירות' : 'Vote Compass Israel'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: B.inkFaint, fontFamily: 'ui-monospace, monospace' }}>2026</span>
          <LanguageSwitcher />
        </div>
      </header>

      {pendingCompare && (
        <div style={{
          margin: '14px auto 0',
          maxWidth: 480,
          width: 'calc(100% - 48px)',
          padding: '12px 16px',
          background: `${ACCENT}12`,
          border: `1px solid ${ACCENT}30`,
          borderRadius: B.radius,
          fontSize: 13,
          color: B.ink,
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
        }}>
          {t('friend_banner')}
        </div>
      )}

      {/* Main content */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: '0 24px 32px',
        position: 'relative',
        zIndex: 1,
        maxWidth: 480,
        width: '100%',
        alignSelf: 'center',
      }}>
        {/* Top spacer */}
        <div style={{ flex: 1, minHeight: 120 }} />

        {/* Eyebrow */}
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          color: ACCENT,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          marginBottom: 14,
        }}>
          {`· ${activeTotal} ${isHe ? 'שאלות' : 'questions'} · 6 ${isHe ? 'תחומים' : 'topics'} ·`}
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: 48,
          lineHeight: 0.95,
          fontWeight: 900,
          color: B.ink,
          letterSpacing: '-0.03em',
          marginBottom: 14,
        }}>
          {isHe ? (
            <>{`איפה נמצא`}<br /><span style={{ color: ACCENT }}>{`הצפון שלכם?`}</span></>
          ) : (
            <>{`Where is`}<br /><span style={{ color: ACCENT }}>{`your north?`}</span></>
          )}
        </h1>

        {/* Description */}
        <p style={{ fontSize: 15, color: B.inkSoft, lineHeight: 1.55, marginBottom: 24 }}>
          {t('intro_description', { total: activeTotal })}
        </p>

        {/* Dimension tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 24 }}>
          {(Object.keys(DIMENSIONS) as DimensionKey[]).map(dim => (
            <div key={dim} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 11px',
              background: B.white,
              border: `1px solid ${B.border}`,
              borderRadius: 99,
            }}>
              <div style={{
                width: 7, height: 7,
                borderRadius: '50%',
                background: DIM_COLOR[dim],
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 11, color: B.inkSoft, fontWeight: 500 }}>
                {t(`dimension_${dim}`)}
              </span>
            </div>
          ))}
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 28 }}>
          {[
            { v: String(activeTotal), l: isHe ? 'שאלות' : 'Questions' },
            { v: '13',               l: isHe ? 'מפלגות' : 'Parties'   },
            { v: isShort ? "3′" : "10′", l: isHe ? 'דקות' : 'Minutes' },
          ].map(s => (
            <div key={s.l} style={{
              flex: 1,
              padding: '11px 8px',
              background: B.bgMid,
              borderRadius: 12,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: B.ink, lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontSize: 10, color: B.inkFaint, marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={() => { reset(); navigate(prefix + '/priorities') }}
            style={{
              padding: '16px',
              background: ACCENT,
              color: '#fff',
              border: 'none',
              borderRadius: B.radius,
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: '0.02em',
              cursor: 'pointer',
            }}
          >
            {t('start_survey')}
          </button>
          <button
            onClick={() => navigate(isShort ? '/' : '/short')}
            style={{
              padding: '12px',
              background: 'transparent',
              color: B.inkSoft,
              border: `1px solid ${B.borderMid}`,
              borderRadius: B.radius,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {isHe
              ? (isShort ? `גרסה מורחבת ← ${TOTAL} שאלות` : `גרסה מקוצרת ← ${SHORT_QUESTION_COUNT} שאלות`)
              : (isShort ? `Extended version ← ${TOTAL} questions` : `Short version ← ${SHORT_QUESTION_COUNT} questions`)
            }
          </button>
          <button
            onClick={() => navigate('/research')}
            style={{
              padding: '12px',
              background: 'transparent',
              color: B.inkSoft,
              border: `1px solid ${B.borderMid}`,
              borderRadius: B.radius,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {t('explore_research')}
          </button>
        </div>

        {/* About toggle */}
        <button
          onClick={() => setShowAbout(v => !v)}
          style={{
            marginTop: 18,
            padding: '8px',
            border: 'none',
            background: 'transparent',
            fontSize: 11,
            color: B.inkHint,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            justifyContent: 'center',
            width: '100%',
          }}
        >
          <span>{showAbout ? '▲' : '▼'}</span>
          <span>{t('about_toggle')}</span>
        </button>

        {showAbout && (
          <div style={{
            marginTop: 4,
            padding: '16px',
            background: B.bgMid,
            borderRadius: B.radiusLg,
            border: `1px solid ${B.border}`,
          }}>
            {([
              { title: t('about_how_title'),          body: t('about_how_body')          },
              { title: t('about_privacy_title'),       body: t('about_privacy_body')       },
              { title: t('about_independence_title'),  body: t('about_independence_body')  },
            ] as const).map(({ title, body }) => (
              <div key={title} style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: B.ink, marginBottom: 3 }}>{title}</p>
                <p style={{ fontSize: 11, color: B.inkSoft, lineHeight: 1.5 }}>{body}</p>
              </div>
            ))}
            <p style={{ fontSize: 11, color: B.inkSoft, lineHeight: 1.5 }}>
              {t('about_data_sources_body')}{' '}
              <a
                href="https://oknesset.org"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: ACCENT }}
              >
                {t('about_data_sources_link')}
              </a>.
            </p>
            <p style={{ fontSize: 11, color: B.inkSoft, lineHeight: 1.5, marginTop: 8 }}>
              {t('about_feedback_body')}
            </p>
          </div>
        )}

        <p style={{ textAlign: 'center', fontSize: 10, color: B.inkHint, marginTop: 14 }}>
          {isHe ? 'פרויקט עצמאי ולא מפלגתי' : 'Independent & non-partisan'}
        </p>
      </main>
    </div>
  )
}
