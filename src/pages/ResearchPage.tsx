import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../components/shared/LanguageSwitcher'
import { HypocrisyChart } from '../components/Research/HypocrisyChart'
import { PartyMap } from '../components/Research/PartyMap'
import { computeHypocrisy, computePartyAxes, computeUserMapPoint } from '../utils/research'
import { useSurveyStore } from '../store/survey'
import type { Party, PartyPosition, Question } from '../types'
import { B, ACCENT, CompassRose, GridPaper } from '../components/bureau/BureauComponents'

import partiesData from '../data/parties.json'
import questionsData from '../data/questions.json'
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

const parties = partiesData as Party[]
const questions = questionsData as Question[]

const allPositions: Record<string, PartyPosition[]> = {
  likud:             likudPos.positions as PartyPosition[],
  shas:              shasPos.positions as PartyPosition[],
  utj:               utjPos.positions as PartyPosition[],
  otzma:             otzmaPos.positions as PartyPosition[],
  religious_zionism: rzpPos.positions as PartyPosition[],
  beyachad:          beyachadPos.positions as PartyPosition[],
  national_unity:    nationalUnityPos.positions as PartyPosition[],
  yashar:            yasharPos.positions as PartyPosition[],
  democrats:         democratsPos.positions as PartyPosition[],
  yisrael_beitenu:   yisraelPos.positions as PartyPosition[],
  miluimnikim:       miluimnikimPos.positions as PartyPosition[],
  hadash_taal:       hadashPos.positions as PartyPosition[],
  raam:              raamPos.positions as PartyPosition[],
}

export function ResearchPage() {
  const { t } = useTranslation()
  useEffect(() => { window.scrollTo(0, 0) }, [])
  const navigate = useNavigate()
  const { lang, answers } = useSurveyStore()
  const [mapMode, setMapMode] = useState<'stated' | 'voted'>('stated')

  const hypocrisyResults = useMemo(() => computeHypocrisy(allPositions), [])
  const axisResult = useMemo(() => computePartyAxes(allPositions, mapMode), [mapMode])
  const partyPoints = axisResult.points
  const userPoint = useMemo(() => computeUserMapPoint(answers, axisResult), [answers, axisResult])

  const sectionHeadStyle: React.CSSProperties = {
    fontSize: 15, fontWeight: 800, color: B.ink,
    letterSpacing: '-0.01em', marginBottom: 4,
  }
  const sectionSubStyle: React.CSSProperties = {
    fontSize: 12, color: B.inkFaint, marginBottom: 16, lineHeight: 1.55,
  }

  return (
    <div style={{ minHeight: '100dvh', background: B.bg, fontFamily: B.font }}>
      <header style={{
        background: `${B.bg}f5`, backdropFilter: 'blur(8px)',
        borderBottom: `1px solid ${B.border}`,
        position: 'sticky', top: 0, zIndex: 10,
        padding: '12px 20px',
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              border: 'none', background: 'transparent',
              fontSize: 18, color: B.inkFaint, cursor: 'pointer', padding: 0, lineHeight: 1,
            }}
            aria-label="back"
          >
            {lang === 'he' ? '→' : '←'}
          </button>
          <CompassRose size={20} accent={ACCENT} lang={lang} />
          <h1 style={{ flex: 1, fontSize: 15, fontWeight: 700, color: B.ink, margin: 0 }}>
            {t('research_nav_label')}
          </h1>
          <LanguageSwitcher />
        </div>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '24px 20px 48px' }}>

        {/* Party map */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={sectionHeadStyle}>{t('similarity_title')}</h2>
          <PartyMap
            points={partyPoints}
            parties={parties}
            mode={mapMode}
            onModeChange={setMapMode}
            lang={lang}
            userPoint={userPoint}
          />
        </section>

        <div style={{ height: 1, background: B.border, margin: '0 0 32px' }} />

        {/* Hypocrisy */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={sectionHeadStyle}>{t('hypocrisy_title')}</h2>
          <p style={sectionSubStyle}>{t('hypocrisy_subtitle')}</p>
          <HypocrisyChart
            results={hypocrisyResults}
            parties={parties}
            questions={questions}
            lang={lang}
          />
        </section>

        <div style={{ height: 1, background: B.border, margin: '0 0 32px' }} />

        {/* MK Compass teaser */}
        <section style={{ position: 'relative', overflow: 'hidden' }}>
          <GridPaper opacity={0.03} />
          <h2 style={{ ...sectionHeadStyle, position: 'relative' }}>{t('mk_compass')}</h2>
          <p style={{ ...sectionSubStyle, position: 'relative' }}>{t('mk_compass_subtitle')}</p>
          <button
            onClick={() => navigate('/mks')}
            style={{
              width: '100%', padding: '13px 0',
              borderRadius: B.radius,
              border: `1px solid ${B.border}`,
              background: B.white,
              fontSize: 14, fontWeight: 600, color: B.ink,
              cursor: 'pointer', fontFamily: B.font,
              position: 'relative',
            }}
          >
            {t('open_mk_compass')}
          </button>
        </section>
      </main>
    </div>
  )
}
