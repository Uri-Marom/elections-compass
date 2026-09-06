import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../components/shared/LanguageSwitcher'
import { useSurveyStore } from '../store/survey'
import { rankMKs, TOTAL_QUESTIONS } from '../utils/matching'
import { findCrossAisleMKs } from '../utils/research'
import type { Party, PartyPosition, KnessetMember } from '../types'
import { B, ACCENT, CompassRose } from '../components/bureau/BureauComponents'

import partiesData from '../data/parties.json'
import mksData from '../data/mks.json'
import mkPositionsData from '../data/mk_positions.json'
import likudPos from '../data/positions/likud.json'
import shasPos from '../data/positions/shas.json'
import utjPos from '../data/positions/utj.json'
import otzmaPos from '../data/positions/otzma.json'
import rzpPos from '../data/positions/religious_zionism.json'
import beyachadPos from '../data/positions/beyachad.json'
import nationalUnityPos from '../data/positions/national_unity.json'
import yasharPos from '../data/positions/yashar.json'
import democratsPos from '../data/positions/democrats.json'
import yisraelPos from '../data/positions/yisrael_beitenu.json'
import miluimnikimPos from '../data/positions/miluimnikim.json'
import hadashPos from '../data/positions/hadash_taal.json'
import raamPos from '../data/positions/raam.json'
import amchaPos from '../data/positions/amcha_yisrael.json'

const parties = partiesData as Party[]
const mks = mksData as KnessetMember[]
const mkPositions = mkPositionsData as Record<string, Record<string, number | null>>

const allPartyPositions: Record<string, PartyPosition[]> = {
  likud: likudPos.positions as PartyPosition[],
  shas: shasPos.positions as PartyPosition[],
  utj: utjPos.positions as PartyPosition[],
  otzma: otzmaPos.positions as PartyPosition[],
  religious_zionism: rzpPos.positions as PartyPosition[],
  beyachad: beyachadPos.positions as PartyPosition[],
  national_unity: nationalUnityPos.positions as PartyPosition[],
  yashar: yasharPos.positions as PartyPosition[],
  democrats: democratsPos.positions as PartyPosition[],
  yisrael_beitenu: yisraelPos.positions as PartyPosition[],
  miluimnikim: miluimnikimPos.positions as PartyPosition[],
  hadash_taal: hadashPos.positions as PartyPosition[],
  raam: raamPos.positions as PartyPosition[],
  amcha_yisrael: amchaPos.positions as PartyPosition[],
}

type Tab = 'matches' | 'crossaisle'

export function MKsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  useEffect(() => { window.scrollTo(0, 0) }, [])
  const { answers, weights, lang, answeredCount } = useSurveyStore()
  const [activeTab, setActiveTab] = useState<Tab>('matches')
  const [partyFilter, setPartyFilter] = useState<string>('all')
  const [matchSort, setMatchSort] = useState<'match' | 'activity'>('match')

  const answered = answeredCount()

  const rankedMKs = useMemo(() => rankMKs(answers, mkPositions, weights), [answers, weights])
  const crossAisleResults = useMemo(() => findCrossAisleMKs(mks, mkPositions, allPartyPositions), [])
  const partyIds = [...new Set(mks.map(m => m.party_id))].sort()

  const filteredRanked = useMemo(() => {
    let list = partyFilter === 'all'
      ? rankedMKs
      : rankedMKs.filter(m => mks.find(mk => mk.id === m.mk_id)?.party_id === partyFilter)
    if (matchSort === 'activity') {
      list = [...list].sort((a, b) => {
        const mkA = mks.find(m => m.id === a.mk_id)
        const mkB = mks.find(m => m.id === b.mk_id)
        return (mkB?.activity_score ?? 0) - (mkA?.activity_score ?? 0)
      })
    }
    return list
  }, [rankedMKs, partyFilter, matchSort])

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: 'matches',    label: t('mk_tab_matches') },
    { id: 'crossaisle', label: t('mk_tab_crossaisle') },
  ]

  return (
    <div style={{ minHeight: '100dvh', background: B.bg, fontFamily: B.font }}>
      <header style={{
        background: `${B.bg}f5`, backdropFilter: 'blur(8px)',
        borderBottom: `1px solid ${B.border}`,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ border: 'none', background: 'transparent', fontSize: 18, color: B.inkFaint, cursor: 'pointer', padding: 0, lineHeight: 1 }}
            aria-label="back"
          >
            {lang === 'he' ? '→' : '←'}
          </button>
          <CompassRose size={20} accent={ACCENT} lang={lang} />
          <h1 style={{ flex: 1, fontSize: 15, fontWeight: 700, color: B.ink, margin: 0 }}>{t('mk_compass')}</h1>
          <LanguageSwitcher />
        </div>

        {/* Tabs */}
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 20px', display: 'flex', overflowX: 'auto' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 12px', flexShrink: 0,
                fontSize: 12, fontWeight: 600,
                border: 'none', background: 'transparent',
                borderBottom: `2px solid ${activeTab === tab.id ? ACCENT : 'transparent'}`,
                color: activeTab === tab.id ? ACCENT : B.inkFaint,
                cursor: 'pointer', fontFamily: B.font,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '20px 20px 48px' }}>

        {/* Tab 1: Matches */}
        {activeTab === 'matches' && (
          <div>
            {answered < 5 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <p style={{ fontSize: 13, color: B.inkFaint }}>{t('mk_no_answers')}</p>
                <button
                  onClick={() => navigate('/survey')}
                  style={{
                    padding: '10px 20px', borderRadius: B.radius,
                    border: 'none', background: ACCENT, color: B.white,
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: B.font,
                  }}
                >
                  {t('go_to_survey')}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Party filter chips */}
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                  <button
                    onClick={() => setPartyFilter('all')}
                    style={{
                      padding: '5px 12px', borderRadius: 99, flexShrink: 0,
                      fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: B.font,
                      background: partyFilter === 'all' ? B.ink : B.white,
                      color: partyFilter === 'all' ? B.bg : B.inkSoft,
                      border: `1px solid ${partyFilter === 'all' ? B.ink : B.border}`,
                    }}
                  >
                    {t('filter_by_party')}
                  </button>
                  {partyIds.map(pid => {
                    const party = parties.find(p => p.id === pid)
                    if (!party) return null
                    const isSel = partyFilter === pid
                    return (
                      <button
                        key={pid}
                        onClick={() => setPartyFilter(pid)}
                        style={{
                          padding: '5px 12px', borderRadius: 99, flexShrink: 0,
                          fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: B.font,
                          background: isSel ? party.color : B.white,
                          color: isSel ? '#fff' : B.inkSoft,
                          border: `1px solid ${isSel ? party.color : party.color + '55'}`,
                        }}
                      >
                        {lang === 'he' ? party.name_he : party.name_en}
                      </button>
                    )
                  })}
                </div>

                {/* Sort toggle */}
                <div style={{
                  display: 'flex', background: B.bgMid, borderRadius: B.radius, padding: 4, gap: 4,
                }}>
                  {(['match', 'activity'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setMatchSort(s)}
                      style={{
                        flex: 1, padding: '7px 0', borderRadius: B.radius - 4,
                        fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: B.font,
                        border: 'none',
                        background: matchSort === s ? B.white : 'transparent',
                        color: matchSort === s ? B.ink : B.inkFaint,
                        boxShadow: matchSort === s ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      }}
                    >
                      {s === 'match' ? (lang === 'he' ? 'לפי התאמה' : 'By Match') : (lang === 'he' ? 'לפי פעילות' : 'By Activity')}
                    </button>
                  ))}
                </div>

                <p style={{ fontSize: 11, color: B.inkHint }}>{t('mk_matches_subtitle')}</p>

                {/* Ranked list */}
                <div style={{
                  background: B.white, borderRadius: B.radiusLg,
                  border: `1px solid ${B.border}`, overflow: 'hidden',
                }}>
                  {filteredRanked.map((match, i) => {
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
                  {filteredRanked.length === 0 && (
                    <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: B.inkHint }}>—</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Cross-Aisle */}
        {activeTab === 'crossaisle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 12, color: B.inkFaint }}>{t('mk_crossaisle_subtitle')}</p>
            <div style={{
              background: B.white, borderRadius: B.radiusLg,
              border: `1px solid ${B.border}`, overflow: 'hidden',
            }}>
              {crossAisleResults.filter(r => r.closest_party_id !== r.actual_party_id && r.divergence > 5).map(result => {
                const mk = mks.find(m => m.id === result.mk_id)
                if (!mk) return null
                const actualParty   = parties.find(p => p.id === result.actual_party_id)
                const closestParty  = parties.find(p => p.id === result.closest_party_id)
                const name = lang === 'he' ? mk.name_he : (mk.name_en || mk.name_he)

                return (
                  <div
                    key={result.mk_id}
                    style={{ padding: '12px 16px', borderBottom: `1px solid ${B.bg}` }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: B.ink }}>{name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: B.inkFaint, flexWrap: 'wrap' }}>
                          <span>
                            {t('mk_crossaisle_own_party')}:{' '}
                            <span style={{ fontWeight: 700, color: actualParty?.color }}>
                              {lang === 'he' ? actualParty?.name_he : actualParty?.name_en}
                            </span>
                            {' '}{result.actual_similarity}%
                          </span>
                          <span style={{ color: B.borderMid }}>←</span>
                          <span>
                            {t('mk_crossaisle_votes_like')}:{' '}
                            <span style={{ fontWeight: 700, color: closestParty?.color }}>
                              {lang === 'he' ? closestParty?.name_he : closestParty?.name_en}
                            </span>
                            {' '}{result.closest_similarity}%
                          </span>
                        </div>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#d97706' }}>+{result.divergence}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
