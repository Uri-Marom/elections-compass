import { forwardRef } from 'react'
import { DIMENSIONS, type DimensionKey, type PartyMatch } from '../../utils/matching'
import type { Party } from '../../types'

interface Props {
  topMatches: [PartyMatch, PartyMatch | undefined, PartyMatch | undefined]
  parties: Party[]
  userDimScores: Record<DimensionKey, number>
  partyDimScores: Record<DimensionKey, number>
  lang: 'he' | 'en'
}

const DIM_LABELS_HE: Record<DimensionKey, string> = {
  security:      'ביטחון',
  religion:      'דת ומדינה',
  socioeconomic: 'כלכלה',
  judicial:      'שלטון החוק',
  minority:      'מיעוטים',
  governance:    'ממשל',
}

const DIM_LABELS_EN: Record<DimensionKey, string> = {
  security:      'Security',
  religion:      'Religion',
  socioeconomic: 'Economy',
  judicial:      'Rule of Law',
  minority:      'Minorities',
  governance:    'Governance',
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}

function PartyLogo({ party, size }: { party: Party; size: number }) {
  const { r, g, b } = hexToRgb(party.color)
  if (party.logo) {
    return (
      <img
        src={party.logo}
        alt={party.name_en}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          objectFit: 'contain',
          background: `rgba(${r},${g},${b},0.1)`,
          border: `2px solid rgba(${r},${g},${b},0.25)`,
          padding: '3px',
          flexShrink: 0,
        }}
        crossOrigin="anonymous"
      />
    )
  }
  return (
    <div style={{
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      background: party.color,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      color: 'white',
      fontSize: `${size * 0.38}px`,
      fontWeight: 800,
    }}>
      {party.name_he.charAt(0)}
    </div>
  )
}

interface RadarProps {
  userScores: Record<DimensionKey, number>
  partyScores: Record<DimensionKey, number>
  partyColor: string
  lang: 'he' | 'en'
}

function RadarSVG({ userScores, partyScores, partyColor, lang }: RadarProps) {
  const dims = Object.keys(DIMENSIONS) as DimensionKey[]
  const n = dims.length
  const cx = 130
  const cy = 130
  const maxR = 100
  const levels = [25, 50, 75, 100]
  const labels = lang === 'he' ? DIM_LABELS_HE : DIM_LABELS_EN
  const { r, g, b } = hexToRgb(partyColor)

  // Angle for each axis: start from top (-90°), going clockwise
  const angleFor = (i: number) => (i / n) * 2 * Math.PI - Math.PI / 2

  const toXY = (i: number, val: number) => {
    const angle = angleFor(i)
    const rr = (val / 100) * maxR
    return { x: cx + rr * Math.cos(angle), y: cy + rr * Math.sin(angle) }
  }

  const axisEnd = (i: number) => toXY(i, 100)

  const polyPoints = (scores: Record<DimensionKey, number>) =>
    dims.map((d, i) => toXY(i, scores[d] ?? 50)).map(p => `${p.x},${p.y}`).join(' ')

  // Label offsets — push labels away from center
  const labelPos = (i: number) => {
    const angle = angleFor(i)
    const labelR = maxR + 20
    return {
      x: cx + labelR * Math.cos(angle),
      y: cy + labelR * Math.sin(angle),
      anchor: (Math.cos(angle) > 0.1 ? 'start' : Math.cos(angle) < -0.1 ? 'end' : 'middle') as 'start' | 'end' | 'middle',
    }
  }

  return (
    <svg width="260" height="260" style={{ display: 'block' }}>
      {/* Grid rings */}
      {levels.map(lv => (
        <polygon
          key={lv}
          points={dims.map((_, i) => toXY(i, lv)).map(p => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="1"
        />
      ))}
      {/* Axes */}
      {dims.map((_, i) => {
        const end = axisEnd(i)
        return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="#d1d5db" strokeWidth="1" />
      })}

      {/* Party polygon */}
      <polygon
        points={polyPoints(partyScores)}
        fill={`rgba(${r},${g},${b},0.18)`}
        stroke={partyColor}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* User polygon */}
      <polygon
        points={polyPoints(userScores)}
        fill="rgba(99,102,241,0.15)"
        stroke="#6366f1"
        strokeWidth="2"
        strokeDasharray="4,3"
        strokeLinejoin="round"
      />

      {/* Axis labels */}
      {dims.map((dim, i) => {
        const { x, y, anchor } = labelPos(i)
        return (
          <text
            key={dim}
            x={x}
            y={y}
            fontSize="10"
            fontWeight="600"
            fill="#374151"
            textAnchor={anchor}
            dominantBaseline="middle"
          >
            {labels[dim]}
          </text>
        )
      })}
    </svg>
  )
}

export const ShareCard = forwardRef<HTMLDivElement, Props>(
  ({ topMatches, parties, userDimScores, partyDimScores, lang }, ref) => {
    const isHe = lang === 'he'

    const [m1, m2, m3] = topMatches
    const p1 = parties.find(p => p.id === m1.party_id)!
    const p2 = m2 ? parties.find(p => p.id === m2.party_id) : undefined
    const p3 = m3 ? parties.find(p => p.id === m3.party_id) : undefined

    const col = p1.color
    const { r, g, b } = hexToRgb(col)
    const tint = `rgba(${r},${g},${b},0.05)`

    const score1 = m1.overall_stated
    const p1Name = isHe ? p1.name_he : p1.name_en

    return (
      <div
        ref={ref}
        dir={isHe ? 'rtl' : 'ltr'}
        style={{
          width: '480px',
          height: '660px',
          background: '#ffffff',
          fontFamily: '"Segoe UI", system-ui, -apple-system, Arial, sans-serif',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          background: col,
          padding: '13px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ color: 'white', fontSize: '16px', fontWeight: 700 }}>
            🧭 {isHe ? 'מצפן בחירות 2026' : 'Election Compass 2026'}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>
            matzpen.co.il
          </span>
        </div>

        {/* Body */}
        <div style={{
          flex: 1,
          background: tint,
          padding: '16px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}>
          {/* #1 hero */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <PartyLogo party={p1} size={62} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '1px' }}>
                {isHe ? '🏆 ההתאמה הטובה ביותר' : '🏆 Best match'}
              </div>
              <div style={{ fontSize: '21px', fontWeight: 800, color: '#111827', lineHeight: 1.1 }}>
                {p1Name}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '2px' }}>
                <span style={{ fontSize: '36px', fontWeight: 900, color: col, lineHeight: 1 }}>
                  {score1}%
                </span>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>
                  {isHe ? 'התאמה' : 'match'}
                </span>
              </div>
            </div>
          </div>

          {/* Radar chart */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <RadarSVG
              userScores={userDimScores}
              partyScores={partyDimScores}
              partyColor={col}
              lang={lang}
            />
            {/* Legend */}
            <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: '#6b7280' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{
                  display: 'inline-block', width: '18px', height: '3px',
                  background: col, borderRadius: '2px'
                }} />
                {p1Name}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{
                  display: 'inline-block', width: '18px', height: '3px',
                  background: '#6366f1', borderRadius: '2px',
                  backgroundImage: 'repeating-linear-gradient(90deg, #6366f1 0 4px, transparent 4px 7px)',
                }} />
                {isHe ? 'אתם' : 'You'}
              </span>
            </div>
          </div>

          {/* #2 and #3 */}
          {(p2 || p3) && (
            <div style={{ display: 'flex', gap: '10px' }}>
              {[{ m: m2, p: p2, rank: 2 }, { m: m3, p: p3, rank: 3 }].map(({ m, p, rank }) => {
                if (!m || !p) return null
                const name = isHe ? p.name_he : p.name_en
                const score = m.overall_stated
                const { r: pr, g: pg, b: pb } = hexToRgb(p.color)
                return (
                  <div
                    key={p.id}
                    style={{
                      flex: 1,
                      background: `rgba(${pr},${pg},${pb},0.06)`,
                      border: `1px solid rgba(${pr},${pg},${pb},0.18)`,
                      borderRadius: '10px',
                      padding: '9px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '9px',
                    }}
                  >
                    <PartyLogo party={p} size={36} />
                    <div>
                      <div style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 600 }}>#{rank}</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151', lineHeight: 1.2 }}>
                        {name}
                      </div>
                      <div style={{ fontSize: '17px', fontWeight: 800, color: p.color, lineHeight: 1 }}>
                        {score}%
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          background: '#f9fafb',
          borderTop: '1px solid #e5e7eb',
          padding: '8px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>
            {isHe ? 'מה ההתאמה שלך?' : "What's your match?"}
          </span>
          <span style={{ fontSize: '11px', fontWeight: 600, color: col }}>
            matzpen.co.il
          </span>
        </div>
      </div>
    )
  }
)

ShareCard.displayName = 'ShareCard'
