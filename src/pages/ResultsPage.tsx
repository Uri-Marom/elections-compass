import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../components/shared/LanguageSwitcher'
import { MatchRadarChart } from '../components/Results/RadarChart'
import { DimensionGapBars } from '../components/Results/DimensionGapBars'
import { MKMatchList } from '../components/Results/MKMatchList'
import { ShareCard } from '../components/Results/ShareCard'
import { ComparisonPanel } from '../components/Results/ComparisonPanel'
import { PartyMap } from '../components/Research/PartyMap'
import { useSurveyStore } from '../store/survey'
import { rankParties, rankMKs, DIMENSIONS, type DimensionKey } from '../utils/matching'
import { encodeAnswers, decodeAnswers } from '../utils/encoding'
import { computePartyAxes, computeUserMapPoint } from '../utils/research'
import type { Party, PartyPosition, Question, KnessetMember } from '../types'

import partiesData from '../data/parties.json'
import questionsData from '../data/questions.json'
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

const parties = partiesData as Party[]
const questions = questionsData as Question[]
const mks = mksData as KnessetMember[]
const mkPositions = mkPositionsData as Record<string, Record<string, number | null>>

const allPositions: Record<string, PartyPosition[]> = {
  likud:            likudPos.positions as PartyPosition[],
  shas:             shasPos.positions as PartyPosition[],
  utj:              utjPos.positions as PartyPosition[],
  otzma:            otzmaPos.positions as PartyPosition[],
  religious_zionism: rzpPos.positions as PartyPosition[],
  beyachad:         beyachadPos.positions as PartyPosition[],
  national_unity:   nationalUnityPos.positions as PartyPosition[],
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
      .flatMap(qid => {
        const v = answers[qid]
        if (v === null || v === undefined) return []
        const polarity = questions.find(q => q.id === qid)?.polarity ?? 1
        return [v * polarity]
      })
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
      if (s !== null && s !== undefined) {
        const polarity = questions.find(q => q.id === qid)?.polarity ?? 1
        vals.push(s * polarity)
      }
    }
    result[dim] = vals.length > 0
      ? toRadarPct(vals.reduce((a, b) => a + b, 0) / vals.length)
      : 50
  }
  return result
}

export function ResultsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { answers, weights, lang, reset, setAnswer, answeredCount, totalCount } = useSurveyStore()
  const [mode, setMode] = useState<'stated' | 'voted'>('stated')
  const [mapMode, setMapMode] = useState<'stated' | 'voted'>('stated')
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [compareCopied, setCompareCopied] = useState(false)
  const [sharingImage, setSharingImage] = useState(false)
  const [imageCopied, setImageCopied] = useState(false)
  const shareCardRef = useRef<HTMLDivElement>(null)
  const sharePendingRef = useRef(false)

  const SHARE_TEXT_HE = 'עניתי על השאלון של מצפן הבחירות וגיליתי למי כדאי לי להצביע!\nרוצים גם?\ntinyurl.com/matzpen26'
  const SHARE_TEXT_EN = 'I took the Election Compass quiz and found out who I should vote for!\nWant to find out too?\ntinyurl.com/matzpen26'
  const shareText = lang === 'he' ? SHARE_TEXT_HE : SHARE_TEXT_EN

  const compareParam = searchParams.get('compare')
  const aParam = searchParams.get('a')

  // Decode friend's answers from URL (never put into store)
  const friendAnswers = useMemo(() => {
    if (!compareParam) return null
    const decoded = decodeAnswers(compareParam)
    return Object.keys(decoded).length > 0 ? decoded : null
  }, [compareParam])

  // Hydrate own answers from ?a= and handle compare routing
  useEffect(() => {
    if (aParam && answeredCount() === 0) {
      const decoded = decodeAnswers(aParam)
      for (const [qid, score] of Object.entries(decoded)) {
        setAnswer(qid, score)
      }
    }

    // Pending compare from sessionStorage (B just finished the quiz)
    if (!compareParam) {
      const pending = sessionStorage.getItem('pendingCompare')
      if (pending && answeredCount() > 0) {
        sessionStorage.removeItem('pendingCompare')
        setSearchParams(prev => {
          const next = new URLSearchParams(prev)
          next.set('compare', pending)
          return next
        }, { replace: true })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Anonymous analytics: fire-and-forget on first real visit
  useEffect(() => {
    if (answeredCount() < 5) return
    if (sessionStorage.getItem('submitted')) return
    sessionStorage.setItem('submitted', '1')
    fetch('/api/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-secret': import.meta.env.VITE_API_SECRET ?? '' },
      body: JSON.stringify({ answers, lang }),
    }).catch(() => {})
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

  const handleCompare = useCallback(async () => {
    const encoded = encodeAnswers(answers)
    const url = `${window.location.origin}/results?compare=${encoded}`
    const compareText = lang === 'he'
      ? `עניתי על מצפן הבחירות. ענו גם אתם ונוכל להשוות את התוצאות שלנו!\n${url}`
      : `Take the Election Compass quiz and let's compare results!\n${url}`
    if (navigator.share) {
      try {
        await navigator.share({ text: compareText })
        return
      } catch {
        // user cancelled or share not supported — fall through to clipboard
      }
    }
    navigator.clipboard.writeText(url).then(() => {
      setCompareCopied(true)
      setTimeout(() => setCompareCopied(false), 2500)
    })
  }, [answers, lang])

  const handleShareImage = useCallback(async () => {
    if (!shareCardRef.current || sharePendingRef.current) return
    sharePendingRef.current = true
    setSharingImage(true)
    try {
      const { toCanvas } = await import('html-to-image')

      // 2x pixel ratio for high-res output. The previous share-sheet doubling bug is
      // gone since we now write directly to clipboard via ClipboardItem.
      const canvas = await toCanvas(shareCardRef.current, { pixelRatio: 2 })

      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))

      if (!blob) throw new Error('toBlob returned null')
      const file = new File([blob], 'matzpen-results.png', { type: 'image/png' })

      // On mobile, use the native share sheet — it receives both the image file and the
      // pre-written text, so WhatsApp/Instagram/Facebook each get both in one tap.
      // On desktop we skip the share sheet (its "Copy" puts two clipboard items, causing
      // WhatsApp to paste twice) and write directly via ClipboardItem instead.
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      if (isMobile && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          text: shareText,
          title: lang === 'he' ? 'מצפן בחירות - התוצאות שלי' : 'Election Compass - My Results',
        })
      } else {
        // Desktop: write image + text as a single ClipboardItem so WhatsApp Web gets the
        // image on paste, and the caption field can pick up the text/plain format.
        const textBlob = new Blob([shareText], { type: 'text/plain' })
        if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob, 'text/plain': textBlob })])
        } else {
          // Fallback: download the file if ClipboardItem isn't available
          const objectUrl = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = objectUrl
          link.download = 'matzpen-results.png'
          link.click()
          URL.revokeObjectURL(objectUrl)
        }
        setImageCopied(true)
        setTimeout(() => setImageCopied(false), 3000)
      }
    } catch (err) {
      console.error('Share image failed:', err)
    } finally {
      setSharingImage(false)
      sharePendingRef.current = false
    }
  }, [lang, shareText])

  const rankedBase = useMemo(
    () => rankParties(answers, allPositions, weights),
    [answers, weights]
  )

  const ranked = useMemo(
    () => mode === 'voted'
      ? [...rankedBase].sort((a, b) =>
          (b.overall_voted ?? b.overall_stated) - (a.overall_voted ?? a.overall_stated))
      : rankedBase,
    [rankedBase, mode]
  )

  const rankedMKs = useMemo(
    () => rankMKs(answers, mkPositions, weights),
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

  const topPartyPositions = allPositions[ranked[0]?.party_id ?? ''] ?? []
  const topPartyDimScores = useMemo(
    () => computePartyDimScores(topPartyPositions, 'stated'),
    [ranked[0]?.party_id] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const axisResult = useMemo(() => computePartyAxes(allPositions, mapMode), [mapMode])
  const mapPoints = axisResult.points
  const userMapPoint = useMemo(() => computeUserMapPoint(answers, axisResult), [answers, axisResult])
  const friendMapPoint = useMemo(
    () => friendAnswers ? computeUserMapPoint(friendAnswers, axisResult) : null,
    [friendAnswers, axisResult]
  )
  const friendDimScores = useMemo(
    () => friendAnswers ? computeUserDimScores(friendAnswers) : null,
    [friendAnswers]
  )

  const answered = answeredCount()
  const total = totalCount()

  // Redirect to intro when there are no answers and no ?a= to hydrate from.
  // If ?a= is present, return null briefly while the useEffect hydrates the store.
  if (answered === 0) {
    if (aParam) return null
    if (compareParam) sessionStorage.setItem('pendingCompare', compareParam)
    return <Navigate to="/" replace />
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
            <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
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
                    <span className="text-[10px] text-gray-600 max-w-[80px] text-center leading-tight line-clamp-2 break-words">{name}</span>
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
              friendDimScores={friendDimScores}
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
              questions={questions}
              friendAnswers={friendAnswers}
            />
          </div>
        </div>

        {/* Share image button */}
        <button
          onClick={handleShareImage}
          disabled={sharingImage}
          className="w-full py-3 rounded-xl bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 transition-colors disabled:opacity-60"
        >
          {sharingImage
            ? t('share_generating')
            : imageCopied
            ? (lang === 'he' ? '✓ הועתק! הדביקו בווצאפ' : '✓ Copied! Paste in WhatsApp')
            : t('share_image')}
        </button>

        {/* Share buttons row */}
        <div className="flex gap-2">
          <button
            onClick={handleShare}
            className="flex-1 py-2 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            {copied ? t('share_copied') : t('share_link')}
          </button>
          <button
            onClick={handleCompare}
            className="flex-1 py-2 text-sm text-purple-600 hover:text-purple-800 transition-colors font-medium"
          >
            {compareCopied ? t('compare_copied') : `👥 ${t('compare_with_friend')}`}
          </button>
        </div>

        {/* Friend comparison panel (shown when ?compare= is in URL) */}
        {friendAnswers && (
          <ComparisonPanel
            myAnswers={answers}
            friendAnswers={friendAnswers}
            allPositions={allPositions}
            parties={parties}
            lang={lang}
            mode={mode}
            myDimScores={userDimScores}
            friendDimScores={friendDimScores}
          />
        )}

        {/* 2D ideological map */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm px-4 pt-4 pb-3">
          <h2 className="text-sm font-bold text-gray-900 mb-3">{t('similarity_title')}</h2>
          <PartyMap
            points={mapPoints}
            parties={parties}
            mode={mapMode}
            onModeChange={setMapMode}
            lang={lang}
            userPoint={userMapPoint}
            friendPoint={friendMapPoint}
          />
        </section>

        <MKMatchList topMKs={rankedMKs} mks={mks} parties={parties} />

        {rankedMKs.length > 0 && (
          <button
            onClick={() => navigate('/mks')}
            className="w-full py-3 rounded-xl bg-white border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
          >
            {t('open_mk_compass')}
          </button>
        )}

        <button
          onClick={() => navigate('/research')}
          className="w-full py-3 rounded-xl bg-white border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
        >
          {t('explore_research')}
        </button>

        <button
          onClick={() => { reset(); navigate('/') }}
          className="w-full py-3 text-sm text-gray-500 hover:text-gray-700 underline"
        >
          {t('restart')}
        </button>
      </main>

      {/* Share card: zero-size container keeps it in the render tree but invisible */}
      {ranked[0] && parties.find(p => p.id === ranked[0].party_id) && (
        <div
          aria-hidden="true"
          style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}
        >
          <ShareCard
            ref={shareCardRef}
            topMatches={[ranked[0], ranked[1], ranked[2]]}
            parties={parties}
            userDimScores={userDimScores}
            partyDimScores={topPartyDimScores}
            lang={lang}
          />
        </div>
      )}
    </div>
  )
}
