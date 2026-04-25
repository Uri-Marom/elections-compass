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
    const score = gaps.length > 0
      ? 100 - (gaps.reduce((s, g) => s + g.gap, 0) / gaps.length / 4) * 100
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

// ---------- PCA ----------

export interface PartyPoint {
  party_id: string
  x: number   // PC1 projection (normalized to [-1, 1])
  y: number   // PC2 projection
}

// All question IDs in a fixed order
const ALL_QIDS = Array.from({ length: 33 }, (_, i) => `q${String(i + 1).padStart(2, '0')}`)

function dot(a: number[], b: number[]): number {
  return a.reduce((s, v, i) => s + v * b[i], 0)
}

function scaleVec(v: number[], s: number): number[] {
  return v.map(x => x * s)
}

function addVec(a: number[], b: number[]): number[] {
  return a.map((x, i) => x + b[i])
}

function normalize(v: number[]): number[] {
  const mag = Math.sqrt(dot(v, v))
  return mag === 0 ? v : v.map(x => x / mag)
}

function matVec(M: number[][], v: number[]): number[] {
  return M.map(row => dot(row, v))
}

// Transpose of matrix
function transpose(M: number[][]): number[][] {
  const rows = M.length
  const cols = M[0].length
  return Array.from({ length: cols }, (_, j) => Array.from({ length: rows }, (_, i) => M[i][j]))
}

// Matrix multiplication A (m×k) × B (k×n) → (m×n)
function matMul(A: number[][], B: number[][]): number[][] {
  const m = A.length, k = A[0].length, n = B[0].length
  return Array.from({ length: m }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      Array.from({ length: k }, (_, l) => A[i][l] * B[l][j]).reduce((s, v) => s + v, 0)
    )
  )
}

function powerIterate(G: number[][], iters = 200): number[] {
  let v: number[] = G[0].map((_, i) => (i === 0 ? 1 : 0))
  for (let i = 0; i < iters; i++) {
    v = normalize(matVec(G, v))
  }
  return v
}

// ---------- MK analytics ----------

// Questions that have actual shadow-vote data (used for all MK analysis)
export const MK_SCORED_QIDS = ['q01', 'q06', 'q08', 'q13', 'q15', 'q16', 'q26', 'q28'] as const

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

    // Build MK vector aligned with party vectors, only on questions both have
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
      if (pid === mk.party_id) actualSim = sim
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

export function computePartyPCA(
  allPositions: Record<string, PartyPosition[]>,
  mode: 'stated' | 'voted'
): PartyPoint[] {
  const partyIds = Object.keys(allPositions)
  const n = partyIds.length

  // Build n×m data matrix
  const X: number[][] = partyIds.map(id => {
    const positions = allPositions[id]
    return ALL_QIDS.map(qid => {
      const pos = positions.find(p => p.question_id === qid)
      if (!pos) return 0
      if (mode === 'voted') {
        return pos.voted_position?.score ?? pos.stated_position?.score ?? 0
      }
      return pos.stated_position?.score ?? 0
    })
  })

  // Center columns (subtract mean across parties per question)
  const m = ALL_QIDS.length
  const colMeans = Array.from({ length: m }, (_, j) =>
    X.reduce((s, row) => s + row[j], 0) / n
  )
  const Xc = X.map(row => row.map((v, j) => v - colMeans[j]))

  // Gram matrix G = Xc Xc^T  (n×n)
  const G = matMul(Xc, transpose(Xc))

  // Power iteration for eigenvector 1
  const v1 = powerIterate(G)
  const lambda1 = dot(matVec(G, v1), v1)

  // Deflate: G2 = G - λ1 * v1 v1^T
  const G2 = G.map((row, i) =>
    row.map((val, j) => val - lambda1 * v1[i] * v1[j])
  )

  // Power iteration for eigenvector 2 (orthogonal to v1)
  let v2 = powerIterate(G2)
  // Re-orthogonalize against v1 for numerical stability
  const overlap = dot(v2, v1)
  v2 = normalize(addVec(v2, scaleVec(v1, -overlap)))

  // v1 and v2 are eigenvectors of G = Xc Xc^T (n×n, party space).
  // Their components are the PCA coordinates directly — no projection needed.
  const coords = partyIds.map((_, i) => ({ x: v1[i], y: v2[i] }))

  // Normalize to [-1, 1]
  const xs = coords.map(c => c.x)
  const ys = coords.map(c => c.y)
  const xMin = Math.min(...xs), xMax = Math.max(...xs)
  const yMin = Math.min(...ys), yMax = Math.max(...ys)
  const xRange = xMax - xMin || 1
  const yRange = yMax - yMin || 1

  return partyIds.map((id, i) => ({
    party_id: id,
    x: ((coords[i].x - xMin) / xRange) * 2 - 1,
    y: ((coords[i].y - yMin) / yRange) * 2 - 1,
  }))
}
