import { useLocation } from 'react-router-dom'
import questionsData from '../data/questions.json'
import type { Question } from '../types'

export type SurveyMode = 'full' | 'short'

export function useSurveyMode() {
  const { pathname } = useLocation()
  const isShort = pathname.startsWith('/short')
  return {
    mode: (isShort ? 'short' : 'full') as SurveyMode,
    prefix: isShort ? '/short' : '',
  }
}

export function getActiveQuestions(mode: SurveyMode): Question[] {
  const all = questionsData as Question[]
  return mode === 'short' ? all.filter(q => q.short) : all
}

export const SHORT_QUESTION_COUNT = (questionsData as Question[]).filter(q => q.short).length
