import type { CoachAdvice } from '../../../shared/types'

interface Props {
  advice: CoachAdvice
  colors: { bg: string; text: string; accent: string; border: string }
  queuePos: number
  queueTotal: number
  rotateKey: number
  onMinimize?: () => void
}

const PRIORITY_META = {
  high:   { color: '#ef4444', icon: '⚡', label: 'URGENT'  },
  medium: { color: '#f59e0b', icon: '●',  label: 'MOYEN'   },
  low:    { color: '#6b7280', icon: '○',  label: 'INFO'    },
} as const

type P = keyof typeof PRIORITY_META

export function AdviceOverlay({ advice, colors, queuePos, queueTotal, rotateKey, onMinimize }: Props) {
  const meta = PRIORITY_META[advice.priority as P] ?? PRIORITY_META.medium

  return (
    <div
      className="w-80 rounded-xl overflow-hidden animate-slide-up"
      style={{
        background: `rgba(8, 10, 18, 0.88)`,
        border: `1px solid ${colors.border}`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px ${colors.accent}18`,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {/* Ligne d'accent en haut */}
      <div
        className="h-0.5 w-full"
        style={{ background: `linear-gradient(90deg, ${colors.accent}, transparent)` }}
      />

      <div className="px-4 py-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            {/* Style badge */}
            <span
              className="text-[9px] font-black px-2 py-0.5 rounded tracking-widest"
              style={{ backgroundColor: `${colors.accent}25`, color: colors.accent }}
            >
              {advice.style}
            </span>
            {/* Priority */}
            <span
              className="text-[9px] font-bold"
              style={{ color: meta.color }}
            >
              {meta.icon} {meta.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Queue position */}
            {queueTotal > 1 && (
              <span className="text-[8px] font-mono opacity-40 text-white">
                {queuePos}/{queueTotal}
              </span>
            )}
            {/* Game time */}
            <span className="text-[9px] font-mono opacity-30 text-white">
              {Math.floor(advice.gameTime / 60)}:{String(advice.gameTime % 60).padStart(2, '0')}
            </span>
            {/* Minimize button */}
            {onMinimize && (
              <button
                onClick={onMinimize}
                className="text-[11px] font-bold leading-none opacity-40 hover:opacity-80 transition-opacity"
                style={{
                  color: colors.accent,
                  // @ts-expect-error: propriété CSS Electron pour désactiver le drag
                  WebkitAppRegion: 'no-drag',
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                  padding: '0 2px',
                }}
              >
                −
              </button>
            )}
          </div>
        </div>

        {/* Texte */}
        <p className="text-sm leading-relaxed" style={{ color: colors.text }}>
          {advice.text}
        </p>

        {/* Barre de décompte 30s */}
        <div
          className="h-px mt-3 rounded-full overflow-hidden"
          style={{ backgroundColor: `${colors.border}80` }}
        >
          <div
            key={rotateKey}
            className="h-full rounded-full"
            style={{
              backgroundColor: colors.accent,
              animation: 'shrink30s 30s linear forwards',
            }}
          />
        </div>
      </div>

      {/* Dots indicateurs */}
      {queueTotal > 1 && (
        <div className="flex items-center justify-center gap-1 pb-2">
          {Array.from({ length: queueTotal }, (_, i) => (
            <div
              key={i}
              className="rounded-full transition-all"
              style={{
                width: i === queuePos - 1 ? 10 : 4,
                height: 4,
                backgroundColor: i === queuePos - 1 ? colors.accent : `${colors.accent}30`,
              }}
            />
          ))}
        </div>
      )}

    </div>
  )
}
