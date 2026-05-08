import type { PartyPosition, KnessetMember } from '../types'

export interface HypocrisyResult {
  party_id: string
  score: number        // 0–100 (higher = more divergent)
  coverage: number     // fraction of 33 questions with both stated+voted (0–1)
  topGaps: Array<{ question_id: string; stated: number; voted: number; gap: number }>
}

export function computeHypocrisy(
  allPositions: Record<string, PartyPosition[]>
): HypocrisyResult[] {
  const TOTAL_QUESTIONS = 33
  const results: HypocrisyResult[] = []

  for (const [party_id, positions] of Object.entries(allPositions)) {
    const gaps: Array<{ question_id: string; stated: number; voted: number; gap: number }> = []

    for (const pos of positions) {
      const stated = pos.stated_position?.score
      const voted = pos.voted_position?.score
      if (stated === null || stated === undefined) continue
      if (voted === null || voted === undefined) continue
      gaps.push({ question_id: pos.question_id, stated, voted, gap: Math.abs(stated - voted) })
    }

    const coverage = gaps.length / TOTAL_QUESTIONS
    // consistency: 100 = platform fully matches votes, 0 = maximum divergence
    // Dividing by 1 (not 4) means avg gap of 1 step = 0% consistent — a more meaningful calibration
    const score = gaps.length > 0
      ? Math.max(0, 100 - (gaps.reduce((s, g) => s + g.gap, 0) / gaps.length) * 100)
      : 0

    const topGaps = [...gaps].sort((a, b) => b.gap - a.gap).slice(0, 5)
    results.push({ party_id, score, coverage, topGaps })
  }

  // Parties with voted data first (sorted desc by consistency), then parties without
  return results.sort((a, b) => {
    if (a.coverage === 0 && b.coverage === 0) return 0
    if (a.coverage === 0) return 1
    if (b.coverage === 0) return -1
    return b.score - a.score
  })
}

export interface PartyPoint {
  party_id: string
  x: number   // left (−1) ↔ right (+1) based on security questions
  y: number   // secular (−1) ↔ religious (+1) based on religion questions
}

// All question IDs in a fixed order (must match questions.json; skips removed questions)

// ---------- MK analytics ----------

// Questions with high K25 MK coverage (≥80/134 MKs scored), used for MK analysis.
// Covers religion, judicial, minority, governance, and socioeconomic dimensions.
export const MK_SCORED_QIDS = [
  'q07',  // Haredi conscription          (109/134)
  'q08',  // Civil marriage               ( 81/134)
  'q11',  // Yeshiva funding parity       (117/134)
  'q18',  // Knesset override clause      (112/134)
  'q19',  // Judicial selection           (109/134)
  'q22',  // Independent judiciary        (109/134)
  'q23',  // Equality Basic Law           (114/134)
  'q27',  // PM under indictment          (107/134)
  'q28',  // PM term limits               ( 89/134)
  'q31',  // Oct 7 inquiry commission     (115/134)
  'q32',  // Core curriculum              (101/134)
] as const

export interface IntraPartyVariance {
  party_id: string
  variance: number        // avg std dev across scored questions (0 = identical, 2 = max)
  mk_count: number
  outlier_mk_id: string | null
  outlier_distance: number
}

export function computeIntraPartyVariance(
  mks: KnessetMember[],
  mkPositions: Record<string, Record<string, number | null>>
): IntraPartyVariance[] {
  const byParty: Record<string, string[]> = {}
  for (const mk of mks) {
    if (!byParty[mk.party_id]) byParty[mk.party_id] = []
    byParty[mk.party_id].push(mk.id)
  }

  const results: IntraPartyVariance[] = []
  for (const [party_id, mkIds] of Object.entries(byParty)) {
    if (mkIds.length < 2) {
      results.push({ party_id, variance: 0, mk_count: mkIds.length, outlier_mk_id: null, outlier_distance: 0 })
      continue
    }

    let totalVariance = 0
    let qCount = 0
    const partyMeans: Record<string, number> = {}

    for (const qid of MK_SCORED_QIDS) {
      const vals = mkIds.map(id => mkPositions[id]?.[qid]).filter((v): v is number => v !== null && v !== undefined)
      if (vals.length < 2) continue
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length
      const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length
      totalVariance += Math.sqrt(variance)
      partyMeans[qid] = mean
      qCount++
    }

    const avgVariance = qCount > 0 ? totalVariance / qCount : 0

    // Find most outlier MK
    let outlierMkId: string | null = null
    let maxDist = 0
    for (const mkId of mkIds) {
      const scores = mkPositions[mkId]
      if (!scores) continue
      let dist = 0, dCount = 0
      for (const qid of MK_SCORED_QIDS) {
        const v = scores[qid]
        const m = partyMeans[qid]
        if (v !== null && v !== undefined && m !== undefined) {
          dist += Math.abs(v - m)
          dCount++
        }
      }
      const avgDist = dCount > 0 ? dist / dCount : 0
      if (avgDist > maxDist) { maxDist = avgDist; outlierMkId = mkId }
    }

    results.push({ party_id, variance: avgVariance, mk_count: mkIds.length, outlier_mk_id: outlierMkId, outlier_distance: maxDist })
  }

  return results.sort((a, b) => b.variance - a.variance)
}

export interface CrossAisleMK {
  mk_id: string
  actual_party_id: string
  closest_party_id: string
  actual_similarity: number    // cosine sim with actual party (0–100)
  closest_similarity: number   // cosine sim with closest party (0–100)
  divergence: number           // closest - actual
}

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, aMag = 0, bMag = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; aMag += a[i] ** 2; bMag += b[i] ** 2
  }
  if (aMag === 0 || bMag === 0) return 50
  return Math.round(((dot / (Math.sqrt(aMag) * Math.sqrt(bMag))) + 1) / 2 * 100)
}

// Maps historical/merged party IDs → the current party to compare against.
// MKs who ran under these labels should be measured against the successor party.
const PARTY_SUCCESSOR: Record<string, string> = {
  yesh_atid:    'beyachad',   // Yesh Atid merged with Bennett's party into Beyachad
  bennett_2026: 'beyachad',
}

export function findCrossAisleMKs(
  mks: KnessetMember[],
  mkPositions: Record<string, Record<string, number | null>>,
  allPartyPositions: Record<string, PartyPosition[]>
): CrossAisleMK[] {
  // Build party vectors on the scored questions (stated positions)
  const partyVecs: Record<string, number[]> = {}
  for (const [pid, positions] of Object.entries(allPartyPositions)) {
    const vec = MK_SCORED_QIDS.map(qid => {
      const pos = positions.find(p => p.question_id === qid)
      return pos?.stated_position?.score ?? null
    })
    if (vec.some(v => v !== null)) partyVecs[pid] = vec as number[]
  }

  const results: CrossAisleMK[] = []
  for (const mk of mks) {
    const scores = mkPositions[mk.id]
    if (!scores) continue

    // Resolve the MK's "home" party — use successor if the original isn't in partyVecs
    const homePid = PARTY_SUCCESSOR[mk.party_id] ?? mk.party_id

    let bestPartyId: string | null = null
    let bestSim = -1
    let actualSim = 0

    for (const [pid, pvec] of Object.entries(partyVecs)) {
      const mkVec: number[] = []
      const pVec: number[] = []
      MK_SCORED_QIDS.forEach((qid, i) => {
        const mv = scores[qid]
        const pv = pvec[i]
        if (mv !== null && mv !== undefined && pv !== null && pv !== undefined) {
          mkVec.push(mv); pVec.push(pv)
        }
      })
      if (mkVec.length < 3) continue
      const sim = cosineSim(mkVec, pVec)
      if (sim > bestSim) { bestSim = sim; bestPartyId = pid }
      if (pid === homePid) actualSim = sim
    }

    if (!bestPartyId) continue
    results.push({
      mk_id: mk.id,
      actual_party_id: mk.party_id,
      closest_party_id: bestPartyId,
      actual_similarity: actualSim,
      closest_similarity: bestSim,
      divergence: bestSim - actualSim,
    })
  }

  // Sort by divergence descending — most cross-aisle first
  return results.sort((a, b) => b.divergence - a.divergence)
}

export interface MKPoint {
  mk_id: string
  party_id: string
  x: number
  y: number
}

export function computeMKMap(
  mks: KnessetMember[],
  mkPositions: Record<string, Record<string, number | null>>,
  allPartyPositions: Record<string, PartyPosition[]>
): { partyPoints: PartyPoint[]; mkPoints: MKPoint[] } {
  const qids = MK_SCORED_QIDS as readonly string[]
  const partyIds = Object.keys(allPartyPositions)
  const mkIds = mks.map(m => m.id).filter(id => mkPositions[id])

  // Build data matrix: rows = [parties..., mks...], cols = scored questions
  const rows = [
    ...partyIds.map(pid =>
      qids.map(qid => allPartyPositions[pid].find(p => p.question_id === qid)?.stated_position?.score ?? 0)
    ),
    ...mkIds.map(mkId =>
      qids.map(qid => mkPositions[mkId]?.[qid] ?? 0)
    ),
  ]

  const n = rows.length, m = qids.length
  const colMeans = Array.from({ length: m }, (_, j) => rows.reduce((s, r) => s + r[j], 0) / n)
  const Xc = rows.map(row => row.map((v, j) => v - colMeans[j]))

  // Gram matrix G = Xc Xc^T
  const G = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => Xc[i].reduce((s, v, k) => s + v * Xc[j][k], 0))
  )

  // Power iteration for PC1
  let v1: number[] = Array.from({ length: n }, (_, i) => (i === 0 ? 1 : 0))
  for (let iter = 0; iter < 200; iter++) {
    const nv = G.map(row => row.reduce((s, v, k) => s + v * v1[k], 0))
    const mag = Math.sqrt(nv.reduce((s, v) => s + v ** 2, 0)) || 1
    v1 = nv.map(v => v / mag)
  }
  const lambda1 = v1.reduce((s, v, i) => s + v * G[i].reduce((ss, gv, j) => ss + gv * v1[j], 0), 0)

  // Deflate for PC2
  const G2 = G.map((row, i) => row.map((val, j) => val - lambda1 * v1[i] * v1[j]))
  let v2: number[] = Array.from({ length: n }, (_, i) => (i === 1 ? 1 : 0))
  for (let iter = 0; iter < 200; iter++) {
    let nv = G2.map(row => row.reduce((s, v, k) => s + v * v2[k], 0))
    const ov = nv.reduce((s, v, i) => s + v * v1[i], 0)
    nv = nv.map((v, i) => v - ov * v1[i])
    const mag = Math.sqrt(nv.reduce((s, v) => s + v ** 2, 0)) || 1
    v2 = nv.map(v => v / mag)
  }

  const coords = Array.from({ length: n }, (_, i) => ({ x: v1[i], y: v2[i] }))
  const xs = coords.map(c => c.x), ys = coords.map(c => c.y)
  const xMin = Math.min(...xs), xMax = Math.max(...xs), xRange = (xMax - xMin) || 1
  const yMin = Math.min(...ys), yMax = Math.max(...ys), yRange = (yMax - yMin) || 1
  const norm = (c: { x: number; y: number }) => ({
    x: ((c.x - xMin) / xRange) * 2 - 1,
    y: ((c.y - yMin) / yRange) * 2 - 1,
  })

  const partyPoints: PartyPoint[] = partyIds.map((id, i) => ({ party_id: id, ...norm(coords[i]) }))
  const mkPoints: MKPoint[] = mkIds.map((mkId, i) => {
    const mk = mks.find(m => m.id === mkId)!
    return { mk_id: mkId, party_id: mk.party_id, ...norm(coords[partyIds.length + i]) }
  })

  return { partyPoints, mkPoints }
}

// X axis: security questions → left (−1) to right (+1)
// Y axis: religion questions → secular (−1) to religious (+1)
// Signs per question are anchored empirically: Likud defines "right" on security,
// UTJ defines "religious" on religion. This avoids PCA axis ambiguity.

export interface AxisResult {
  points: PartyPoint[]
  lrSigns: number[]
  relSigns: number[]
  xMin: number; xMax: number
  yMin: number; yMax: number
}

const SECURITY_QIDS = ['q01','q02','q03','q04','q05','q06']
const RELIGION_QIDS = ['q07','q08','q09','q10','q11','q12']

export function computePartyAxes(
  allPositions: Record<string, PartyPosition[]>,
  mode: 'stated' | 'voted'
): AxisResult {
  const score = (pid: string, qid: string): number => {
    const pos = allPositions[pid]?.find(p => p.question_id === qid)
    if (!pos) return 0
    return mode === 'voted'
      ? pos.voted_position?.score ?? pos.stated_position?.score ?? 0
      : pos.stated_position?.score ?? 0
  }

  // Per-question sign: +1 if Likud scores higher than Hadash (right-coded question)
  const lrSigns = SECURITY_QIDS.map(qid =>
    Math.sign(score('likud', qid) - score('hadash_taal', qid)) || 1
  )
  // Per-question sign: +1 if UTJ scores higher than Yisrael Beitenu (religious-coded)
  const relSigns = RELIGION_QIDS.map(qid =>
    Math.sign(score('utj', qid) - score('yisrael_beitenu', qid)) || 1
  )

  const partyIds = Object.keys(allPositions)
  const raw = partyIds.map(pid => ({
    party_id: pid,
    x: SECURITY_QIDS.reduce((s, qid, i) => s + lrSigns[i] * score(pid, qid), 0) / SECURITY_QIDS.length,
    y: RELIGION_QIDS.reduce((s, qid, i) => s + relSigns[i] * score(pid, qid), 0) / RELIGION_QIDS.length,
  }))

  const xs = raw.map(p => p.x), ys = raw.map(p => p.y)
  const xMin = Math.min(...xs), xMax = Math.max(...xs)
  const yMin = Math.min(...ys), yMax = Math.max(...ys)

  // Jitter parties that land at the same pixel (e.g. Shas and UTJ have identical scores)
  const JITTER = 0.04
  const seen = new Map<string, number>()
  const points: PartyPoint[] = raw.map(p => {
    const nx = xMax > xMin ? ((p.x - xMin) / (xMax - xMin)) * 2 - 1 : 0
    const ny = yMax > yMin ? ((p.y - yMin) / (yMax - yMin)) * 2 - 1 : 0
    const key = `${nx.toFixed(3)},${ny.toFixed(3)}`
    const count = seen.get(key) ?? 0
    seen.set(key, count + 1)
    const angle = (Math.PI / 2) * count
    return {
      party_id: p.party_id,
      x: nx + (count > 0 ? JITTER * Math.cos(angle) : 0),
      y: ny + (count > 0 ? JITTER * Math.sin(angle) : 0),
    }
  })

  return { points, lrSigns, relSigns, xMin, xMax, yMin, yMax }
}

export function computeUserMapPoint(
  answers: Record<string, number | null | undefined>,
  axisResult: AxisResult
): { x: number; y: number } | null {
  const { lrSigns, relSigns, xMin, xMax, yMin, yMax } = axisResult

  const secScores = SECURITY_QIDS.map((qid, i) => {
    const v = answers[qid]
    return (v !== null && v !== undefined) ? lrSigns[i] * v : null
  }).filter((v): v is number => v !== null)

  const relScores = RELIGION_QIDS.map((qid, i) => {
    const v = answers[qid]
    return (v !== null && v !== undefined) ? relSigns[i] * v : null
  }).filter((v): v is number => v !== null)

  if (secScores.length === 0 && relScores.length === 0) return null

  const rawX = secScores.length > 0 ? secScores.reduce((s, v) => s + v, 0) / secScores.length : (xMin + xMax) / 2
  const rawY = relScores.length > 0 ? relScores.reduce((s, v) => s + v, 0) / relScores.length : (yMin + yMax) / 2

  return {
    x: xMax > xMin ? Math.max(-1, Math.min(1, ((rawX - xMin) / (xMax - xMin)) * 2 - 1)) : 0,
    y: yMax > yMin ? Math.max(-1, Math.min(1, ((rawY - yMin) / (yMax - yMin)) * 2 - 1)) : 0,
  }
}

// ---------- MK 2-D axis map ----------

export type MKDimKey = 'religion' | 'judicial' | 'governance'

const MK_DIM_QIDS: Record<MKDimKey, string[]> = {
  religion:   ['q07', 'q08', 'q11'],
  judicial:   ['q18', 'q19', 'q22'],
  governance: ['q27', 'q28', 'q31'],
}

// anchor HIGH party defines the "positive" direction on each axis
const MK_DIM_ANCHORS: Record<MKDimKey, { high: string; low: string }> = {
  religion:   { high: 'utj',   low: 'yisrael_beitenu' }, // religious → right
  judicial:   { high: 'likud', low: 'hadash_taal' },      // pro-reform → right
  governance: { high: 'likud', low: 'hadash_taal' },      // pro-PM-power → right
}

export const MK_DIM_LABELS: Record<MKDimKey, { he: string; en: string; lowHe: string; lowEn: string; highHe: string; highEn: string }> = {
  religion:   { he: 'דת ומדינה',     en: 'Religion',   lowHe: 'חילוני',       lowEn: 'Secular',        highHe: 'דתי',         highEn: 'Religious'  },
  judicial:   { he: 'רפורמה משפטית', en: 'Judicial',   lowHe: 'נגד הרפורמה', lowEn: 'Anti-reform',    highHe: 'בעד הרפורמה', highEn: 'Pro-reform' },
  governance: { he: 'ממשל',           en: 'Governance', lowHe: 'אחריות',       lowEn: 'Accountability', highHe: 'ריכוז כוח',   highEn: 'Centralization' },
}

export interface MKMapAxisResult {
  partyPoints: PartyPoint[]
  mkPoints: Array<{ mk_id: string; party_id: string; x: number; y: number }>
  xSigns: number[]; xQids: string[]
  ySigns: number[]; yQids: string[]
  xMin: number; xMax: number
  yMin: number; yMax: number
}

export function computeMKAxisMap(
  allPartyPositions: Record<string, PartyPosition[]>,
  mks: KnessetMember[],
  mkPositions: Record<string, Record<string, number | null>>,
  xDim: MKDimKey,
  yDim: MKDimKey
): MKMapAxisResult {
  const xQids = MK_DIM_QIDS[xDim]
  const yQids = MK_DIM_QIDS[yDim]

  const ps = (pid: string, qid: string): number => {
    const pos = allPartyPositions[pid]?.find(p => p.question_id === qid)
    return pos?.stated_position?.score ?? 0
  }

  const { high: xH, low: xL } = MK_DIM_ANCHORS[xDim]
  const { high: yH, low: yL } = MK_DIM_ANCHORS[yDim]
  const xSigns = xQids.map(qid => Math.sign(ps(xH, qid) - ps(xL, qid)) || 1)
  const ySigns = yQids.map(qid => Math.sign(ps(yH, qid) - ps(yL, qid)) || 1)

  const partyIds = Object.keys(allPartyPositions)
  const partyRaw = partyIds.map(pid => ({
    party_id: pid,
    x: xQids.reduce((s, qid, i) => s + xSigns[i] * ps(pid, qid), 0) / xQids.length,
    y: yQids.reduce((s, qid, i) => s + ySigns[i] * ps(pid, qid), 0) / yQids.length,
  }))

  const mkRaw = mks.flatMap(mk => {
    const scores = mkPositions[mk.id]
    if (!scores) return []
    const xVals = xQids.map((qid, i) => { const v = scores[qid]; return v != null ? xSigns[i] * v : null }).filter((v): v is number => v !== null)
    const yVals = yQids.map((qid, i) => { const v = scores[qid]; return v != null ? ySigns[i] * v : null }).filter((v): v is number => v !== null)
    if (!xVals.length && !yVals.length) return []
    return [{ mk_id: mk.id, party_id: mk.party_id,
      x: xVals.length ? xVals.reduce((s, v) => s + v, 0) / xVals.length : 0,
      y: yVals.length ? yVals.reduce((s, v) => s + v, 0) / yVals.length : 0,
    }]
  })

  const allXs = [...partyRaw.map(p => p.x), ...mkRaw.map(m => m.x)]
  const allYs = [...partyRaw.map(p => p.y), ...mkRaw.map(m => m.y)]
  const xMin = Math.min(...allXs), xMax = Math.max(...allXs)
  const yMin = Math.min(...allYs), yMax = Math.max(...allYs)
  const normX = (v: number) => xMax > xMin ? ((v - xMin) / (xMax - xMin)) * 2 - 1 : 0
  const normY = (v: number) => yMax > yMin ? ((v - yMin) / (yMax - yMin)) * 2 - 1 : 0

  const JITTER = 0.04
  const seen = new Map<string, number>()
  const partyPoints = partyRaw.map(p => {
    const px = normX(p.x), py = normY(p.y)
    const key = `${px.toFixed(3)},${py.toFixed(3)}`
    const c = seen.get(key) ?? 0; seen.set(key, c + 1)
    const a = (Math.PI / 2) * c
    return { party_id: p.party_id, x: px + (c > 0 ? JITTER * Math.cos(a) : 0), y: py + (c > 0 ? JITTER * Math.sin(a) : 0) }
  })

  return { partyPoints, mkPoints: mkRaw.map(m => ({ ...m, x: normX(m.x), y: normY(m.y) })), xSigns, xQids, ySigns, yQids, xMin, xMax, yMin, yMax }
}

export function computeUserMKPoint(
  answers: Record<string, number | null | undefined>,
  result: MKMapAxisResult
): { x: number; y: number } | null {
  const { xQids, xSigns, yQids, ySigns, xMin, xMax, yMin, yMax } = result
  const xVals = xQids.map((qid, i) => { const v = answers[qid]; return v != null ? xSigns[i] * v : null }).filter((v): v is number => v !== null)
  const yVals = yQids.map((qid, i) => { const v = answers[qid]; return v != null ? ySigns[i] * v : null }).filter((v): v is number => v !== null)
  if (!xVals.length && !yVals.length) return null
  const rawX = xVals.length ? xVals.reduce((s, v) => s + v, 0) / xVals.length : (xMin + xMax) / 2
  const rawY = yVals.length ? yVals.reduce((s, v) => s + v, 0) / yVals.length : (yMin + yMax) / 2
  return {
    x: xMax > xMin ? Math.max(-1, Math.min(1, ((rawX - xMin) / (xMax - xMin)) * 2 - 1)) : 0,
    y: yMax > yMin ? Math.max(-1, Math.min(1, ((rawY - yMin) / (yMax - yMin)) * 2 - 1)) : 0,
  }
}
