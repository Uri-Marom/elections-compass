import { forwardRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { DIMENSIONS, type DimensionKey, type PartyMatch } from '../../utils/matching'
import { B, ACCENT, DIM_COLOR } from '../bureau/BureauComponents'
import type { Party } from '../../types'

const SITE_URL = 'https://tinyurl.com/matzpen26'

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
          background: `rgba(${r},${g},${b},0.08)`,
          border: `1.5px solid rgba(${r},${g},${b},0.2)`,
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

function CompassRoseSVG({ size, color, accent }: { size: number; color: string; accent: string }) {
  const cx = 50, cy = 50
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ display: 'block' }}>
      <circle cx={cx} cy={cy} r="46" fill="none" stroke={color} strokeWidth="0.6" opacity="0.4" />
      <circle cx={cx} cy={cy} r="40" fill="none" stroke={color} strokeWidth="0.4" opacity="0.3" />
      {Array.from({ length: 32 }).map((_, i) => {
        const a = (i / 32) * Math.PI * 2
        const r1 = i % 4 === 0 ? 38 : 41
        return (
          <line
            key={i}
            x1={cx + Math.cos(a) * r1} y1={cy + Math.sin(a) * r1}
            x2={cx + Math.cos(a) * 46} y2={cy + Math.sin(a) * 46}
            stroke={color}
            strokeWidth={i % 8 === 0 ? '0.8' : '0.3'}
            opacity={i % 4 === 0 ? 0.6 : 0.3}
          />
        )
      })}
      <polygon points={`${cx},10 ${cx + 4},${cy - 2} ${cx},${cy} ${cx - 4},${cy - 2}`} fill={accent} />
      <polygon points={`${cx},10 ${cx - 4},${cy - 2} ${cx},${cy} ${cx + 4},${cy - 2}`} fill={color} />
      <polygon points={`${cx},90 ${cx + 4},${cy + 2} ${cx},${cy} ${cx - 4},${cy + 2}`} fill={color} opacity="0.7" />
      <polygon points={`${cx},90 ${cx - 4},${cy + 2} ${cx},${cy} ${cx + 4},${cy + 2}`} fill={color} opacity="0.5" />
      <polygon points={`10,${cy} ${cx - 2},${cy + 4} ${cx},${cy} ${cx - 2},${cy - 4}`} fill={color} opacity="0.5" />
      <polygon points={`10,${cy} ${cx - 2},${cy - 4} ${cx},${cy} ${cx - 2},${cy + 4}`} fill={color} opacity="0.7" />
      <polygon points={`90,${cy} ${cx + 2},${cy - 4} ${cx},${cy} ${cx + 2},${cy + 4}`} fill={color} opacity="0.7" />
      <polygon points={`90,${cy} ${cx + 2},${cy + 4} ${cx},${cy} ${cx + 2},${cy - 4}`} fill={color} opacity="0.5" />
      <circle cx={cx} cy={cy} r="3" fill={accent} />
      <circle cx={cx} cy={cy} r="1" fill={color} />
    </svg>
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
  const cx = 120, cy = 120, maxR = 88
  const levels = [25, 50, 75, 100]
  const labels = lang === 'he' ? DIM_LABELS_HE : DIM_LABELS_EN

  const angleFor = (i: number) => (i / n) * 2 * Math.PI - Math.PI / 2
  const toXY = (i: number, val: number) => {
    const angle = angleFor(i)
    const rr = (val / 100) * maxR
    return { x: cx + rr * Math.cos(angle), y: cy + rr * Math.sin(angle) }
  }
  const polyPoints = (scores: Record<DimensionKey, number>) =>
    dims.map((d, i) => toXY(i, scores[d] ?? 50)).map(p => `${p.x},${p.y}`).join(' ')

  const labelPos = (i: number) => {
    const angle = angleFor(i)
    const isDiag = Math.abs(Math.cos(angle)) > 0.15 && Math.abs(Math.sin(angle)) > 0.15
    const lr = maxR + (isDiag ? 28 : 20)
    return {
      x: cx + lr * Math.cos(angle),
      y: cy + lr * Math.sin(angle),
      anchor: (Math.cos(angle) > 0.1 ? 'start' : Math.cos(angle) < -0.1 ? 'end' : 'middle') as 'start' | 'end' | 'middle',
    }
  }

  return (
    <svg width="248" height="248" style={{ display: 'block' }}>
      {/* Grid rings */}
      {levels.map(lv => (
        <polygon
          key={lv}
          points={dims.map((_, i) => toXY(i, lv)).map(p => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={B.border}
          strokeWidth="1"
        />
      ))}
      {/* Axes */}
      {dims.map((_, i) => {
        const end = toXY(i, 100)
        return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke={B.borderMid} strokeWidth="0.8" />
      })}
      {/* User polygon */}
      <polygon
        points={polyPoints(userScores)}
        fill={`${ACCENT}1a`}
        stroke={ACCENT}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Party polygon — dashed */}
      <polygon
        points={polyPoints(partyScores)}
        fill={`${partyColor}20`}
        stroke={partyColor}
        strokeWidth="2"
        strokeDasharray="5,3"
        strokeLinejoin="round"
      />
      {/* Labels */}
      {dims.map((dim, i) => {
        const { x, y, anchor } = labelPos(i)
        return (
          <text key={dim} x={x} y={y} fontSize="9" fontWeight="700"
            fill={DIM_COLOR[dim]} textAnchor={anchor} dominantBaseline="middle"
            fontFamily="'Heebo', 'Rubik', system-ui, sans-serif">
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
    const score1 = m1.overall_stated
    const p1Name = isHe ? p1.name_he : p1.name_en

    return (
      <div
        ref={ref}
        dir={isHe ? 'rtl' : 'ltr'}
        style={{
          width: '480px',
          height: '700px',
          background: B.bg,
          fontFamily: B.font,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Dot-grid background */}
        <div aria-hidden="true" style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(${B.ink} 0.6px, transparent 0.6px)`,
          backgroundSize: '24px 24px',
          opacity: 0.035,
          pointerEvents: 'none',
        }} />

        {/* Header */}
        <div style={{
          background: B.ink,
          padding: '14px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          position: 'relative',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CompassRoseSVG size={28} color={B.bg} accent={ACCENT} />
            <span style={{ color: B.bg, fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em' }}>
              {isHe ? 'מצפן הבחירות' : 'Vote Compass'}
            </span>
          </div>
          <span style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: 10,
            letterSpacing: '0.12em',
            color: B.inkHint,
            textTransform: 'uppercase',
          }}>
            2026
          </span>
        </div>

        {/* Body */}
        <div style={{
          flex: 1,
          padding: '18px 22px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          position: 'relative',
        }}>

          {/* Hero — best match */}
          <div style={{
            background: B.white,
            border: `1.5px solid ${col}30`,
            borderRadius: B.radiusLg,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* faint compass rose watermark */}
            <div style={{
              position: 'absolute',
              insetInlineEnd: -14,
              bottom: -14,
              opacity: 0.06,
              pointerEvents: 'none',
            }}>
              <CompassRoseSVG size={100} color={col} accent={col} />
            </div>

            <PartyLogo party={p1} size={56} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: B.inkHint,
                marginBottom: 2,
              }}>
                {isHe ? 'ההתאמה הטובה ביותר' : 'Best match'}
              </div>
              <div style={{
                fontSize: 20,
                fontWeight: 900,
                color: B.ink,
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                marginBottom: 4,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {p1Name}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 32, fontWeight: 900, color: col, lineHeight: 1 }}>
                  {score1}%
                </span>
                <span style={{ fontSize: 12, color: B.inkFaint }}>
                  {isHe ? 'התאמה' : 'match'}
                </span>
              </div>
            </div>
          </div>

          {/* Radar */}
          <div style={{
            background: B.white,
            border: `1px solid ${B.border}`,
            borderRadius: B.radiusLg,
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}>
            <RadarSVG
              userScores={userDimScores}
              partyScores={partyDimScores}
              partyColor={col}
              lang={lang}
            />
            {/* Legend */}
            <div style={{ display: 'flex', gap: 18, fontSize: 11, color: B.inkFaint }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{
                  display: 'inline-block', width: 18, height: 2.5,
                  background: ACCENT, borderRadius: 2,
                }} />
                {isHe ? 'אתם' : 'You'}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{
                  display: 'inline-block', width: 18, height: 2.5,
                  backgroundImage: `repeating-linear-gradient(90deg, ${col} 0 5px, transparent 5px 8px)`,
                }} />
                {p1Name}
              </span>
            </div>
          </div>

          {/* #2 and #3 */}
          {(p2 || p3) && (
            <div style={{ display: 'flex', gap: 10 }}>
              {([{ m: m2, p: p2, rank: 2 }, { m: m3, p: p3, rank: 3 }] as const).map(({ m, p, rank }) => {
                if (!m || !p) return null
                const name = isHe ? p.name_he : p.name_en
                const score = m.overall_stated
                const { r: pr, g: pg, b: pb } = hexToRgb(p.color)
                return (
                  <div
                    key={p.id}
                    style={{
                      flex: 1,
                      background: B.white,
                      border: `1px solid rgba(${pr},${pg},${pb},0.2)`,
                      borderRadius: B.radius,
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <PartyLogo party={p} size={34} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontFamily: 'ui-monospace, monospace',
                        fontSize: 9,
                        letterSpacing: '0.1em',
                        color: B.inkHint,
                        marginBottom: 1,
                      }}>#{rank}</div>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: B.ink,
                        lineHeight: 1.2,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {name}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: p.color, lineHeight: 1.1 }}>
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
          borderTop: `1px solid ${B.border}`,
          padding: '10px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          background: B.white,
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 11, color: B.inkFaint, marginBottom: 2 }}>
              {isHe ? 'איזו מפלגה הכי מתאימה לך?' : "What's your match?"}
            </div>
            <div dir="ltr" style={{
              fontSize: 12,
              fontWeight: 700,
              color: ACCENT,
              fontFamily: 'ui-monospace, monospace',
              letterSpacing: '0.04em',
            }}>
              tinyurl.com/matzpen26
            </div>
          </div>
          <QRCodeSVG
            value={SITE_URL}
            size={52}
            bgColor={B.white}
            fgColor={B.ink}
            level="M"
          />
        </div>
      </div>
    )
  }
)

ShareCard.displayName = 'ShareCard'
