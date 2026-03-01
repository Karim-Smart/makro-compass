import type { CoachAdvice } from '../../../shared/types'

interface Props {
  advice: CoachAdvice | null
  colors: { bg: string; text: string; accent: string; border: string }
  queueTotal: number
  onExpand: () => void
}

const PRIORITY_ICON = {
  high: '⚡',
  medium: '●',
  low: '○',
} as const

type P = keyof typeof PRIORITY_ICON

export function AdviceMinBar({ advice, colors, queueTotal, onExpand }: Props) {
  const icon = advice ? (PRIORITY_ICON[advice.priority as P] ?? '○') : '○'

  return (
    <button
      onClick={onExpand}
      className="w-80 flex items-center gap-2 px-3 rounded-lg transition-opacity hover:opacity-90"
      style={{
        height: 28,
        background: 'rgba(8, 10, 18, 0.88)',
        border: `1px solid ${colors.border}`,
        boxShadow: `0 4px 16px rgba(0,0,0,0.4)`,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        cursor: 'pointer',
        // @ts-expect-error: propriété CSS Electron pour désactiver le drag
        WebkitAppRegion: 'no-drag',
      }}
    >
      {/* Style badge */}
      <span
        className="text-[8px] font-black px-1.5 py-0.5 rounded tracking-widest shrink-0"
        style={{ backgroundColor: `${colors.accent}25`, color: colors.accent }}
      >
        {advice?.style ?? '—'}
      </span>

      {/* Priority icon */}
      <span className="text-[9px] shrink-0">{icon}</span>

      {/* Spacer line */}
      <div className="flex-1 h-px" style={{ backgroundColor: `${colors.border}60` }} />

      {/* Queue count */}
      <span className="text-[8px] font-mono shrink-0" style={{ color: `${colors.text}60` }}>
        {queueTotal > 0 ? `${queueTotal}` : '0'}/{10}
      </span>

      {/* Expand arrow */}
      <span className="text-[10px] font-bold shrink-0" style={{ color: colors.accent }}>
        ▼
      </span>
    </button>
  )
}
