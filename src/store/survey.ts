import { create } from 'zustand'
import type { UserAnswers, DimensionWeights } from '../types'
import type { DimensionKey } from '../utils/matching'
import { DIMENSIONS } from '../utils/matching'

interface SurveyStore {
  answers: UserAnswers
  weights: DimensionWeights
  currentDimension: number
  lang: 'he' | 'en'
  setAnswer: (qid: string, score: number | null) => void
  setWeight: (dim: DimensionKey, weight: number) => void
  setDimension: (idx: number) => void
  setLang: (lang: 'he' | 'en') => void
  reset: () => void
  answeredCount: () => number
  totalCount: () => number
}

const defaultWeights = Object.fromEntries(
  Object.keys(DIMENSIONS).map(k => [k, 1])
) as DimensionWeights

export const useSurveyStore = create<SurveyStore>((set, get) => ({
  answers: {},
  weights: defaultWeights,
  currentDimension: 0,
  lang: 'he',

  setAnswer: (qid, score) =>
    set(s => ({ answers: { ...s.answers, [qid]: score } })),

  setWeight: (dim, weight) =>
    set(s => ({ weights: { ...s.weights, [dim]: weight } })),

  setDimension: (idx) => set({ currentDimension: idx }),

  setLang: (lang) => set({ lang }),

  reset: () => set({ answers: {}, currentDimension: 0 }),

  answeredCount: () => Object.values(get().answers).filter(v => v !== null && v !== undefined).length,

  totalCount: () => Object.values(DIMENSIONS).reduce((sum, d) => sum + d.questions.length, 0),
}))
