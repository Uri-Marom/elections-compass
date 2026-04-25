import type { DimensionKey } from './utils/matching'

export interface Question {
  id: string
  dimension: DimensionKey
  text_en: string
  text_he: string
  // 1 = positive score aligns with dimension's canonical direction; -1 = needs flipping for display
  polarity: 1 | -1
}

export interface Party {
  id: string
  name_en: string
  name_he: string
  seats: number
  poll_seats?: number
  bloc: 'coalition' | 'opposition' | 'arab'
  color: string
  logo: string | null
}

export interface StatedPosition {
  score: number
  source: string
  source_url?: string
  source_date?: string
}

export interface VotedPosition {
  score: number
  vote_ids?: number[]
  vote_count?: number
  for_pct?: number
  against_pct?: number
  last_updated?: string
}

export interface PartyPosition {
  question_id: string
  stated_position: StatedPosition
  voted_position?: VotedPosition
}

export interface KnessetMember {
  id: string
  name_he: string
  name_en: string
  party_id: string
  knessets: number[]
  is_current: boolean
}

export interface MKMatch {
  mk_id: string
  overall: number           // 0–100 cosine similarity
  by_dimension: Record<DimensionKey, number | null>
  question_count: number    // questions with coverage in both user and MK
}

export type UserAnswers = Record<string, number | null>
export type DimensionWeights = Record<DimensionKey, number>
