import type { CategoryId } from '../types'
import { CATEGORY_META } from '../data/meta'
import { t } from '../lib/i18n'

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function pseudo(seed: number, index: number): number {
  const x = Math.sin(seed * 0.0001 + index * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

export function BeaconMark({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="7.4" cy="12" r="2.5" fill="currentColor" />
      <path d="M11.8 6.7a7.4 7.4 0 0 1 0 10.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" opacity=".85" />
      <path d="M15.6 3.7a11.8 11.8 0 0 1 0 16.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" opacity=".5" />
      <path d="M19.4 1a16 16 0 0 1 0 22" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" opacity=".22" />
    </svg>
  )
}

export function SignalArt({
  seed,
  color,
  glyph,
  className = '',
}: {
  seed: string
  color: string
  glyph: string
  className?: string
}) {
  const h = hash(seed)
  const rings = [0, 1, 2, 3].map((i) => 26 + i * 24 + pseudo(h, i) * 12)
  const rot = (pseudo(h, 9) - 0.5) * 24
  return (
    <svg viewBox="0 0 240 150" className={className} aria-hidden="true" preserveAspectRatio="xMaxYMid slice">
      <g transform={`translate(196 78) rotate(${rot})`}>
        {rings.map((r, i) => (
          <circle
            key={r}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={i === 0 ? 1.4 : 0.8}
            opacity={0.34 - i * 0.06}
            strokeDasharray={i === 2 ? '2 4' : undefined}
          />
        ))}
        <path d="M0 0 L-190 -54 L-190 54 Z" fill={color} opacity="0.055" />
        <path d="M0 0 L-190 -18 L-190 18 Z" fill={color} opacity="0.09" />
      </g>
      <g opacity="0.16" fill={color}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <circle key={i} cx={26 + i * 13} cy={128 - i * 3} r={1.2} />
        ))}
      </g>
      <text
        x="22"
        y="104"
        fill={color}
        opacity="0.1"
        fontFamily="Instrument Serif, Georgia, serif"
        fontSize="96"
        fontWeight="400"
      >
        {glyph}
      </text>
    </svg>
  )
}

export function GlyphArt({
  seed,
  color,
  glyph,
  label,
  category,
}: {
  seed: string
  color: string
  glyph: string
  label: string
  category: CategoryId
}) {
  const h = hash(seed)
  const rows = 7
  const cols = 16
  return (
    <div className="glyph-art" style={{ ['--art-color' as string]: color }}>
      <svg viewBox="0 0 400 170" aria-hidden="true">
        <defs>
          <linearGradient id={`fade-${h}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={color} stopOpacity="0" />
            <stop offset="0.55" stopColor={color} stopOpacity="0.16" />
            <stop offset="1" stopColor={color} stopOpacity="0.04" />
          </linearGradient>
        </defs>
        <rect width="400" height="170" fill={`url(#fade-${h})`} />
        {Array.from({ length: rows }).map((_, r) =>
          Array.from({ length: cols }).map((__, c) => {
            const on = pseudo(h + r * 31, c) > 0.58
            if (!on) return null
            return (
              <rect
                key={`${r}-${c}`}
                x={238 + c * 9.5}
                y={20 + r * 18}
                width={5.5}
                height={5.5}
                rx={1}
                fill={color}
                opacity={0.18 + pseudo(h, r + c) * 0.5}
              />
            )
          }),
        )}
        <g transform="translate(18 118)">
          <text
            fill={color}
            opacity="0.18"
            fontFamily="Instrument Serif, Georgia, serif"
            fontSize="108"
            fontWeight="400"
          >
            {glyph}
          </text>
        </g>
        <circle cx="330" cy="122" r="34" fill={color} opacity="0.14" />
        <circle cx="330" cy="122" r="34" fill="none" stroke={color} opacity="0.35" />
        <text
          x="330"
          y="128"
          textAnchor="middle"
          fill={color}
          fontFamily="Inter Tight, system-ui, sans-serif"
          fontSize="15"
          fontWeight="700"
          letterSpacing="0.06em"
        >
          {label}
        </text>
      </svg>
      <span className="glyph-art__caption">{t(CATEGORY_META[category]?.name ?? 'Geral')}</span>
    </div>
  )
}

export function EmptyArt({ tone = 'ink' }: { tone?: 'ink' | 'yellow' }) {
  return (
    <svg viewBox="0 0 220 140" className="empty-art" aria-hidden="true">
      <g fill="none" stroke={tone === 'yellow' ? 'var(--accent)' : 'var(--ink)'} strokeWidth="1.1" opacity=".22">
        <circle cx="110" cy="72" r="18" />
        <circle cx="110" cy="72" r="34" strokeDasharray="2 5" />
        <circle cx="110" cy="72" r="52" opacity=".6" />
        <circle cx="110" cy="72" r="72" opacity=".35" />
      </g>
      <path d="M110 72 L204 30 L204 114 Z" fill={tone === 'yellow' ? 'var(--accent)' : 'var(--ink)'} opacity=".07" />
      <circle cx="110" cy="72" r="7" fill={tone === 'yellow' ? 'var(--accent)' : 'var(--ink)'} opacity=".8" />
      <path d="M32 108h28M32 100h16M32 92h22" stroke={tone === 'yellow' ? 'var(--accent)' : 'var(--ink)'} strokeWidth="2" opacity=".25" strokeLinecap="round" />
    </svg>
  )
}
