import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../components/shared/LanguageSwitcher'
import { MKMap } from '../components/Research/MKMap'
import { useSurveyStore } from '../store/survey'
import { rankMKs } from '../utils/matching'
import {
  computeIntraPartyVariance,
  findCrossAisleMKs,
  computeMKMap,
} from '../utils/research'
import type { Party, PartyPosition, KnessetMember } from '../types'

import partiesData from '../data/parties.json'
import mksData from '../data/mks.json'
import mkPositionsData from '../data/mk_positions.json'
import likudPos from '../data/positions/likud.json'
import shasPos from '../data/positions/shas.json'
import utjPos from '../data/positions/utj.json'
import otzmaPos from '../data/positions/otzma.json'
import rzpPos from '../data/positions/religious_zionism.json'
import yeshAtidPos from '../data/positions/yesh_atid.json'
import nationalUnityPos from '../data/positions/national_unity.json'
import bennettPos from '../data/positions/bennett_2026.json'
import yasharPos from '../data/positions/yashar.json'
import democratsPos from '../data/positions/democrats.json'
import yisraelPos from '../data/positions/yisrael_beitenu.json'
import miluimnikimPos from '../data/positions/miluimnikim.json'
import hadashPos from '../data/positions/hadash_taal.json'
import raamPos from '../data/positions/raam.json'

const parties = partiesData as Party[]
const mks = mksData as KnessetMember[]
const mkPositions = mkPositionsData as Record<string, Record<string, number | null>>

const allPartyPositions: Record<string, PartyPosition[]> = {
  likud: likudPos.positions as PartyPosition[],
  shas: shasPos.positions as PartyPosition[],
  utj: utjPos.positions as PartyPosition[],
  otzma: otzmaPos.positions as PartyPosition[],
  religious_zionism: rzpPos.positions as PartyPosition[],
  yesh_atid: yeshAtidPos.positions as PartyPosition[],
  national_unity: nationalUnityPos.positions as PartyPosition[],
  bennett_2026: bennettPos.positions as PartyPosition[],
  yashar: yasharPos.positions as PartyPosition[],
  democrats: democratsPos.positions as PartyPosition[],
  yisrael_beitenu: yisraelPos.positions as PartyPosition[],
  miluimnikim: miluimnikimPos.positions as PartyPosition[],
  hadash_taal: hadashPos.positions as PartyPosition[],
  raam: raamPos.positions as PartyPosition[],
}

type Tab = 'matches' | 'variance' | 'crossaisle' | 'map'

export function MKsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { answers, weights, lang, answeredCount } = useSurveyStore()
  const [activeTab, setActiveTab] = useState<Tab>('matches')
  const [partyFilter, setPartyFilter] = useState<string>('all')
  const [hoveredMkId, setHoveredMkId] = useState<string | null>(null)
  const [expandedParty, setExpandedParty] = useState<string | null>(null)
  const [matchSort, setMatchSort] = useState<'match' | 'activity'>('match')

  const answered = answeredCount()

  const rankedMKs = useMemo(
    () => rankMKs(answers, mkPositions, weights),
    [answers, weights]
  )

  const varianceResults = useMemo(() => computeIntraPartyVariance(mks, mkPositions), [])

  const crossAisleResults = useMemo(
    () => findCrossAisleMKs(mks, mkPositions, allPartyPositions),
    []
  )

  const mkMapData = useMemo(() => computeMKMap(mks, mkPositions, allPartyPositions), [])

  const partyIds = [...new Set(mks.map(m => m.party_id))].sort()

  const gradeColors: Record<string, string> = {
    A: 'bg-green-50 text-green-700 border-green-200',
    B: 'bg-blue-50 text-blue-700 border-blue-200',
    C: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    D: 'bg-orange-50 text-orange-700 border-orange-200',
    F: 'bg-red-50 text-red-700 border-red-200',
  }

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
    { id: 'matches',   label: t('mk_tab_matches') },
    { id: 'variance',  label: t('mk_tab_variance') },
    { id: 'crossaisle', label: t('mk_tab_crossaisle') },
    { id: 'map',       label: t('mk_tab_map') },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-500 hover:text-gray-800 text-lg leading-none"
            aria-label="back"
          >
            {lang === 'he' ? '→' : '←'}
          </button>
          <h1 className="flex-1 text-lg font-bold text-gray-900">{t('mk_compass')}</h1>
          <LanguageSwitcher />
        </div>

        {/* Tabs */}
        <div className="max-w-2xl mx-auto px-4 pb-0 flex gap-0 overflow-x-auto no-scrollbar">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'py-2.5 px-3 text-xs font-medium shrink-0 border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5">

        {/* Tab 1: Your Matches */}
        {activeTab === 'matches' && (
          <div>
            {answered < 5 ? (
              <div className="text-center py-12 space-y-4">
                <p className="text-sm text-gray-500">{t('mk_no_answers')}</p>
                <button
                  onClick={() => navigate('/survey')}
                  className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  {t('go_to_survey')}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Party filter */}
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  <button
                    onClick={() => setPartyFilter('all')}
                    className={[
                      'px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-colors',
                      partyFilter === 'all'
                        ? 'bg-gray-900 text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
                    ].join(' ')}
                  >
                    {t('filter_by_party')}
                  </button>
                  {partyIds.map(pid => {
                    const party = parties.find(p => p.id === pid)
                    if (!party) return null
                    return (
                      <button
                        key={pid}
                        onClick={() => setPartyFilter(pid)}
                        className={[
                          'px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-colors border',
                          partyFilter === pid ? 'text-white' : 'bg-white text-gray-600 hover:bg-gray-50',
                        ].join(' ')}
                        style={partyFilter === pid ? { backgroundColor: party.color, borderColor: party.color } : { borderColor: party.color + '60' }}
                      >
                        {lang === 'he' ? party.name_he : party.name_en}
                      </button>
                    )
                  })}
                </div>

                {/* Sort toggle */}
                <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
                  {(['match', 'activity'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setMatchSort(s)}
                      className={[
                        'flex-1 py-1.5 rounded-lg text-xs font-medium transition-all',
                        matchSort === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500',
                      ].join(' ')}
                    >
                      {s === 'match' ? (lang === 'he' ? 'לפי התאמה' : 'By Match') : (lang === 'he' ? 'לפי פעילות' : 'By Activity')}
                    </button>
                  ))}
                </div>

                <p className="text-xs text-gray-400">{t('mk_matches_subtitle')}</p>

                {/* Ranked list */}
                <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-50 overflow-hidden shadow-sm">
                  {filteredRanked.map((match, i) => {
                    const mk = mks.find(m => m.id === match.mk_id)
                    if (!mk) return null
                    const party = parties.find(p => p.id === mk.party_id)
                    const name = lang === 'he' ? mk.name_he : (mk.name_en || mk.name_he)
                    return (
                      <div key={match.mk_id} className="flex items-center gap-3 px-4 py-3">
                        <span className="text-xs font-bold text-gray-300 w-5 text-center shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-900 truncate">{name}</span>
                            {mk.activity_grade && (
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded-full border font-semibold shrink-0 ${gradeColors[mk.activity_grade] ?? ''}`}
                                title={`${mk.attendance_pct}% attendance · ${mk.bill_count} bills`}
                              >
                                {mk.activity_grade}
                              </span>
                            )}
                            {mk.is_current && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100 shrink-0">
                                {t('current_mk')}
                              </span>
                            )}
                          </div>
                          {party && (
                            <span className="text-xs font-medium mt-0.5 inline-block" style={{ color: party.color }}>
                              {lang === 'he' ? party.name_he : party.name_en}
                            </span>
                          )}
                          <p className="text-xs text-gray-400 mt-0.5">
                            {mk.attendance_pct}% {lang === 'he' ? 'נוכחות' : 'attendance'} · {mk.bill_count} {lang === 'he' ? 'הצעות חוק' : 'bills'}
                          </p>
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                          <span className="text-sm font-bold" style={{ color: party?.color ?? '#888' }}>
                            {match.overall}%
                          </span>
                          <span className="text-xs text-gray-400">{t('coverage_questions', { n: match.question_count })}</span>
                        </div>
                      </div>
                    )
                  })}
                  {filteredRanked.length === 0 && (
                    <div className="py-8 text-center text-sm text-gray-400">—</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Intra-Party Variance */}
        {activeTab === 'variance' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">{t('mk_variance_subtitle')}</p>
            <div className="space-y-2">
              {varianceResults.map(result => {
                const party = parties.find(p => p.id === result.party_id)
                if (!party || result.mk_count < 2) return null
                const partyMKs = mks.filter(m => m.party_id === result.party_id)
                const outlierMk = result.outlier_mk_id ? mks.find(m => m.id === result.outlier_mk_id) : null
                const isExpanded = expandedParty === result.party_id
                const varPct = Math.min(100, (result.variance / 2) * 100)

                return (
                  <div key={result.party_id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <button
                      onClick={() => setExpandedParty(isExpanded ? null : result.party_id)}
                      className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-sm font-semibold text-gray-900">
                            {lang === 'he' ? party.name_he : party.name_en}
                          </span>
                          <span className="text-xs text-gray-400">{t('mk_variance_mks', { n: result.mk_count })}</span>
                        </div>
                        {/* Variance bar */}
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${varPct}%`, backgroundColor: party.color }}
                          />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-xs font-semibold" style={{ color: party.color }}>
                          {result.variance.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-400">{t('mk_variance_spread')}</div>
                      </div>
                      <span className="text-gray-300 text-xs shrink-0">{isExpanded ? '▲' : '▼'}</span>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-gray-100 px-4 py-3 space-y-1">
                        {outlierMk && (
                          <p className="text-xs text-gray-500 mb-2">
                            <span className="font-medium">{t('mk_variance_outlier')}: </span>
                            {lang === 'he' ? outlierMk.name_he : (outlierMk.name_en || outlierMk.name_he)}
                            {' '}
                            <span style={{ color: party.color }}>({result.outlier_distance.toFixed(1)})</span>
                          </p>
                        )}
                        {partyMKs.map(mk => (
                          <div key={mk.id} className="flex items-center justify-between py-0.5">
                            <span className="text-xs text-gray-700 flex items-center gap-1.5">
                              {mk.id === result.outlier_mk_id && <span className="text-amber-500">◆</span>}
                              {lang === 'he' ? mk.name_he : (mk.name_en || mk.name_he)}
                              {mk.is_current && (
                                <span className="text-xs px-1 py-0.5 rounded bg-green-50 text-green-700 text-[10px]">
                                  {t('current_mk')}
                                </span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Cross-Aisle MKs */}
        {activeTab === 'crossaisle' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">{t('mk_crossaisle_subtitle')}</p>
            <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-50 overflow-hidden shadow-sm">
              {crossAisleResults.filter(r => r.closest_party_id !== r.actual_party_id && r.divergence > 5).map(result => {
                const mk = mks.find(m => m.id === result.mk_id)
                if (!mk) return null
                const actualParty = parties.find(p => p.id === result.actual_party_id)
                const closestParty = parties.find(p => p.id === result.closest_party_id)
                const name = lang === 'he' ? mk.name_he : (mk.name_en || mk.name_he)

                return (
                  <div key={result.mk_id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-medium text-gray-900">{name}</span>
                          {mk.is_current && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100 shrink-0">
                              {t('current_mk')}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                          <span>
                            {t('mk_crossaisle_own_party')}:{' '}
                            <span className="font-medium" style={{ color: actualParty?.color }}>
                              {lang === 'he' ? actualParty?.name_he : actualParty?.name_en}
                            </span>
                            {' '}{result.actual_similarity}%
                          </span>
                          <span className="text-gray-300">→</span>
                          <span>
                            {t('mk_crossaisle_votes_like')}:{' '}
                            <span className="font-medium" style={{ color: closestParty?.color }}>
                              {lang === 'he' ? closestParty?.name_he : closestParty?.name_en}
                            </span>
                            {' '}{result.closest_similarity}%
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-sm font-bold text-amber-500">+{result.divergence}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Tab 4: MK Map */}
        {activeTab === 'map' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">{t('mk_map_subtitle')}</p>
            {hoveredMkId && (() => {
              const mk = mks.find(m => m.id === hoveredMkId)
              const party = mk ? parties.find(p => p.id === mk.party_id) : null
              if (!mk) return null
              return (
                <div className="px-3 py-2 bg-white rounded-xl border border-gray-200 text-sm flex items-center gap-2">
                  <span className="font-medium text-gray-900">
                    {lang === 'he' ? mk.name_he : (mk.name_en || mk.name_he)}
                  </span>
                  {party && (
                    <span className="text-xs font-medium" style={{ color: party.color }}>
                      {lang === 'he' ? party.name_he : party.name_en}
                    </span>
                  )}
                </div>
              )
            })()}
            <MKMap
              partyPoints={mkMapData.partyPoints}
              mkPoints={mkMapData.mkPoints}
              parties={parties}
              mks={mks}
              lang={lang}
              highlightMkId={hoveredMkId}
              onMKHover={setHoveredMkId}
            />
            <p className="text-xs text-gray-400 text-center">{t('mk_map_data_note')}</p>
          </div>
        )}

      </main>
    </div>
  )
}
