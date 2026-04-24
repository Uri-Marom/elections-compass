import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../components/shared/LanguageSwitcher'
import { MatchRadarChart } from '../components/Results/RadarChart'
import { DimensionGapBars } from '../components/Results/DimensionGapBars'
import { PartyCard } from '../components/Results/PartyCard'
import { useSurveyStore } from '../store/survey'
import { rankParties, DIMENSIONS, type DimensionKey } from '../utils/matching'
import type { Party, PartyPosition } from '../types'

import partiesData from '../data/parties.json'
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

const allPositions: Record<string, PartyPosition[]> = {
  likud:            likudPos.positions as PartyPosition[],
  shas:             shasPos.positions as PartyPosition[],
  utj:              utjPos.positions as PartyPosition[],
  otzma:            otzmaPos.positions as PartyPosition[],
  religious_zionism: rzpPos.positions as PartyPosition[],
  yesh_atid:        yeshAtidPos.positions as PartyPosition[],
  national_unity:   nationalUnityPos.positions as PartyPosition[],
  bennett_2026:     bennettPos.positions as PartyPosition[],
  yashar:           yasharPos.positions as PartyPosition[],
  democrats:        democratsPos.positions as PartyPosition[],
  yisrael_beitenu:  yisraelPos.positions as PartyPosition[],
  miluimnikim:      miluimnikimPos.positions as PartyPosition[],
  hadash_taal:      hadashPos.positions as PartyPosition[],
  raam:             raamPos.positions as PartyPosition[],
}

// Map raw score [-2, +2] → [0, 100] for radar axes
function toRadarPct(score: number) {
  return Math.round(((score + 2) / 4) * 100)
}

function computeUserDimScores(answers: Record<string, number | null>): Record<DimensionKey, number> {
  const result = {} as Record<DimensionKey, number>
  for (const dim of Object.keys(DIMENSIONS) as DimensionKey[]) {
    const vals = (DIMENSIONS[dim].questions as readonly string[])
      .map(qid => answers[qid])
      .filter((v): v is number => v !== null && v !== undefined)
    result[dim] = vals.length > 0
      ? toRadarPct(vals.reduce((a, b) => a + b, 0) / vals.length)
      : 50
  }
  return result
}

function computePartyDimScores(
  positions: PartyPosition[],
  mode: 'stated' | 'voted'
): Record<DimensionKey, number> {
  const result = {} as Record<DimensionKey, number>
  for (const dim of Object.keys(DIMENSIONS) as DimensionKey[]) {
    const vals: number[] = []
    for (const qid of DIMENSIONS[dim].questions as readonly string[]) {
      const pos = positions.find(p => p.question_id === qid)
      if (!pos) continue
      const s = mode === 'stated'
        ? pos.stated_position?.score
        : (pos.voted_position?.score ?? pos.stated_position?.score)
      if (s !== null && s !== undefined) vals.push(s)
    }
    result[dim] = vals.length > 0
      ? toRadarPct(vals.reduce((a, b) => a + b, 0) / vals.length)
      : 50
  }
  return result
}

function encodeAnswers(answers: Record<string, number | null>): string {
  return Object.entries(answers)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${k.replace('q', '')}:${v}`)
    .join(',')
}

function decodeAnswers(encoded: string): Record<string, number | null> {
  const result: Record<string, number | null> = {}
  for (const pair of encoded.split(',')) {
    const [num, val] = pair.split(':')
    if (num && val !== undefined) {
      const score = Number(val)
      if (!isNaN(score)) result[`q${num}`] = score
    }
  }
  return result
}

export function ResultsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { answers, weights, lang, reset, setAnswer, answeredCount, totalCount } = useSurveyStore()
  const [mode, setMode] = useState<'stated' | 'voted'>('stated')
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Hydrate answers from URL share param on first load
  useEffect(() => {
    const encoded = searchParams.get('a')
    if (encoded && answeredCount() === 0) {
      const decoded = decodeAnswers(encoded)
      for (const [qid, score] of Object.entries(decoded)) {
        setAnswer(qid, score)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleShare = useCallback(() => {
    const encoded = encodeAnswers(answers)
    const url = `${window.location.origin}/results?a=${encoded}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }, [answers])

  const ranked = useMemo(
    () => rankParties(answers, allPositions, weights),
    [answers, weights]
  )

  const userDimScores = useMemo(() => computeUserDimScores(answers), [answers])

  const effectivePartyId = selectedPartyId ?? ranked[0]?.party_id ?? ''
  const selectedParty = parties.find(p => p.id === effectivePartyId)
  const selectedPositions = allPositions[effectivePartyId] ?? []
  const partyName = selectedParty
    ? (lang === 'he' ? selectedParty.name_he : selectedParty.name_en)
    : effectivePartyId

  const partyDimScores = useMemo(
    () => computePartyDimScores(selectedPositions, mode),
    [effectivePartyId, mode] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const answered = answeredCount()
  const total = totalCount()

  if (answered === 0) {
    navigate('/')
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <h1 className="flex-1 text-lg font-bold text-gray-900">{t('results_title')}</h1>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <p className="text-sm text-gray-500">
          {t('results_subtitle', { answered, total })}
        </p>

        {/* Mode toggle */}
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          {(['stated', 'voted'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={[
                'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
                mode === m
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              {m === 'stated' ? t('stated_positions') : t('actual_votes')}
            </button>
          ))}
        </div>

        {/* Comparison card */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          {/* Party selector */}
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400 mb-2">{t('compare_with')}</p>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {ranked.map((match, i) => {
                const party = parties.find(p => p.id === match.party_id)
                if (!party) return null
                const name = lang === 'he' ? party.name_he : party.name_en
                const isSelected = match.party_id === effectivePartyId
                const score = mode === 'stated'
                  ? match.overall_stated
                  : (match.overall_voted ?? match.overall_stated)
                return (
                  <button
                    key={match.party_id}
                    onClick={() => setSelectedPartyId(match.party_id)}
                    className={[
                      'flex flex-col items-center gap-1 shrink-0 transition-all rounded-xl px-2 py-1.5',
                      isSelected ? 'bg-gray-100' : 'hover:bg-gray-50',
                    ].join(' ')}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold border-2"
                      style={{
                        backgroundColor: party.color,
                        borderColor: isSelected ? '#1d4ed8' : 'transparent',
                        boxShadow: isSelected ? `0 0 0 2px white, 0 0 0 4px ${party.color}` : 'none',
                      }}
                    >
                      {i + 1}
                    </div>
                    <span className="text-xs text-gray-600 max-w-[48px] text-center leading-tight">{name}</span>
                    <span className="text-xs font-semibold" style={{ color: party.color }}>{score}%</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Radar */}
          <div className="px-2 pt-4">
            <MatchRadarChart
              userDimScores={userDimScores}
              partyDimScores={partyDimScores}
              partyName={partyName}
              partyColor={selectedParty?.color ?? '#888'}
            />
          </div>

          {/* Dimension gap bars */}
          <div className="px-5 pb-5 pt-2">
            <p className="text-xs text-gray-400 mb-3">{t('dimension_breakdown')}</p>
            <DimensionGapBars
              userAnswers={answers}
              partyPositions={selectedPositions}
              partyColor={selectedParty?.color ?? '#888'}
              partyName={partyName}
              mode={mode}
            />
          </div>
        </div>

        {/* Full ranked list */}
        <div className="space-y-3">
          {ranked.map((match, i) => {
            const party = parties.find(p => p.id === match.party_id)
            if (!party) return null
            return (
              <PartyCard
                key={match.party_id}
                match={match}
                party={party}
                rank={i + 1}
                mode={mode}
              />
            )
          })}
        </div>

        <button
          onClick={() => navigate('/research')}
          className="w-full py-3 rounded-xl bg-white border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
        >
          {t('explore_research')}
        </button>

        <button
          onClick={handleShare}
          className="w-full py-3 rounded-xl bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 transition-colors"
        >
          {copied ? t('share_copied') : t('share')}
        </button>

        <button
          onClick={() => { reset(); navigate('/') }}
          className="w-full py-3 text-sm text-gray-500 hover:text-gray-700 underline"
        >
          {t('restart')}
        </button>
      </main>
    </div>
  )
}
