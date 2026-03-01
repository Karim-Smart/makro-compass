import type { GameAlert } from '../../../shared/types'

interface Props {
  alert: GameAlert
}

const TYPE_STYLES = {
  info:    { bg: '#3b82f620', border: '#3b82f6', color: '#93c5fd' },
  warning: { bg: '#f59e0b20', border: '#f59e0b', color: '#fcd34d' },
  danger:  { bg: '#ef444420', border: '#ef4444', color: '#fca5a5' },
  success: { bg: '#22c55e20', border: '#22c55e', color: '#86efac' },
} as const

export function AlertOverlay({ alert }: Props) {
  const style = TYPE_STYLES[alert.type] ?? TYPE_STYLES.info

  return (
    <div
      className="w-full rounded-lg overflow-hidden"
      style={{
        background: `rgba(8, 10, 18, 0.92)`,
        border: `1px solid ${style.border}`,
        boxShadow: `0 4px 20px rgba(0,0,0,0.5), 0 0 12px ${style.border}30`,
        animation: 'alertSlide 3s ease-in-out forwards',
      }}
    >
      {/* Ligne d'accent */}
      <div
        className="h-0.5 w-full"
        style={{ background: style.border }}
      />

      <div className="px-3 py-2 flex items-center gap-2">
        <span
          className="text-xs font-bold leading-snug"
          style={{ color: style.color }}
        >
          {alert.text}
        </span>
      </div>

      {/* Barre de décompte 3s */}
      <div className="h-px" style={{ backgroundColor: `${style.border}40` }}>
        <div
          className="h-full"
          style={{
            backgroundColor: style.border,
            animation: 'shrink3s 3s linear forwards',
          }}
        />
      </div>

    </div>
  )
}
