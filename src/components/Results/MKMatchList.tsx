import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSurveyStore } from '../../store/survey'
import type { MKMatch, KnessetMember, Party } from '../../types'
import { TOTAL_QUESTIONS } from '../../utils/matching'
import { B } from '../bureau/BureauComponents'

const GRADE_BG: Record<string, string>   = { A: '#f0fdf4', B: '#ecfeff', C: '#fefce8', D: '#fff7ed', F: '#fef2f2' }
const GRADE_FG: Record<string, string>   = { A: '#15803d', B: '#0e7490', C: '#a16207', D: '#c2410c', F: '#b91c1c' }
const GRADE_BD: Record<string, string>   = { A: '#bbf7d0', B: '#a5f3fc', C: '#fde68a', D: '#fed7aa', F: '#fecaca' }

interface Props {
  topMKs: MKMatch[]
  mks: KnessetMember[]
  parties: Party[]
}

export function MKMatchList({ topMKs, mks, parties }: Props) {
  const { t } = useTranslation()
  const { lang } = useSurveyStore()
  const [expanded, setExpanded] = useState(false)

  const visible = topMKs.slice(0, 10)
  if (visible.length === 0) return null

  return (
    <div style={{
      background: B.white, border: `1px solid ${B.border}`,
      borderRadius: B.radiusLg, overflow: 'hidden', fontFamily: B.font,
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'transparent', border: 'none', cursor: 'pointer',
          textAlign: 'start', fontFamily: B.font,
        }}
      >
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: B.ink, margin: 0 }}>{t('mk_matches')}</p>
          <p style={{ fontSize: 11, color: B.inkHint, margin: '2px 0 0' }}>{t('mk_matches_subtitle')}</p>
        </div>
        <span style={{ fontSize: 11, color: B.inkHint, flexShrink: 0, marginInlineStart: 8 }}>
          {expanded ? t('mk_matches_hide') : t('mk_matches_show')}
        </span>
      </button>

      {expanded && (
        <div style={{ borderTop: `1px solid ${B.border}` }}>
          {visible.map((match, i) => {
            const mk = mks.find(m => m.id === match.mk_id)
            if (!mk) return null
            const party = parties.find(p => p.id === mk.party_id)
            const name = lang === 'he' ? mk.name_he : (mk.name_en || mk.name_he)

            return (
              <div
                key={match.mk_id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 16px',
                  borderBottom: `1px solid ${B.bg}`,
                }}
              >
                <span style={{
                  fontSize: 10, fontWeight: 700, color: B.inkHint,
                  width: 18, textAlign: 'center', flexShrink: 0,
                  fontFamily: 'ui-monospace, monospace',
                }}>
                  {i + 1}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: B.ink }}>{name}</span>
                    {mk.activity_grade && (
                      <span style={{
                        fontSize: 10, padding: '1px 6px', borderRadius: 99, fontWeight: 700,
                        background: GRADE_BG[mk.activity_grade] ?? B.bgMid,
                        color: GRADE_FG[mk.activity_grade] ?? B.inkSoft,
                        border: `1px solid ${GRADE_BD[mk.activity_grade] ?? B.border}`,
                        flexShrink: 0,
                      }}
                        title={`${mk.attendance_pct}% attendance · ${mk.bill_count} bills`}
                      >
                        {mk.activity_grade}
                      </span>
                    )}
                    {mk.is_current && (
                      <span style={{
                        fontSize: 10, padding: '1px 6px', borderRadius: 99,
                        background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', flexShrink: 0,
                      }}>
                        {t('current_mk')}
                      </span>
                    )}
                  </div>
                  {party && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: party.color, marginTop: 1, display: 'block' }}>
                      {lang === 'he' ? party.name_he : party.name_en}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: party?.color ?? B.inkHint }}>
                    {match.overall}%
                  </span>
                  <span style={{ fontSize: 10, color: B.inkHint }}>
                    {t('coverage_questions', { n: match.question_count, total: TOTAL_QUESTIONS })}
                  </span>
                </div>
              </div>
            )
          })}

          <div style={{
            padding: '10px 16px', background: B.bg,
            display: 'flex', alignItems: 'center',
          }}>
            <span style={{ fontSize: 11, color: B.inkHint }}>{t('data_note_knessets')}</span>
          </div>
        </div>
      )}
    </div>
  )
}
