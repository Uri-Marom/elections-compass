import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSurveyStore } from '../store/survey'
import { B, ACCENT } from './bureau/BureauComponents'

type Status = 'idle' | 'sending' | 'sent' | 'error'

export function FeedbackButton() {
  const { t } = useTranslation()
  const { lang } = useSurveyStore()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState<Status>('idle')

  function handleOpen() { setOpen(true); setStatus('idle') }

  function handleClose() {
    if (status === 'sending') return
    setOpen(false); setMessage(''); setName(''); setStatus('idle')
  }

  async function handleSubmit() {
    if (!message.trim() || status === 'sending') return
    setStatus('sending')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-secret': import.meta.env.VITE_API_SECRET ?? '' },
        body: JSON.stringify({ message: message.trim(), name: name.trim() || undefined, lang }),
      })
      if (!res.ok) throw new Error('server error')
      setStatus('sent')
      setTimeout(() => handleClose(), 3000)
    } catch { setStatus('error') }
  }

  const isRtl = lang === 'he'

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    fontSize: 13, fontFamily: B.font,
    border: `1px solid ${B.border}`,
    borderRadius: B.radius,
    padding: '10px 12px',
    background: B.bg,
    color: B.ink,
    outline: 'none',
  }

  return (
    <>
      <button
        onClick={handleOpen}
        dir={isRtl ? 'rtl' : 'ltr'}
        style={{
          position: 'fixed', bottom: 20, left: 20, zIndex: 50,
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 14px',
          borderRadius: 999,
          background: B.white,
          border: `1px solid ${B.border}`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          fontSize: 13, color: B.inkSoft,
          cursor: 'pointer', fontFamily: B.font,
        }}
        aria-label={t('feedback')}
      >
        <span>💬</span>
        <span style={{ fontWeight: 500 }}>{t('feedback')}</span>
      </button>

      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start',
            padding: 20,
          }}
          onClick={e => { if (e.target === e.currentTarget) handleClose() }}
        >
          <div
            dir={isRtl ? 'rtl' : 'ltr'}
            style={{
              width: '100%', maxWidth: 320,
              background: B.white,
              borderRadius: B.radiusXl,
              border: `1px solid ${B.border}`,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              padding: 16,
              marginBottom: 56,
              fontFamily: B.font,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: B.ink }}>💬 {t('feedback')}</span>
              <button
                onClick={handleClose}
                style={{ border: 'none', background: 'transparent', fontSize: 18, color: B.inkHint, cursor: 'pointer', padding: 0 }}
              >×</button>
            </div>

            {status === 'sent' ? (
              <p style={{ fontSize: 13, color: '#16a34a', textAlign: 'center', padding: '16px 0' }}>
                {t('feedback_thanks')}
              </p>
            ) : (
              <>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder={t('feedback_placeholder')}
                  maxLength={2000}
                  rows={4}
                  disabled={status === 'sending'}
                  style={{ ...inputStyle, resize: 'none', marginBottom: 8 }}
                />
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={t('feedback_name_placeholder')}
                  maxLength={80}
                  disabled={status === 'sending'}
                  style={{ ...inputStyle, marginBottom: 8 }}
                />
                {status === 'error' && (
                  <p style={{ fontSize: 12, color: '#dc2626', marginBottom: 6 }}>{t('feedback_error')}</p>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={!message.trim() || status === 'sending'}
                  style={{
                    width: '100%', padding: '10px 0',
                    borderRadius: B.radius, border: 'none',
                    background: ACCENT, color: B.white,
                    fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: B.font,
                    opacity: (!message.trim() || status === 'sending') ? 0.5 : 1,
                  }}
                >
                  {status === 'sending' ? '...' : t('feedback_send')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
