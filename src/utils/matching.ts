import type { PartyPosition, UserAnswers, DimensionWeights } from '../types'

export const DIMENSIONS = {
  security:      { label_en: 'Security & Peace', label_he: 'ביטחון ושלום', questions: ['q01','q02','q03','q04','q05','q06'] },
  religion:      { label_en: 'Religion & State', label_he: 'דת ומדינה',    questions: ['q07','q08','q09','q10','q11','q12'] },
  socioeconomic: { label_en: 'Economy & Welfare', label_he: 'כלכלה ורווחה', questions: ['q13','q14','q15','q16','q17','q32'] },
  judicial:      { label_en: 'Rule of Law',       label_he: 'שלטון החוק',   questions: ['q18','q19','q20','q21','q22'] },
  minority:      { label_en: 'Minority Rights',   label_he: 'זכויות מיעוטים', questions: ['q23','q24','q25','q26'] },
  governance:    { label_en: 'Governance',         label_he: 'ממשל ושקיפות', questions: ['q27','q28','q29','q30','q31','q33'] },
} as const

export type DimensionKey = keyof typeof DIMENSIONS

export interface DimensionScore {
  stated: number | null
  voted: number | null
}

export interface PartyMatch {
  party_id: string
  overall_stated: number
  overall_voted: number | null
  divergence: number | null
  by_dimension: Record<DimensionKey, DimensionScore>
}

function cosineSimilarity(userVec: number[], partyVec: number[]): number | null {
  if (userVec.length === 0) return null

  let dot = 0, uMag = 0, pMag = 0
  for (let i = 0; i < userVec.length; i++) {
    dot  += userVec[i] * partyVec[i]
    uMag += userVec[i] ** 2
    pMag += partyVec[i] ** 2
  }
  if (uMag === 0 || pMag === 0) return null

  const cos = dot / (Math.sqrt(uMag) * Math.sqrt(pMag))
  // Normalize from [-1, 1] to [0, 100]
  return Math.round(((cos + 1) / 2) * 100)
}

function dimensionScore(
  dimension: DimensionKey,
  userAnswers: UserAnswers,
  partyPositions: PartyPosition[],
  mode: 'stated' | 'voted'
): number | null {
  const qids = DIMENSIONS[dimension].questions
  const userVec: number[] = []
  const partyVec: number[] = []

  for (const qid of qids) {
    const userScore = userAnswers[qid]
    if (userScore === null || userScore === undefined) continue

    const pos = partyPositions.find(p => p.question_id === qid)
    if (!pos) continue

    const partyScore = mode === 'stated'
      ? pos.stated_position?.score
      : pos.voted_position?.score

    if (partyScore === null || partyScore === undefined) continue

    userVec.push(userScore)
    partyVec.push(partyScore)
  }

  return cosineSimilarity(userVec, partyVec)
}

export function computeMatch(
  userAnswers: UserAnswers,
  partyPositions: PartyPosition[],
  weights: DimensionWeights,
  partyId: string
): PartyMatch {
  const byDimension = {} as Record<DimensionKey, DimensionScore>
  let statedNumer = 0, statedDenom = 0
  let votedNumer = 0, votedDenom = 0
  let hasAnyVoted = false

  for (const dim of Object.keys(DIMENSIONS) as DimensionKey[]) {
    const w = weights[dim] ?? 1
    const stated = dimensionScore(dim, userAnswers, partyPositions, 'stated')
    const voted  = dimensionScore(dim, userAnswers, partyPositions, 'voted')

    byDimension[dim] = { stated, voted }

    if (stated !== null) {
      statedNumer += stated * w
      statedDenom += w
    }
    if (voted !== null) {
      votedNumer += voted * w
      votedDenom += w
      hasAnyVoted = true
    }
  }

  const overall_stated = statedDenom > 0 ? Math.round(statedNumer / statedDenom) : 0
  const overall_voted  = (hasAnyVoted && votedDenom > 0) ? Math.round(votedNumer / votedDenom) : null
  const divergence     = overall_voted !== null ? Math.abs(overall_stated - overall_voted) : null

  return { party_id: partyId, overall_stated, overall_voted, divergence, by_dimension: byDimension }
}

export function rankParties(
  userAnswers: UserAnswers,
  allPartyPositions: Record<string, PartyPosition[]>,
  weights: DimensionWeights
): PartyMatch[] {
  const matches = Object.entries(allPartyPositions).map(([id, positions]) =>
    computeMatch(userAnswers, positions, weights, id)
  )
  return matches.sort((a, b) => b.overall_stated - a.overall_stated)
}
