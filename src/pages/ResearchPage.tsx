import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../components/shared/LanguageSwitcher'
import { HypocrisyChart } from '../components/Research/HypocrisyChart'
import { PartyMap } from '../components/Research/PartyMap'
import { computeHypocrisy, computePartyPCA } from '../utils/research'
import { useSurveyStore } from '../store/survey'
import type { Party, PartyPosition, Question } from '../types'

import partiesData from '../data/parties.json'
import questionsData from '../data/questions.json'
import likudPos from '../data/positions/likud.json'
import shasPos from '../data/positions/shas.json'
import utjPos from '../data/positions/utj.json'
import otzmaPos from '../data/positions/otzma.json'
import rzpPos from '../data/positions/religious_zionism.json'
import yeshAtidPos from '../data/positions/yesh_atid.json'
import nationalUnityPos from '../data/positions/national_unity.json'
import bennettPos from '../data/positions/bennett_2026.json'
import yasharPos from '../data/positions/yashar.json'
import democratsPos from '../data/positions/democrats.json'
import yisraelPos from '../data/positions/yisrael_beitenu.json'
import miluimnikimPos from '../data/positions/miluimnikim.json'
import hadashPos from '../data/positions/hadash_taal.json'
import raamPos from '../data/positions/raam.json'

const parties = partiesData as Party[]
const questions = questionsData as Question[]

const allPositions: Record<string, PartyPosition[]> = {
  likud:             likudPos.positions as PartyPosition[],
  shas:              shasPos.positions as PartyPosition[],
  utj:               utjPos.positions as PartyPosition[],
  otzma:             otzmaPos.positions as PartyPosition[],
  religious_zionism: rzpPos.positions as PartyPosition[],
  yesh_atid:         yeshAtidPos.positions as PartyPosition[],
  national_unity:    nationalUnityPos.positions as PartyPosition[],
  bennett_2026:      bennettPos.positions as PartyPosition[],
  yashar:            yasharPos.positions as PartyPosition[],
  democrats:         democratsPos.positions as PartyPosition[],
  yisrael_beitenu:   yisraelPos.positions as PartyPosition[],
  miluimnikim:       miluimnikimPos.positions as PartyPosition[],
  hadash_taal:       hadashPos.positions as PartyPosition[],
  raam:              raamPos.positions as PartyPosition[],
}

export function ResearchPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { lang } = useSurveyStore()
  const [mapMode, setMapMode] = useState<'stated' | 'voted'>('stated')

  const hypocrisyResults = useMemo(() => computeHypocrisy(allPositions), [])
  const partyPoints = useMemo(() => computePartyPCA(allPositions, mapMode), [mapMode])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-500 hover:text-gray-800 text-lg leading-none"
            aria-label="back"
          >
            {lang === 'he' ? '→' : '←'}
          </button>
          <h1 className="flex-1 text-lg font-bold text-gray-900">{t('research_nav_label')}</h1>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-8">

        {/* Section 1: Hypocrisy */}
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-1">{t('hypocrisy_title')}</h2>
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">{t('hypocrisy_subtitle')}</p>
          <HypocrisyChart
            results={hypocrisyResults}
            parties={parties}
            questions={questions}
            lang={lang}
          />
        </section>

        <hr className="border-gray-200" />

        {/* Section 2: Party map */}
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-1">{t('similarity_title')}</h2>
          <PartyMap
            points={partyPoints}
            parties={parties}
            mode={mapMode}
            onModeChange={setMapMode}
            lang={lang}
          />
        </section>

        <div className="h-6" />
      </main>
    </div>
  )
}
