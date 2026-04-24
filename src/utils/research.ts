import type { PartyPosition } from '../types'

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

  // Project each party row onto v1 and v2
  const coords = Xc.map(row => ({ x: dot(row, v1), y: dot(row, v2) }))

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
