import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSurveyStore } from '../../store/survey'
import type { MKMatch, KnessetMember, Party } from '../../types'
import { TOTAL_QUESTIONS } from '../../utils/matching'
import { B } from '../bureau/BureauComponents'

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
            const isFormerYeshAtid = mk.party_id === 'yesh_atid'
            const partyLabel = party
              ? (lang === 'he' ? party.name_he : party.name_en)
              : isFormerYeshAtid
                ? (lang === 'he' ? 'יש עתיד (לשעבר)' : 'Yesh Atid (former)')
                : null
            const partyColor = party?.color ?? (isFormerYeshAtid ? '#f59e0b' : B.inkHint)

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
                  <span style={{ fontSize: 13, fontWeight: 600, color: B.ink }}>{name}</span>
                  {partyLabel && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: partyColor, marginTop: 1, display: 'block' }}>
                      {partyLabel}
                    </span>
                  )}
                  <p style={{ fontSize: 11, color: B.inkHint, marginTop: 1 }}>
                    {mk.attendance_pct != null
                      ? `${mk.attendance_pct}% ${lang === 'he' ? 'נוכחות' : 'attendance'}`
                      : (lang === 'he' ? 'נוכחות: לא זמין' : 'attendance: N/A')
                    } · {mk.bill_count} {lang === 'he' ? 'הצעות חוק' : 'bills'}
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: partyColor }}>
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
