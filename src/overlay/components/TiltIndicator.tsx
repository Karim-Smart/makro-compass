import type { TiltStatus } from '../../../shared/types'

interface Props {
  tilt: TiltStatus
}

function getTiltColor(level: TiltStatus['tiltLevel']): string {
  switch (level) {
    case 'severe': return '#ef4444'
    case 'moderate': return '#f59e0b'
    case 'mild': return '#facc15'
    default: return 'transparent'
  }
}

function getTiltLabel(level: TiltStatus['tiltLevel']): string {
  switch (level) {
    case 'severe': return 'TILT'
    case 'moderate': return 'STRESS'
    case 'mild': return 'FOCUS'
    default: return ''
  }
}

export function TiltIndicator({ tilt }: Props) {
  if (tilt.tiltLevel === 'none') return null

  const color = getTiltColor(tilt.tiltLevel)

  return (
    <div
      className="flex items-center gap-1 px-1.5 py-0.5 rounded"
      style={{ background: `${color}20`, border: `1px solid ${color}40` }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full animate-pulse"
        style={{ background: color }}
      />
      <span className="text-[8px] font-black uppercase tracking-wider" style={{ color }}>
        {getTiltLabel(tilt.tiltLevel)}
      </span>
    </div>
  )
}
