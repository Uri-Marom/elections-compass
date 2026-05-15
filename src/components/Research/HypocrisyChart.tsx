import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { HypocrisyResult } from '../../utils/research'
import type { Party, Question } from '../../types'
import { B, ACCENT } from '../bureau/BureauComponents'

interface Props {
  results: HypocrisyResult[]
  parties: Party[]
  questions: Question[]
  lang: 'he' | 'en'
}

function consistencyColor(score: number): string {
  if (score >= 70) return '#16a34a'
  if (score >= 40) return '#d97706'
  return '#dc2626'
}

function consistencyLabel(score: number, lang: 'he' | 'en'): string {
  if (score >= 70) return lang === 'he' ? 'עקבי' : 'Consistent'
  if (score >= 40) return lang === 'he' ? 'חלקי' : 'Partial'
  return lang === 'he' ? 'פערים גדולים' : 'Major gaps'
}

function formatScore(s: number, lang: 'he' | 'en'): string {
  const labels = lang === 'he'
    ? ['מתנגד בחוזקה', 'מתנגד', 'ניטרלי', 'תומך', 'תומך בחוזקה']
    : ['Strongly Against', 'Against', 'Neutral', 'In Favor', 'Strongly In Favor']
  return labels[Math.min(Math.max(Math.round(s + 2), 0), 4)]
}

export function HypocrisyChart({ results, parties, questions, lang }: Props) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState<string | null>(null)

  const withData = results.filter(r => r.coverage > 0)
  const noData   = results.filter(r => r.coverage === 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: B.font }}>
      {withData.map((result, idx) => {
        const party = parties.find(p => p.id === result.party_id)
        if (!party) return null
        const name = lang === 'he' ? party.name_he : party.name_en
        const isExpanded = expanded === result.party_id
        const score = Math.round(result.score)
        const color = consistencyColor(result.score)

        return (
          <div
            key={result.party_id}
            style={{
              border: `1px solid ${B.border}`,
              borderRadius: B.radius,
              overflow: 'hidden',
              background: B.white,
            }}
          >
            <button
              onClick={() => setExpanded(isExpanded ? null : result.party_id)}
              style={{
                width: '100%', padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontFamily: B.font, textAlign: 'start',
              }}
            >
              <span style={{
                fontSize: 10, fontWeight: 700, color: B.inkHint,
                width: 18, textAlign: 'center', flexShrink: 0,
                fontFamily: 'ui-monospace, monospace',
              }}>
                {idx + 1}
              </span>

              <div style={{ width: 8, height: 8, borderRadius: '50%', background: party.color, flexShrink: 0 }} />

              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: B.ink, textAlign: 'start' }}>{name}</span>

              <span style={{ fontSize: 11, color, flexShrink: 0 }}>{consistencyLabel(result.score, lang)}</span>

              <span style={{ fontSize: 13, fontWeight: 800, color, width: 28, textAlign: 'end', flexShrink: 0 }}>{score}</span>

              <div style={{ width: 72, height: 5, background: B.bgMid, borderRadius: 99, overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ height: 5, borderRadius: 99, width: `${score}%`, background: color }} />
              </div>

              <span style={{ fontSize: 11, color: B.inkHint, flexShrink: 0 }}>{isExpanded ? '▲' : '▼'}</span>
            </button>

            {isExpanded && (
              <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${B.border}`, background: B.bg }}>
                {result.topGaps.length === 0 ? (
                  <p style={{ fontSize: 12, color: B.inkHint, marginTop: 12 }}>{t('no_gaps_found')}</p>
                ) : (
                  <>
                    <p style={{ fontSize: 11, fontWeight: 700, color: B.inkFaint, margin: '12px 0 8px' }}>{t('top_gaps')}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {result.topGaps.map(gap => {
                        const q = questions.find(q => q.id === gap.question_id)
                        if (!q) return null
                        const text = lang === 'he' ? q.text_he : q.text_en
                        return (
                          <div
                            key={gap.question_id}
                            style={{
                              background: B.white, borderRadius: B.radius,
                              padding: 12, border: `1px solid ${B.border}`,
                            }}
                          >
                            <p style={{ fontSize: 12, color: B.inkSoft, marginBottom: 8, lineHeight: 1.55 }}>{text}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11, color: B.inkHint }}>{t('gap_platform')}:</span>
                              <span style={{
                                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                                color: ACCENT, background: `${ACCENT}15`,
                              }}>
                                {formatScore(gap.stated, lang)} ({gap.stated > 0 ? '+' : '‒'}{Math.abs(gap.stated)})
                              </span>
                              <span style={{ color: B.borderMid }}>←</span>
                              <span style={{ fontSize: 11, color: B.inkHint }}>{t('gap_voted')}:</span>
                              <span style={{
                                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                                color: '#d97706', background: '#fff7ed',
                              }}>
                                {formatScore(gap.voted, lang)} ({gap.voted > 0 ? '+' : '‒'}{Math.abs(gap.voted)})
                              </span>
                              <span style={{
                                marginInlineStart: 'auto', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                                color: '#dc2626', background: '#fef2f2',
                              }}>
                                {t('gap_label')} {gap.gap.toFixed(1)}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}

      {noData.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 11, color: B.inkHint, marginBottom: 8 }}>{t('no_data_parties')}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {noData.map(r => {
              const party = parties.find(p => p.id === r.party_id)
              if (!party) return null
              const name = lang === 'he' ? party.name_he : party.name_en
              return (
                <span
                  key={r.party_id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 12px', background: B.bgMid, borderRadius: 99,
                    fontSize: 11, color: B.inkSoft,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: party.color, display: 'inline-block' }} />
                  {name}
                  <span style={{ color: B.inkHint }}>— {t('hypocrisy_na')}</span>
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
