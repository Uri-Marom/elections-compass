import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Cell,
} from 'recharts'
import { PartyMap } from '../components/Research/PartyMap'
import { rankParties, DIMENSIONS, type DimensionKey } from '../utils/matching'
import { B, ACCENT, DIM_COLOR, BureauCard } from '../components/bureau/BureauComponents'
import type { Party, PartyPosition } from '../types'

import partiesData   from '../data/parties.json'
import questionsData from '../data/questions.json'
import likudPos         from '../data/positions/likud.json'
import shasPos          from '../data/positions/shas.json'
import utjPos           from '../data/positions/utj.json'
import otzmaPos         from '../data/positions/otzma.json'
import rzpPos           from '../data/positions/religious_zionism.json'
import beyachadPos      from '../data/positions/beyachad.json'
import nationalUnityPos from '../data/positions/national_unity.json'
import yasharPos        from '../data/positions/yashar.json'
import democratsPos     from '../data/positions/democrats.json'
import yisraelPos       from '../data/positions/yisrael_beitenu.json'
import miluimnikimPos   from '../data/positions/miluimnikim.json'
import hadashPos        from '../data/positions/hadash_taal.json'
import raamPos          from '../data/positions/raam.json'

const parties = partiesData as Party[]
const questions = questionsData as Array<{ id: string; text_he: string; text_en: string }>

const allPositions: Record<string, PartyPosition[]> = {
  likud:            likudPos.positions         as PartyPosition[],
  shas:             shasPos.positions          as PartyPosition[],
  utj:              utjPos.positions           as PartyPosition[],
  otzma:            otzmaPos.positions         as PartyPosition[],
  religious_zionism: rzpPos.positions          as PartyPosition[],
  beyachad:         beyachadPos.positions      as PartyPosition[],
  national_unity:   nationalUnityPos.positions as PartyPosition[],
  yashar:           yasharPos.positions        as PartyPosition[],
  democrats:        democratsPos.positions     as PartyPosition[],
  yisrael_beitenu:  yisraelPos.positions       as PartyPosition[],
  miluimnikim:      miluimnikimPos.positions   as PartyPosition[],
  hadash_taal:      hadashPos.positions        as PartyPosition[],
  raam:             raamPos.positions          as PartyPosition[],
}

const EQUAL_WEIGHTS = Object.fromEntries(
  Object.keys(DIMENSIONS).map(k => [k, 1])
) as Record<DimensionKey, number>

interface AnalyticsData {
  totals: { submissions: number; full: number; short: number; partial: number; micro: number; he: number; en: number }
  daily: Array<{ date: string; total: number }>
  questionAverages: Record<string, number>
  questionCounts: Record<string, number>
  questionDistributions: Record<string, Record<string, number>>
  referrers: Array<{ source: string; count: number }>
  rawAnswers: Array<{ answers: Record<string, number>; lang: string }>
}

function computePartyMatchCounts(rawAnswers: AnalyticsData['rawAnswers']): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const { answers } of rawAnswers) {
    const ranked = rankParties(answers, allPositions, EQUAL_WEIGHTS)
    if (ranked.length > 0) {
      const top = ranked[0].party_id
      counts[top] = (counts[top] ?? 0) + 1
    }
  }
  return counts
}

function computeDimensionAverages(questionAverages: Record<string, number>): Record<DimensionKey, number> {
  const result = {} as Record<DimensionKey, number>
  for (const [dimKey, dim] of Object.entries(DIMENSIONS)) {
    const vals = (dim.questions as readonly string[])
      .map(qid => questionAverages[qid])
      .filter((v): v is number => v !== undefined)
    result[dimKey as DimensionKey] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  }
  return result
}

function scoreColor(avg: number): string {
  if (avg > 0.4)  return '#16a34a'
  if (avg < -0.4) return '#dc2626'
  return '#94a3b8'
}

// ── Sub-components ──────────────────────────────────────────────────────────

function KeyGate({ onSubmit, error }: { onSubmit: (k: string) => void; error: string }) {
  const [val, setVal] = useState('')
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: B.bg, fontFamily: B.font, padding: 24 }}>
      <div style={{ maxWidth: 320, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>🔒</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: B.ink, marginBottom: 8 }}>אנליטיקה</div>
        <div style={{ fontSize: 14, color: B.inkFaint, marginBottom: 24 }}>הכנס מפתח גישה להמשך</div>
        <input
          type="password"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && val && onSubmit(val)}
          placeholder="API secret"
          style={{ width: '100%', padding: '12px 16px', borderRadius: B.radius, border: `1px solid ${B.border}`,
            fontSize: 14, fontFamily: B.font, background: B.white, color: B.ink, boxSizing: 'border-box',
            outline: 'none', marginBottom: 12 }}
        />
        {error && <div style={{ fontSize: 13, color: '#dc2626', marginBottom: 8 }}>{error}</div>}
        <button onClick={() => val && onSubmit(val)} style={{
          width: '100%', padding: '12px 0', borderRadius: B.radius, border: 'none', cursor: 'pointer',
          background: ACCENT, color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: B.font,
        }}>כניסה</button>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <BureauCard style={{ flex: '1 1 120px', minWidth: 100, textAlign: 'center', padding: '16px 12px' }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: B.ink, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: B.inkFaint, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: B.inkHint, marginTop: 2 }}>{sub}</div>}
    </BureauCard>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 15, fontWeight: 700, color: B.ink, marginBottom: 12, marginTop: 24 }}>
      {children}
    </div>
  )
}

function DailyChart({ daily }: { daily: AnalyticsData['daily'] }) {
  const data = daily.slice(-30).map(d => ({
    date: d.date.slice(5), // MM-DD
    count: d.total,
  }))
  return (
    <BureauCard>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: B.inkHint }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 9, fill: B.inkHint }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: B.white, border: `1px solid ${B.border}`, borderRadius: 10, fontSize: 12, fontFamily: B.font }}
            cursor={{ fill: `${ACCENT}18` }}
          />
          <Bar dataKey="count" fill={ACCENT} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </BureauCard>
  )
}

function DimensionRadar({ dimAverages }: { dimAverages: Record<DimensionKey, number> }) {
  const data = (Object.keys(DIMENSIONS) as DimensionKey[]).map(dim => ({
    subject: DIMENSIONS[dim].label_he,
    value: Math.round(((dimAverages[dim] + 2) / 4) * 100),
    color: DIM_COLOR[dim],
  }))
  return (
    <BureauCard>
      <ResponsiveContainer width="100%" height={260}>
        <RadarChart data={data} margin={{ top: 16, right: 40, bottom: 16, left: 40 }}>
          <PolarGrid stroke={B.border} />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fontSize: 10, fill: B.inkFaint, fontFamily: B.font }}
          />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar dataKey="value" stroke={ACCENT} fill={ACCENT} fillOpacity={0.2} strokeWidth={2} dot={{ r: 3, fill: ACCENT }} />
        </RadarChart>
      </ResponsiveContainer>
    </BureauCard>
  )
}

function PartyMatchChart({ matchCounts }: { matchCounts: Record<string, number> }) {
  const total = Object.values(matchCounts).reduce((a, b) => a + b, 0)
  if (total === 0) return <div style={{ color: B.inkHint, fontSize: 13, textAlign: 'center', padding: 24 }}>אין נתונים</div>

  const sorted = Object.entries(matchCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([partyId, count]) => {
      const party = parties.find(p => p.id === partyId)
      return {
        name: party?.name_he ?? partyId,
        count,
        pct: Math.round((count / total) * 100),
        color: party?.color ?? '#94a3b8',
      }
    })

  return (
    <BureauCard>
      <ResponsiveContainer width="100%" height={Math.max(180, sorted.length * 30 + 20)}>
        <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 8 }}>
          <XAxis type="number" tick={{ fontSize: 9, fill: B.inkHint }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: B.inkSoft, fontFamily: B.font }} axisLine={false} tickLine={false} width={80} />
          <Tooltip
            contentStyle={{ background: B.white, border: `1px solid ${B.border}`, borderRadius: 10, fontSize: 12, fontFamily: B.font }}
            cursor={{ fill: `${ACCENT}12` }}
            formatter={(v) => [`${v} (${Math.round((Number(v) / total) * 100)}%)`, 'משיבים']}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {sorted.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </BureauCard>
  )
}

function QuestionAverages({ questionAverages, questionCounts, totalSubmissions }: {
  questionAverages: Record<string, number>
  questionCounts: Record<string, number>
  totalSubmissions: number
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {(Object.keys(DIMENSIONS) as DimensionKey[]).map(dim => {
        const qids = DIMENSIONS[dim].questions as readonly string[]
        const color = DIM_COLOR[dim]
        const dimQuestions = qids
          .filter(qid => questionAverages[qid] !== undefined)
          .map(qid => {
            const q = questions.find(q => q.id === qid)
            return {
              qid,
              label: q ? q.text_he.slice(0, 50) + (q.text_he.length > 50 ? '…' : '') : qid,
              avg: questionAverages[qid],
              n: questionCounts[qid] ?? 0,
            }
          })
        if (dimQuestions.length === 0) return null
        return (
          <BureauCard key={dim}>
            <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 12 }}>{DIMENSIONS[dim].label_he}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dimQuestions.map(({ qid, label, avg, n }) => {
                const barW = Math.abs(avg) / 2 * 100
                const isPos = avg >= 0
                return (
                  <div key={qid}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: B.inkSoft, direction: 'rtl' }}>{label}</span>
                      <span style={{ fontSize: 11, color: B.inkHint, whiteSpace: 'nowrap', marginRight: 8 }}>
                        {avg > 0 ? '+' : ''}{avg.toFixed(1)} ({n}/{totalSubmissions})
                      </span>
                    </div>
                    <div style={{ height: 6, background: B.bgMid, borderRadius: 3, position: 'relative' }}>
                      <div style={{
                        position: 'absolute',
                        height: '100%',
                        width: `${barW}%`,
                        left: isPos ? '50%' : `${50 - barW}%`,
                        background: scoreColor(avg),
                        borderRadius: 3,
                      }} />
                      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: B.borderMid }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </BureauCard>
        )
      })}
    </div>
  )
}

function CoverageTable({ questionCounts, totalSubmissions }: {
  questionCounts: Record<string, number>
  totalSubmissions: number
}) {
  const sorted = Object.entries(questionCounts)
    .map(([qid, count]) => {
      const q = questions.find(q => q.id === qid)
      return { qid, label: q?.text_he.slice(0, 40) ?? qid, count, pct: Math.round((count / totalSubmissions) * 100) }
    })
    .sort((a, b) => b.pct - a.pct)

  return (
    <BureauCard style={{ padding: 0, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: B.font }}>
        <thead>
          <tr style={{ background: B.bgMid }}>
            <th style={{ textAlign: 'right', padding: '8px 16px', color: B.inkFaint, fontWeight: 600 }}>שאלה</th>
            <th style={{ textAlign: 'center', padding: '8px 12px', color: B.inkFaint, fontWeight: 600, width: 60 }}>%</th>
            <th style={{ textAlign: 'center', padding: '8px 12px', color: B.inkFaint, fontWeight: 600, width: 50 }}>n</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ qid, label, count, pct }, i) => (
            <tr key={qid} style={{ borderTop: `1px solid ${B.border}`, background: i % 2 === 0 ? B.white : B.bg }}>
              <td style={{ padding: '7px 16px', color: B.inkSoft, direction: 'rtl' }}>{label}</td>
              <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                  <div style={{ width: 36, height: 4, background: B.bgMid, borderRadius: 2 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: pct > 70 ? ACCENT : B.inkHint, borderRadius: 2 }} />
                  </div>
                  <span style={{ color: pct > 70 ? B.ink : B.inkFaint, fontWeight: pct > 70 ? 700 : 400 }}>{pct}%</span>
                </div>
              </td>
              <td style={{ padding: '7px 12px', textAlign: 'center', color: B.inkHint }}>{count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </BureauCard>
  )
}

function ReferrersTable({ referrers, totalSubmissions }: {
  referrers: AnalyticsData['referrers']
  totalSubmissions: number
}) {
  if (referrers.length === 0 || (referrers.length === 1 && referrers[0].source === 'direct')) {
    return (
      <BureauCard>
        <div style={{ textAlign: 'center', color: B.inkHint, fontSize: 13, padding: '16px 0' }}>
          אין נתוני הפניה עדיין — יתעדכן מהגרסה הנוכחית ואילך
        </div>
      </BureauCard>
    )
  }
  return (
    <BureauCard style={{ padding: 0, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: B.font }}>
        <thead>
          <tr style={{ background: B.bgMid }}>
            <th style={{ textAlign: 'right', padding: '8px 16px', color: B.inkFaint, fontWeight: 600 }}>מקור</th>
            <th style={{ textAlign: 'center', padding: '8px 12px', color: B.inkFaint, fontWeight: 600, width: 60 }}>%</th>
            <th style={{ textAlign: 'center', padding: '8px 12px', color: B.inkFaint, fontWeight: 600, width: 50 }}>n</th>
          </tr>
        </thead>
        <tbody>
          {referrers.map(({ source, count }, i) => {
            const pct = Math.round((count / totalSubmissions) * 100)
            const displaySource = source.length > 50 ? source.slice(0, 50) + '…' : source
            return (
              <tr key={i} style={{ borderTop: `1px solid ${B.border}`, background: i % 2 === 0 ? B.white : B.bg }}>
                <td style={{ padding: '7px 16px', color: B.inkSoft, direction: 'ltr', textAlign: 'left', fontFamily: 'monospace', fontSize: 11 }}>{displaySource}</td>
                <td style={{ padding: '7px 12px', textAlign: 'center', color: B.inkSoft }}>{pct}%</td>
                <td style={{ padding: '7px 12px', textAlign: 'center', color: B.inkHint }}>{count}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </BureauCard>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

export function AnalyticsPage() {
  const [key, setKey] = useState<string>(
    import.meta.env.VITE_API_SECRET ||
    sessionStorage.getItem('analytics_key') ||
    ''
  )
  const [inputError, setInputError] = useState('')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [mapMode, setMapMode] = useState<'stated' | 'voted'>('stated')

  useEffect(() => {
    if (!key) return
    setLoading(true)
    fetch('/api/analytics', { headers: { 'x-api-secret': key } })
      .then(r => {
        if (r.status === 401) {
          setInputError('מפתח שגוי')
          sessionStorage.removeItem('analytics_key')
          setKey('')
          return null
        }
        return r.json() as Promise<AnalyticsData>
      })
      .then(d => { if (d) setData(d) })
      .catch(() => setInputError('שגיאת רשת'))
      .finally(() => setLoading(false))
  }, [key])

  const partyMatchCounts = useMemo(
    () => data ? computePartyMatchCounts(data.rawAnswers) : {},
    [data]
  )
  const dimAverages = useMemo(
    () => data ? computeDimensionAverages(data.questionAverages) : ({} as Record<DimensionKey, number>),
    [data]
  )

  if (!key) {
    return <KeyGate onSubmit={k => { sessionStorage.setItem('analytics_key', k); setKey(k) }} error={inputError} />
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: B.bg, fontFamily: B.font }}>
        <div style={{ color: B.inkHint, fontSize: 14 }}>טוען נתונים…</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: B.bg, fontFamily: B.font }}>
        <div style={{ color: '#dc2626', fontSize: 14 }}>{inputError || 'שגיאה בטעינת הנתונים'}</div>
      </div>
    )
  }

  const { totals, daily, questionAverages, questionCounts, referrers } = data
  const totalRe = totals.submissions
  const fullPct = totalRe > 0 ? Math.round((totals.full / totalRe) * 100) : 0
  const hePct   = totalRe > 0 ? Math.round((totals.he   / totalRe) * 100) : 0
  const dateRange = daily.length >= 2
    ? `${daily[0].date} – ${daily[daily.length - 1].date}`
    : daily.length === 1 ? daily[0].date : '–'

  return (
    <div style={{ minHeight: '100dvh', background: B.bg, fontFamily: B.font, direction: 'rtl' }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: `${B.bg}f2`,
        backdropFilter: 'blur(8px)', borderBottom: `1px solid ${B.border}` }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '12px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: B.ink }}>📊 אנליטיקה</div>
          <div style={{ fontSize: 12, color: B.inkHint }}>{dateRange}</div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 48px' }}>

        {/* KPI Cards */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
          <StatCard label="משיבים" value={totalRe} />
          <StatCard label="סקר מלא" value={`${fullPct}%`} sub={`${totals.full} מתוך ${totalRe}`} />
          <StatCard label="עברית" value={`${hePct}%`} sub={`${totals.he}/${totals.en} en`} />
          <StatCard label="קצר / חלקי" value={`${totals.short}/${totals.partial}`} sub="short / partial" />
        </div>

        {/* Daily Activity */}
        <SectionTitle>פעילות יומית</SectionTitle>
        <DailyChart daily={daily} />

        {/* Average Position Map */}
        <SectionTitle>מיקום ממוצע על מפת הרעיונות</SectionTitle>
        <PartyMap
          allPositions={allPositions}
          parties={parties}
          mode={mapMode}
          onModeChange={setMapMode}
          lang="he"
          averageUserAnswers={questionAverages}
        />

        {/* Dimension Radar */}
        <SectionTitle>ממוצע לפי ממד</SectionTitle>
        <DimensionRadar dimAverages={dimAverages} />

        {/* Party Match Distribution */}
        <SectionTitle>האיזון הפוליטי — התאמה עיקרית למפלגה</SectionTitle>
        <PartyMatchChart matchCounts={partyMatchCounts} />

        {/* Per-Question Averages */}
        <SectionTitle>ממוצע לפי שאלה</SectionTitle>
        <QuestionAverages
          questionAverages={questionAverages}
          questionCounts={questionCounts}
          totalSubmissions={totalRe}
        />

        {/* Question Coverage */}
        <SectionTitle>כיסוי שאלות</SectionTitle>
        <CoverageTable questionCounts={questionCounts} totalSubmissions={totalRe} />

        {/* Sources */}
        <SectionTitle>מקורות הגעה</SectionTitle>
        <ReferrersTable referrers={referrers} totalSubmissions={totalRe} />

      </div>
    </div>
  )
}
