import { useTranslation } from 'react-i18next'
import type { Question } from '../../types'
import { useSurveyStore } from '../../store/survey'
import { B, ACCENT } from '../bureau/BureauComponents'

interface Props {
  question: Question
  onClose: () => void
}

export function LearnMoreModal({ question, onClose }: Props) {
  const { t } = useTranslation()
  const { lang } = useSurveyStore()
  const isRtl = lang === 'he'
  const agree    = lang === 'he' ? question.agree_he    : question.agree_en
  const disagree = lang === 'he' ? question.disagree_he : question.disagree_en

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: 16,
        background: 'rgba(10,10,10,0.45)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        style={{
          width: '100%', maxWidth: 520,
          background: B.white,
          borderRadius: B.radiusXl,
          border: `1px solid ${B.border}`,
          padding: 20,
          marginBottom: 8,
          fontFamily: B.font,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: ACCENT,
            fontFamily: 'ui-monospace, monospace',
          }}>
            {t('learn_more')}
          </span>
          <button
            onClick={onClose}
            style={{
              border: 'none', background: 'transparent',
              fontSize: 20, lineHeight: 1, color: B.inkHint,
              cursor: 'pointer', flexShrink: 0, padding: 0,
            }}
            aria-label={t('learn_more_close')}
          >×</button>
        </div>

        {/* Question text */}
        <p style={{
          fontSize: 14, fontWeight: 600, color: B.ink,
          lineHeight: 1.55, marginBottom: 16,
          paddingBottom: 16, borderBottom: `1px solid ${B.border}`,
        }}>
          {lang === 'he' ? question.text_he : question.text_en}
        </p>

        {/* Agree block */}
        {agree && (
          <div style={{
            marginBottom: 10,
            padding: '12px 14px',
            background: '#f0fdf4',
            borderRadius: B.radius,
            borderInlineStart: '3px solid #16a34a',
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: '#16a34a',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              marginBottom: 6, fontFamily: 'ui-monospace, monospace',
            }}>
              {isRtl ? '✓ בעד' : '✓ For'}
            </div>
            <p style={{ fontSize: 13, color: '#15803d', lineHeight: 1.6, margin: 0 }}>
              {agree}
            </p>
          </div>
        )}

        {/* Disagree block */}
        {disagree && (
          <div style={{
            marginBottom: 16,
            padding: '12px 14px',
            background: '#fef2f2',
            borderRadius: B.radius,
            borderInlineStart: '3px solid #dc2626',
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: '#dc2626',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              marginBottom: 6, fontFamily: 'ui-monospace, monospace',
            }}>
              {isRtl ? '✗ נגד' : '✗ Against'}
            </div>
            <p style={{ fontSize: 13, color: '#b91c1c', lineHeight: 1.6, margin: 0 }}>
              {disagree}
            </p>
          </div>
        )}

        {/* Source */}
        {question.info_source_url && question.info_source && (
          <a
            href={question.info_source_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 12, color: ACCENT,
              textDecoration: 'underline', textDecorationColor: `${ACCENT}55`,
              marginBottom: 16,
            }}
          >
            <span>{t('learn_more_source')}:</span>
            <span>{question.info_source}</span>
            <span>↗</span>
          </a>
        )}

        <button
          onClick={onClose}
          style={{
            width: '100%', marginTop: 4,
            padding: '11px 0',
            borderRadius: B.radius,
            border: `1px solid ${B.border}`,
            background: B.bg,
            fontSize: 13, color: B.inkSoft,
            cursor: 'pointer', fontFamily: B.font,
          }}
        >
          {t('learn_more_close')}
        </button>
      </div>
    </div>
  )
}
