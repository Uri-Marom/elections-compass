// Bureau Design System — shared tokens and SVG motifs
// Drop this file into src/components/bureau/BureauComponents.tsx

export const ACCENT = '#0891b2'

export const B = {
  bg:          '#fafaf7',
  bgMid:       '#f4f4f5',
  ink:         '#0a0a0a',
  inkSoft:     '#52525b',
  inkFaint:    '#71717a',
  inkHint:     '#a1a1aa',
  border:      '#e4e4e7',
  borderMid:   '#d4d4d8',
  white:       '#ffffff',
  accent:      ACCENT,
  font:        "'Heebo', 'Rubik', system-ui, sans-serif",
  radius:      14,
  radiusLg:    20,
  radiusXl:    24,
} as const

export const DIM_COLOR: Record<string, string> = {
  security:      '#dc2626',
  religion:      '#9333ea',
  socioeconomic: '#16a34a',
  judicial:      '#d97706',
  minority:      '#0891b2',
  governance:    '#6366f1',
}

export const DIM_REGION: Record<string, { he: string; en: string }> = {
  security:      { he: 'גבולות הצפון',  en: 'The Borderlands'    },
  religion:      { he: 'הר הקודש',      en: 'The Sacred Heights' },
  socioeconomic: { he: 'עמק השוק',      en: 'The Market Valley'  },
  judicial:      { he: 'שדה המאזניים',  en: 'Plain of Scales'    },
  minority:      { he: 'גשר המעברים',   en: 'The Crossing'       },
  governance:    { he: 'בירת השלטון',   en: 'Capital Reach'      },
}

// ── CompassRose ───────────────────────────────────────────────────────────────

interface CompassRoseProps {
  size?: number
  color?: string
  accent?: string
  rotation?: number
  lang?: 'he' | 'en'
}

export function CompassRose({
  size = 80,
  color = '#0a0a0a',
  accent = ACCENT,
  rotation = 0,
  lang = 'he',
}: CompassRoseProps) {
  const cx = 50, cy = 50
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ display: 'block', flexShrink: 0 }}>
      <g transform={`rotate(${rotation} ${cx} ${cy})`}>
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
        {/* North */}
        <polygon points={`${cx},10 ${cx + 4},${cy - 2} ${cx},${cy} ${cx - 4},${cy - 2}`} fill={accent} />
        <polygon points={`${cx},10 ${cx - 4},${cy - 2} ${cx},${cy} ${cx + 4},${cy - 2}`} fill={color} />
        {/* South */}
        <polygon points={`${cx},90 ${cx + 4},${cy + 2} ${cx},${cy} ${cx - 4},${cy + 2}`} fill={color} opacity="0.7" />
        <polygon points={`${cx},90 ${cx - 4},${cy + 2} ${cx},${cy} ${cx + 4},${cy + 2}`} fill={color} opacity="0.5" />
        {/* West */}
        <polygon points={`10,${cy} ${cx - 2},${cy + 4} ${cx},${cy} ${cx - 2},${cy - 4}`} fill={color} opacity="0.5" />
        <polygon points={`10,${cy} ${cx - 2},${cy - 4} ${cx},${cy} ${cx - 2},${cy + 4}`} fill={color} opacity="0.7" />
        {/* East */}
        <polygon points={`90,${cy} ${cx + 2},${cy - 4} ${cx},${cy} ${cx + 2},${cy + 4}`} fill={color} opacity="0.7" />
        <polygon points={`90,${cy} ${cx + 2},${cy + 4} ${cx},${cy} ${cx + 2},${cy - 4}`} fill={color} opacity="0.5" />
        {/* Center */}
        <circle cx={cx} cy={cy} r="3" fill={accent} />
        <circle cx={cx} cy={cy} r="1" fill={color} />
        {/* Cardinal letters */}
        <text x={cx} y="8"  textAnchor="middle" fontSize="6" fontWeight="700" fill={color}>{lang === 'he' ? 'צ' : 'N'}</text>
        <text x={cx} y="97" textAnchor="middle" fontSize="6" fontWeight="700" fill={color}>{lang === 'he' ? 'ד' : 'S'}</text>
        <text x="6"  y={cy + 2} textAnchor="middle" fontSize="6" fontWeight="700" fill={color}>{lang === 'he' ? 'מ' : 'W'}</text>
        <text x="94" y={cy + 2} textAnchor="middle" fontSize="6" fontWeight="700" fill={color}>{lang === 'he' ? 'מז' : 'E'}</text>
      </g>
    </svg>
  )
}

// ── GridPaper ─────────────────────────────────────────────────────────────────

interface GridPaperProps {
  color?: string
  opacity?: number
  dotSize?: number
}

export function GridPaper({ color = '#0a0a0a', opacity = 0.04, dotSize = 24 }: GridPaperProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        backgroundImage: `radial-gradient(${color} 0.6px, transparent 0.6px)`,
        backgroundSize: `${dotSize}px ${dotSize}px`,
        opacity,
      }}
    />
  )
}

// ── BureauCard ────────────────────────────────────────────────────────────────

export function BureauCard({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: B.white,
      border: `1px solid ${B.border}`,
      borderRadius: B.radiusLg,
      overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  )
}
