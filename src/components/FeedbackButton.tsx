import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSurveyStore } from '../store/survey'

type Status = 'idle' | 'sending' | 'sent' | 'error'

export function FeedbackButton() {
  const { t } = useTranslation()
  const { lang } = useSurveyStore()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState<Status>('idle')

  function handleOpen() {
    setOpen(true)
    setStatus('idle')
  }

  function handleClose() {
    if (status === 'sending') return
    setOpen(false)
    setMessage('')
    setName('')
    setStatus('idle')
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
    } catch {
      setStatus('error')
    }
  }

  const isRtl = lang === 'he'

  return (
    <>
      {/* Floating button */}
      <button
        onClick={handleOpen}
        dir={isRtl ? 'rtl' : 'ltr'}
        className="fixed bottom-5 left-5 z-50 flex items-center gap-1.5 px-3 py-2 rounded-full bg-white border border-gray-200 shadow-md text-sm text-gray-600 hover:bg-gray-50 hover:shadow-lg transition-all"
        aria-label={t('feedback')}
      >
        <span>💬</span>
        <span className="font-medium">{t('feedback')}</span>
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-start p-5"
          onClick={e => { if (e.target === e.currentTarget) handleClose() }}
        >
          <div
            dir={isRtl ? 'rtl' : 'ltr'}
            className="w-full max-w-xs bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 mb-14"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-gray-800 text-sm">💬 {t('feedback')}</span>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ×
              </button>
            </div>

            {status === 'sent' ? (
              <p className="text-green-600 text-sm text-center py-4">{t('feedback_thanks')}</p>
            ) : (
              <>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder={t('feedback_placeholder')}
                  maxLength={2000}
                  rows={4}
                  disabled={status === 'sending'}
                  className="w-full text-sm rounded-xl border border-gray-200 p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
                />
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={t('feedback_name_placeholder')}
                  maxLength={80}
                  disabled={status === 'sending'}
                  className="w-full mt-2 text-sm rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
                />
                {status === 'error' && (
                  <p className="text-red-500 text-xs mt-1">{t('feedback_error')}</p>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={!message.trim() || status === 'sending'}
                  className="w-full mt-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
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
