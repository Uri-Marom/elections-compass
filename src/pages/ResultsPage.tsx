import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../components/shared/LanguageSwitcher'
import { MatchRadarChart } from '../components/Results/RadarChart'
import { DimensionGapBars } from '../components/Results/DimensionGapBars'
import { MKMatchList } from '../components/Results/MKMatchList'
import { ShareCard } from '../components/Results/ShareCard'
import { PartyMap } from '../components/Research/PartyMap'
import { useSurveyStore } from '../store/survey'
import { rankParties, rankMKs, DIMENSIONS, type DimensionKey } from '../utils/matching'
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

// Fixed question order — 30 questions, 6 states each (0=skipped, 1–5 = answer -2 to +2).
const QUESTION_ORDER = [
  'q01','q02','q03','q04','q05','q06','q07','q08','q09','q10',
  'q11','q12','q16','q18','q19','q20','q21','q22','q23','q24',
  'q25','q26','q27','q28','q29','q31','q32','q33','q34','q35',
]

// URL-safe base-64 alphabet (no + or /)
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

// Encode all 30 answers as a single base-6 BigInt, then write in base-64url.
// 6^30 < 64^13, so result is always exactly 13 chars.
function encodeAnswers(answers: Record<string, number | null>): string {
  let n = 0n
  for (const qid of QUESTION_ORDER) {
    const v = answers[qid]
    n = n * 6n + (v === null || v === undefined ? 0n : BigInt(v + 3))
  }
  const chars: string[] = []
  for (let i = 0; i < 13; i++) {
    chars.unshift(B64[Number(n % 64n)])
    n /= 64n
  }
  return chars.join('')
}

function decodeAnswers(encoded: string): Record<string, number | null> {
  const result: Record<string, number | null> = {}

  // New 13-char base-64url format
  if (/^[A-Za-z0-9\-_]{13}$/.test(encoded)) {
    try {
      let n = 0n
      for (const ch of encoded) {
        const idx = B64.indexOf(ch)
        if (idx < 0) throw new Error('bad char')
        n = n * 64n + BigInt(idx)
      }
      const states: number[] = new Array(30)
      for (let i = 29; i >= 0; i--) {
        states[i] = Number(n % 6n)
        n /= 6n
      }
      for (let i = 0; i < QUESTION_ORDER.length; i++) {
        if (states[i] !== 0) result[QUESTION_ORDER[i]] = states[i] - 3
      }
    } catch { /* malformed — return empty */ }
    return result
  }

  // v2: 30-char hex format (one nibble per question)
  if (encoded && !encoded.includes(':') && !encoded.includes(',') && encoded.length >= 20) {
    for (let i = 0; i < Math.min(encoded.length, QUESTION_ORDER.length); i++) {
      const n = parseInt(encoded[i], 16)
      if (!isNaN(n) && n !== 0) result[QUESTION_ORDER[i]] = n - 3
    }
    return result
  }

  // v1: legacy "01:2,02:-1,…" format
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
  const [mapMode, setMapMode] = useState<'stated' | 'voted'>('stated')
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [sharingImage, setSharingImage] = useState(false)
  const [imageCopied, setImageCopied] = useState(false)
  const shareCardRef = useRef<HTMLDivElement>(null)
  const sharePendingRef = useRef(false)

  const SHARE_TEXT_HE = 'עניתי על השאלון של מצפן הבחירות וגיליתי למי כדאי לי להצביע!\nרוצים גם?\ntinyurl.com/matzpen26'
  const SHARE_TEXT_EN = 'I took the Election Compass quiz and found out who I should vote for!\nWant to find out too?\ntinyurl.com/matzpen26'
  const shareText = lang === 'he' ? SHARE_TEXT_HE : SHARE_TEXT_EN

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
      } else if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        setImageCopied(true)
        setTimeout(() => setImageCopied(false), 2500)
      } else {
        const objectUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = objectUrl
        link.download = 'matzpen-results.png'
        link.click()
        URL.revokeObjectURL(objectUrl)
      }
    } catch (err) {
      console.error('Share image failed:', err)
    } finally {
      setSharingImage(false)
      sharePendingRef.current = false
    }
  }, [lang, shareText])

  const ranked = useMemo(
    () => rankParties(answers, allPositions, weights),
    [answers, weights]
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
              questions={questions}
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
            ? (lang === 'he' ? '✓ הועתק ללוח!' : '✓ Copied!')
            : t('share_image')}
        </button>

        {/* Copy link (secondary) */}
        <button
          onClick={handleShare}
          className="w-full py-2 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          {copied ? t('share_copied') : t('share_link')}
        </button>

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
