import type { SourceInfo } from '../types'
import { needsLightText } from '../data/meta'

export function SourceBadge({
  source,
  size = 'sm',
  fallback = '?',
}: {
  source?: SourceInfo
  size?: 'xs' | 'sm' | 'md' | 'lg'
  fallback?: string
}) {
  const label = source?.monogram ?? source?.short?.slice(0, 3) ?? fallback
  const color = source?.color ?? '#6B675C'
  const light = needsLightText(source)
  return (
    <span
      className={`source-badge source-badge--${size}`}
      style={{ background: color, color: light ? '#fff' : '#101010' }}
      aria-hidden="true"
    >
      {label}
    </span>
  )
}
