import { forwardRef } from 'react'
import { DIMENSIONS, type DimensionKey, type PartyMatch } from '../../utils/matching'
import type { Party } from '../../types'

interface Props {
  topMatch: PartyMatch
  party: Party
  lang: 'he' | 'en'
}

const DIM_LABELS_HE: Record<DimensionKey, string> = {
  security:      'ביטחון ושלום',
  religion:      'דת ומדינה',
  socioeconomic: 'כלכלה ורווחה',
  judicial:      'שלטון החוק',
  minority:      'זכויות מיעוטים',
  governance:    'ממשל ושקיפות',
}

const DIM_LABELS_EN: Record<DimensionKey, string> = {
  security:      'Security & Peace',
  religion:      'Religion & State',
  socioeconomic: 'Economy & Welfare',
  judicial:      'Rule of Law',
  minority:      'Minority Rights',
  governance:    'Governance',
}

const DIM_ICONS: Record<DimensionKey, string> = {
  security:      '🛡️',
  religion:      '✡️',
  socioeconomic: '📊',
  judicial:      '⚖️',
  minority:      '🤝',
  governance:    '🏛️',
}

export const ShareCard = forwardRef<HTMLDivElement, Props>(
  ({ topMatch, party, lang }, ref) => {
    const isHe = lang === 'he'
    const score = topMatch.overall_stated
    const partyName = isHe ? party.name_he : party.name_en
    const dims = Object.keys(DIMENSIONS) as DimensionKey[]
    const col = party.color

    // Lighten the party color for background tint
    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      return { r, g, b }
    }
    const { r, g, b } = hexToRgb(col)
    const tint = `rgba(${r},${g},${b},0.07)`

    return (
      <div
        ref={ref}
        dir={isHe ? 'rtl' : 'ltr'}
        style={{
          width: '480px',
          height: '620px',
          background: '#ffffff',
          fontFamily: '"Segoe UI", system-ui, -apple-system, Arial, sans-serif',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header strip */}
        <div style={{
          background: col,
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ color: 'white', fontSize: '18px', fontWeight: 700, letterSpacing: '-0.3px' }}>
            🧭 {isHe ? 'מצפן בחירות 2026' : 'Election Compass 2026'}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>
            matzpen.co.il
          </span>
        </div>

        {/* Body */}
        <div style={{
          flex: 1,
          background: tint,
          padding: '24px 28px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}>
          {/* Top match hero */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            {/* Party circle */}
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: col,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: `0 4px 16px rgba(${r},${g},${b},0.35)`,
            }}>
              <span style={{ color: 'white', fontSize: '22px', fontWeight: 800 }}>
                {partyName.charAt(0)}
              </span>
            </div>

            {/* Name + score */}
            <div>
              <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '2px' }}>
                {isHe ? 'ההתאמה הטובה ביותר' : 'Best match'}
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#111827', lineHeight: 1.1 }}>
                {partyName}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '4px' }}>
                <span style={{ fontSize: '42px', fontWeight: 900, color: col, lineHeight: 1 }}>
                  {score}%
                </span>
                <span style={{ fontSize: '15px', color: '#6b7280' }}>
                  {isHe ? 'התאמה' : 'match'}
                </span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: '1px', background: `rgba(${r},${g},${b},0.15)` }} />

          {/* Dimension breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 600, marginBottom: '2px' }}>
              {isHe ? 'פירוט לפי נושא' : 'By topic'}
            </div>
            {dims.map(dim => {
              const dimScore = topMatch.by_dimension[dim]?.stated
              if (dimScore === null || dimScore === undefined) return null
              const label = isHe ? DIM_LABELS_HE[dim] : DIM_LABELS_EN[dim]
              const icon = DIM_ICONS[dim]
              const pct = Math.round(dimScore)
              const barColor = pct >= 70 ? col : pct >= 50 ? '#f59e0b' : '#ef4444'

              return (
                <div key={dim} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* Icon + label */}
                  <div style={{
                    width: isHe ? '130px' : '140px',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    color: '#374151',
                    fontWeight: 500,
                  }}>
                    <span>{icon}</span>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {label}
                    </span>
                  </div>

                  {/* Bar */}
                  <div style={{
                    flex: 1,
                    height: '8px',
                    background: '#e5e7eb',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: barColor,
                      borderRadius: '4px',
                      transition: 'none',
                    }} />
                  </div>

                  {/* Pct label */}
                  <div style={{
                    width: '36px',
                    flexShrink: 0,
                    fontSize: '13px',
                    fontWeight: 700,
                    color: barColor,
                    textAlign: isHe ? 'right' : 'left',
                  }}>
                    {pct}%
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          background: '#f9fafb',
          borderTop: '1px solid #e5e7eb',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '12px', color: '#9ca3af' }}>
            {isHe ? 'מה ההתאמה שלך?' : 'What\'s your match?'}
          </span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: col }}>
            matzpen.co.il
          </span>
        </div>
      </div>
    )
  }
)

ShareCard.displayName = 'ShareCard'
