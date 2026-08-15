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
import { useSurveyMode, getActiveQuestions } from '../utils/surveyMode'
import { encodeAnswers, decodeAnswers } from '../utils/encoding'
import { CompassRose, GridPaper, B, ACCENT, BureauCard } from '../components/bureau/BureauComponents'
import type { Party, PartyPosition, Question, KnessetMember, UserAnswers } from '../types'

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
import achdutPos from '../data/positions/achdut.json'
import baladPos from '../data/positions/balad.json'

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
  achdut:             achdutPos.positions as PartyPosition[],
  balad:             baladPos.positions as PartyPosition[],
}

function toRadarPct(score: number) {
  return Math.round(((score + 2) / 4) * 100)
}

function computeUserDimScores(answers: Record<string, number | null>): Record<DimensionKey, number> {
  const result = {} as Record<DimensionKey, number>
  for (const dim of Object.keys(DIMENSIONS) as DimensionKey[]) {
    const vals = (DIMENSIONS[dim].questions as readonly string[]).flatMap(qid => {
      const v = answers[qid]
      if (v === null || v === undefined) return []
      const polarity = questions.find(q => q.id === qid)?.polarity ?? 1
      return [v * polarity]
    })
    result[dim] = vals.length > 0 ? toRadarPct(vals.reduce((a, b) => a + b, 0) / vals.length) : 50
  }
  return result
}

// answeredQids filters the party radar to only questions the user answered,
// keeping it consistent with the gap bars which also use only answered questions.
function computePartyDimScores(positions: PartyPosition[], mode: 'stated' | 'voted', answeredQids?: Set<string>): Record<DimensionKey, number> {
  const result = {} as Record<DimensionKey, number>
  for (const dim of Object.keys(DIMENSIONS) as DimensionKey[]) {
    const vals: number[] = []
    for (const qid of DIMENSIONS[dim].questions as readonly string[]) {
      if (answeredQids && !answeredQids.has(qid)) continue
      const pos = positions.find(p => p.question_id === qid)
      if (!pos) continue
      const s = mode === 'stated' ? pos.stated_position?.score : (pos.voted_position?.score ?? pos.stated_position?.score)
      if (s !== null && s !== undefined) {
        const polarity = questions.find(q => q.id === qid)?.polarity ?? 1
        vals.push(s * polarity)
      }
    }
    result[dim] = vals.length > 0 ? toRadarPct(vals.reduce((a, b) => a + b, 0) / vals.length) : 50
  }
  return result
}

export function ResultsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { answers, weights, lang, reset, setAnswer, answeredCount, totalCount } = useSurveyStore()
  const { prefix, mode: surveyMode } = useSurveyMode()
  const activeAnswers = useMemo((): UserAnswers => {
    if (surveyMode === 'full') return answers
    const shortIds = new Set(getActiveQuestions('short').map(q => q.id))
    return Object.fromEntries(
      Object.entries(answers).filter(([qid]) => shortIds.has(qid))
    ) as UserAnswers
  }, [answers, surveyMode])
  const isHe = lang === 'he'
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
  const SHARE_TEXT_EN = 'I took the Vote Compass quiz and found out who I should vote for!\nWant to find out too?\ntinyurl.com/matzpen26'
  const shareText = isHe ? SHARE_TEXT_HE : SHARE_TEXT_EN

  const compareParam = searchParams.get('compare')
  const aParam = searchParams.get('a')

  const friendAnswers = useMemo(() => {
    if (!compareParam) return null
    const decoded = decodeAnswers(compareParam)
    return Object.keys(decoded).length > 0 ? decoded : null
  }, [compareParam])

  useEffect(() => {
    if (aParam) {
      const decoded = decodeAnswers(aParam)
      if (Object.keys(decoded).length > 0) {
        reset()
        for (const [qid, score] of Object.entries(decoded)) setAnswer(qid, score)
      }
    }
    if (!compareParam) {
      const pending = sessionStorage.getItem('pendingCompare')
      if (pending && answeredCount() > 0) {
        sessionStorage.removeItem('pendingCompare')
        setSearchParams(prev => { const next = new URLSearchParams(prev); next.set('compare', pending); return next }, { replace: true })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (answeredCount() < 5) return
    if (sessionStorage.getItem('submitted')) return
    sessionStorage.setItem('submitted', '1')
    fetch('/api/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-secret': import.meta.env.VITE_API_SECRET ?? '' },
      body: JSON.stringify({
        answers,
        lang,
        referrer: document.referrer || null,
        survey_mode: surveyMode,
      }),
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleShare = useCallback(() => {
    const encoded = encodeAnswers(activeAnswers)
    const url = `${window.location.origin}${prefix}/results?a=${encoded}`
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500) })
  }, [activeAnswers, prefix])

  const handleCompare = useCallback(async () => {
    const encoded = encodeAnswers(activeAnswers)
    const url = `${window.location.origin}${prefix}/results?compare=${encoded}`
    const compareText = isHe
      ? `עניתי על מצפן הבחירות. ענו גם אתם ונוכל להשוות את התוצאות שלנו!\n${url}`
      : `Take the Vote Compass quiz and let's compare results!\n${url}`
    if (navigator.share) {
      try { await navigator.share({ text: compareText }); return } catch {}
    }
    navigator.clipboard.writeText(url).then(() => { setCompareCopied(true); setTimeout(() => setCompareCopied(false), 2500) })
  }, [activeAnswers, isHe, prefix])

  const handleShareImage = useCallback(async () => {
    if (!shareCardRef.current || sharePendingRef.current) return
    sharePendingRef.current = true
    setSharingImage(true)
    try {
      const { toCanvas } = await import('html-to-image')
      const canvas = await toCanvas(shareCardRef.current, { pixelRatio: 2 })
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('toBlob returned null')
      const file = new File([blob], 'matzpen-results.png', { type: 'image/png' })
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      if (isMobile && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: shareText, title: isHe ? 'מצפן הבחירות - התוצאות שלי' : 'Vote Compass - My Results' })
      } else {
        const textBlob = new Blob([shareText], { type: 'text/plain' })
        if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob, 'text/plain': textBlob })])
        } else {
          const objectUrl = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = objectUrl; link.download = 'matzpen-results.png'; link.click()
          URL.revokeObjectURL(objectUrl)
        }
        setImageCopied(true); setTimeout(() => setImageCopied(false), 3000)
      }
    } catch (err) { console.error('Share image failed:', err) }
    finally { setSharingImage(false); sharePendingRef.current = false }
  }, [isHe, shareText])

  const rankedBase = useMemo(() => rankParties(activeAnswers, allPositions, weights), [activeAnswers, weights])
  const ranked = useMemo(() => mode === 'voted'
    ? [...rankedBase].sort((a, b) => (b.overall_voted ?? b.overall_stated) - (a.overall_voted ?? a.overall_stated))
    : rankedBase, [rankedBase, mode])
  const rankedMKs = useMemo(() => rankMKs(activeAnswers, mkPositions, weights), [activeAnswers, weights])
  const userDimScores = useMemo(() => computeUserDimScores(activeAnswers), [activeAnswers])
  const answeredQids = useMemo(() =>
    new Set(Object.entries(activeAnswers).filter(([, v]) => v !== null && v !== undefined).map(([k]) => k)),
    [activeAnswers]
  )

  const effectivePartyId = selectedPartyId ?? ranked[0]?.party_id ?? ''
  const selectedParty = parties.find(p => p.id === effectivePartyId)
  const selectedPositions = allPositions[effectivePartyId] ?? []
  const partyName = selectedParty ? (isHe ? selectedParty.name_he : selectedParty.name_en) : effectivePartyId
  const partyDimScores = useMemo(() => computePartyDimScores(selectedPositions, mode, answeredQids), [effectivePartyId, mode, answeredQids]) // eslint-disable-line react-hooks/exhaustive-deps
  const topPartyPositions = allPositions[ranked[0]?.party_id ?? ''] ?? []
  const topPartyDimScores = useMemo(() => computePartyDimScores(topPartyPositions, 'stated', answeredQids), [ranked[0]?.party_id, answeredQids]) // eslint-disable-line react-hooks/exhaustive-deps

  const friendDimScores = useMemo(() => friendAnswers ? computeUserDimScores(friendAnswers) : null, [friendAnswers])

  const answered = answeredCount()
  const total = totalCount()
  const topMatch = ranked[0]
  const topParty = topMatch ? parties.find(p => p.id === topMatch.party_id) : null

  if (answered === 0) {
    if (aParam) return null
    if (compareParam) sessionStorage.setItem('pendingCompare', compareParam)
    return <Navigate to="/" replace />
  }

  return (
    <div style={{ minHeight: '100dvh', background: B.bg }}>

      {/* Header */}
      <header style={{
        background: `${B.bg}f5`,
        backdropFilter: 'blur(8px)',
        borderBottom: `1px solid ${B.border}`,
        position: 'sticky',
        top: 0,
        zIndex: 10,
        padding: '12px 20px',
      }}>
        <div style={{
          maxWidth: 480,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <CompassRose size={20} accent={ACCENT} lang={lang} />
          <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: B.ink }}>
            {isHe ? 'מצפן הבחירות' : 'Vote Compass Israel'}
          </span>
          <LanguageSwitcher />
        </div>
      </header>

      <main style={{ maxWidth: 480, margin: '0 auto', padding: '0 20px 40px' }}>

        {/* Hero headline */}
        <div style={{ padding: '24px 0 20px', position: 'relative' }}>
          <GridPaper opacity={0.025} />
          <h1 style={{
            fontSize: 34,
            fontWeight: 900,
            letterSpacing: '-0.025em',
            lineHeight: 0.95,
            color: B.ink,
            marginBottom: 6,
            position: 'relative',
          }}>
            {isHe
              ? <>{`אתם נמצאים`}<br /><span style={{ color: ACCENT }}>{`כאן`}</span></>
              : <>{`Here is`}<br /><span style={{ color: ACCENT }}>{`where you stand.`}</span></>
            }
          </h1>
          <p style={{ fontSize: 13, color: B.inkFaint, position: 'relative' }}>
            {t('results_subtitle', { answered, total })}
          </p>
        </div>

        {/* Top match hero */}
        {topParty && topMatch && (
          <div style={{
            marginBottom: 16,
            padding: '16px',
            background: `${topParty.color}08`,
            border: `1.5px solid ${topParty.color}25`,
            borderRadius: B.radiusLg,
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute',
              insetInlineEnd: -20,
              bottom: -20,
              opacity: 0.06,
            }}>
              <CompassRose size={120} color={topParty.color} accent={topParty.color} lang={lang} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: B.inkFaint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
              {t('top_match')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
              {topParty.logo && (
                <img
                  src={topParty.logo}
                  alt={topParty.name_en}
                  style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'contain', background: `${topParty.color}14`, border: `1.5px solid ${topParty.color}44`, padding: 4, flexShrink: 0 }}
                />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: B.ink, lineHeight: 1.05 }}>
                  {isHe ? topParty.name_he : topParty.name_en}
                </div>
                <div style={{ fontSize: 12, color: B.inkFaint, marginTop: 3 }}>
                  {topParty.poll_seats ? `${topParty.poll_seats} ${t('poll_seats')}` : `${topParty.seats} ${t('seats')}`}
                </div>
              </div>
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: 38, fontWeight: 900, color: topParty.color, lineHeight: 0.95 }}>
                  {topMatch.overall_stated}<span style={{ fontSize: 18 }}>%</span>
                </div>
                <div style={{ fontSize: 10, color: B.inkFaint, letterSpacing: '0.08em' }}>{t('match')}</div>
              </div>
            </div>
          </div>
        )}

        {/* Mode toggle */}
        <div style={{
          display: 'flex',
          background: B.bgMid,
          borderRadius: 12,
          padding: 3,
          gap: 2,
          marginBottom: 16,
        }}>
          {(['stated', 'voted'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: 9,
                border: 'none',
                background: mode === m ? B.white : 'transparent',
                fontSize: 13,
                fontWeight: 600,
                color: mode === m ? B.ink : B.inkFaint,
                cursor: 'pointer',
                boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {m === 'stated' ? t('stated_positions') : t('actual_votes')}
            </button>
          ))}
        </div>

        {/* Comparison card */}
        <BureauCard style={{ marginBottom: 16, overflow: 'visible' }}>
          {/* Party selector */}
          <div style={{ borderBottom: `1px solid ${B.border}`, padding: '14px 16px 12px' }}>
            <p style={{ fontSize: 11, color: B.inkFaint, marginBottom: 10, letterSpacing: '0.04em' }}>{t('compare_with')}</p>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }} className="no-scrollbar">
              {ranked.map((match, i) => {
                const party = parties.find(p => p.id === match.party_id)
                if (!party) return null
                const name = isHe ? party.name_he : party.name_en
                const isSelected = match.party_id === effectivePartyId
                const score = mode === 'stated' ? match.overall_stated : (match.overall_voted ?? match.overall_stated)
                return (
                  <button
                    key={match.party_id}
                    onClick={() => setSelectedPartyId(match.party_id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      flexShrink: 0,
                      padding: '6px 8px',
                      borderRadius: 10,
                      background: isSelected ? B.bgMid : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      width: 32, height: 32,
                      borderRadius: '50%',
                      background: party.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 800,
                      boxShadow: isSelected ? `0 0 0 2px ${B.white}, 0 0 0 4px ${party.color}` : 'none',
                    }}>
                      {i + 1}
                    </div>
                    <span style={{ fontSize: 10, color: B.inkSoft, maxWidth: 70, textAlign: 'center', lineHeight: 1.3 }}>{name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: party.color }}>{score}%</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Radar */}
          <div style={{ padding: '4px 4px 0' }}>
            <MatchRadarChart
              userDimScores={userDimScores}
              partyDimScores={partyDimScores}
              partyName={partyName}
              partyColor={selectedParty?.color ?? '#888'}
              friendDimScores={friendDimScores}
            />
          </div>

          {/* Dimension gap bars */}
          <div style={{ padding: '8px 16px 16px' }}>
            <p style={{ fontSize: 11, color: B.inkFaint, marginBottom: 12, letterSpacing: '0.04em' }}>{t('dimension_breakdown')}</p>
            <DimensionGapBars
              userAnswers={activeAnswers}
              partyPositions={selectedPositions}
              partyColor={selectedParty?.color ?? '#888'}
              partyName={partyName}
              mode={mode}
              questions={questions}
              friendAnswers={friendAnswers}
            />
          </div>
        </BureauCard>

        {/* Share image */}
        <button
          onClick={handleShareImage}
          disabled={sharingImage}
          style={{
            width: '100%',
            padding: '14px',
            background: ACCENT,
            color: '#fff',
            border: 'none',
            borderRadius: B.radius,
            fontSize: 14,
            fontWeight: 700,
            cursor: sharingImage ? 'not-allowed' : 'pointer',
            opacity: sharingImage ? 0.7 : 1,
            marginBottom: 10,
          }}
        >
          {sharingImage ? t('share_generating') : imageCopied ? (isHe ? '✓ הועתק! הדביקו בווצאפ' : '✓ Copied! Paste in WhatsApp') : t('share_image')}
        </button>

        {/* Share / compare links */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <button
            onClick={handleShare}
            style={{
              flex: 1, padding: '12px',
              background: B.white,
              border: `1px solid ${B.border}`,
              borderRadius: B.radius,
              fontSize: 13, fontWeight: 500,
              color: ACCENT,
              cursor: 'pointer',
            }}
          >
            {copied ? t('share_copied') : t('share_link')}
          </button>
          <button
            onClick={handleCompare}
            style={{
              flex: 1, padding: '12px',
              background: B.white,
              border: `1px solid ${B.border}`,
              borderRadius: B.radius,
              fontSize: 13, fontWeight: 600,
              color: '#7c3aed',
              cursor: 'pointer',
            }}
          >
            {compareCopied ? t('compare_copied') : t('compare_with_friend')}
          </button>
        </div>

        {/* Friend comparison panel */}
        {friendAnswers && (
          <ComparisonPanel
            myAnswers={activeAnswers}
            friendAnswers={friendAnswers}
            allPositions={allPositions}
            parties={parties}
            lang={lang}
            mode={mode}
            myDimScores={userDimScores}
            friendDimScores={friendDimScores}
          />
        )}

        {/* Ideological map */}
        <BureauCard style={{ marginBottom: 16, padding: '16px' }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: B.ink, marginBottom: 12 }}>{t('similarity_title')}</h2>
          <PartyMap
            allPositions={allPositions}
            parties={parties}
            mode={mapMode}
            onModeChange={setMapMode}
            lang={lang}
            userAnswers={activeAnswers}
            friendAnswers={friendAnswers ?? undefined}
          />
        </BureauCard>

        <MKMatchList topMKs={rankedMKs} mks={mks} parties={parties} />

        {rankedMKs.length > 0 && (
          <button
            onClick={() => navigate('/mks')}
            style={{
              width: '100%', padding: '13px',
              background: B.white, border: `1px solid ${B.border}`,
              borderRadius: B.radius, fontSize: 13, fontWeight: 600,
              color: B.inkSoft, cursor: 'pointer', marginBottom: 8,
            }}
          >
            {t('open_mk_compass')}
          </button>
        )}

        <button
          onClick={() => navigate('/research')}
          style={{
            width: '100%', padding: '13px',
            background: B.white, border: `1px solid ${B.border}`,
            borderRadius: B.radius, fontSize: 13, fontWeight: 600,
            color: B.inkSoft, cursor: 'pointer', marginBottom: 8,
          }}
        >
          {t('explore_research')}
        </button>

        {surveyMode === 'short' && (
          <button
            onClick={() => navigate('/full/survey?continue=true')}
            style={{
              width: '100%', padding: '13px',
              background: B.white, border: `1px solid ${B.border}`,
              borderRadius: B.radius, fontSize: 13, fontWeight: 600,
              color: B.ink, cursor: 'pointer', marginBottom: 8,
            }}
          >
            {isHe ? `שאלון מורחב ← התאמה מדויקת יותר` : `Full survey ← better match accuracy`}
          </button>
        )}

        <button
          onClick={() => { reset(); navigate(prefix || '/') }}
          style={{
            width: '100%', padding: '12px',
            background: 'transparent', border: 'none',
            fontSize: 13, color: B.inkFaint,
            textDecoration: 'underline', textDecorationColor: B.border,
            cursor: 'pointer',
          }}
        >
          {t('restart')}
        </button>
      </main>

      {/* Hidden share card */}
      {ranked[0] && parties.find(p => p.id === ranked[0].party_id) && (
        <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}>
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
