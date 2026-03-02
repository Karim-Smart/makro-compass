import type { CoachAdvice } from '../../../shared/types'

interface Props {
  advice: CoachAdvice
  colors: { bg: string; text: string; accent: string; border: string }
  queuePos: number
  queueTotal: number
  rotateKey: number
  onMinimize?: () => void
  onSkip?: () => void
}

const PRIORITY_META = {
  high:   { color: '#ef4444', icon: '⚡', label: 'URGENT'  },
  medium: { color: '#f59e0b', icon: '●',  label: 'MOYEN'   },
  low:    { color: '#6b7280', icon: '○',  label: 'INFO'    },
} as const

type P = keyof typeof PRIORITY_META

// Badge de catégorie contextuel — remplace le badge style en position principale
const CATEGORY_BADGE: Record<string, { label: string; color: string }> = {
  'elder-active':   { label: 'OBJECTIF', color: '#f97316' },
  'baron-buff':     { label: 'OBJECTIF', color: '#f97316' },
  'soul-point':     { label: 'OBJECTIF', color: '#f97316' },
  'dragon-soul':    { label: 'OBJECTIF', color: '#f97316' },
  'drake-timer':    { label: 'OBJECTIF', color: '#f97316' },
  'baron-timer':    { label: 'OBJECTIF', color: '#f97316' },
  'herald-timer':   { label: 'OBJECTIF', color: '#f97316' },
  'respawn-window': { label: 'LANE',     color: '#22d3ee' },
  'level-diff':     { label: 'LANE',     color: '#22d3ee' },
  'matchup':        { label: 'LANE',     color: '#22d3ee' },
  'class-rule':     { label: 'LANE',     color: '#22d3ee' },
  'power-curve':    { label: 'LANE',     color: '#22d3ee' },
  'cs':             { label: 'LANE',     color: '#22d3ee' },
  'gold-diff':      { label: 'MACRO',    color: '#a78bfa' },
  'kill-diff':      { label: 'MACRO',    color: '#a78bfa' },
  'tower-state':    { label: 'MACRO',    color: '#a78bfa' },
  'structural':     { label: 'MACRO',    color: '#a78bfa' },
  'plates':         { label: 'MACRO',    color: '#a78bfa' },
  'phase':          { label: 'MACRO',    color: '#a78bfa' },
  'comp':           { label: 'MACRO',    color: '#a78bfa' },
  'ally':           { label: 'MACRO',    color: '#a78bfa' },
  'item-spike':     { label: 'ITEM',     color: '#f59e0b' },
  'wave':           { label: 'LANE',     color: '#22d3ee' },
  'back-timing':    { label: 'LANE',     color: '#22d3ee' },
  'bounty':         { label: 'MACRO',    color: '#a78bfa' },
  'death-analysis': { label: 'DÉFENSE',  color: '#ef4444' },
  'kp':             { label: 'MACRO',    color: '#a78bfa' },
  'vision':         { label: 'VISION',   color: '#38bdf8' },
  'map-trade':      { label: 'MACRO',    color: '#a78bfa' },
  'grub-timer':     { label: 'OBJECTIF', color: '#f97316' },
  'rotation':       { label: 'MACRO',    color: '#a78bfa' },
  'teamfight':      { label: 'FIGHT',    color: '#ef4444' },
  'number-advantage': { label: 'FIGHT',  color: '#ef4444' },
  'fight-readiness': { label: 'FIGHT',   color: '#ef4444' },
  'gold-swing':      { label: 'GOLD',    color: '#facc15' },
}

export function AdviceOverlay({ advice, colors, queuePos, queueTotal, rotateKey, onMinimize, onSkip }: Props) {
  const meta = PRIORITY_META[advice.priority as P] ?? PRIORITY_META.medium
  const catBadge = advice.category ? CATEGORY_BADGE[advice.category] : undefined

  return (
    <div
      className={`w-[360px] overflow-hidden animate-slide-up clip-bevel overlay-glass ${advice.priority === 'high' ? 'priority-pulse-high' : ''}`}
      style={{
        boxShadow: advice.priority === 'high'
          ? `0 8px 32px rgba(0,0,0,0.6), 0 0 16px rgba(239, 68, 68, 0.15)`
          : `0 8px 32px rgba(0,0,0,0.6), 0 0 12px rgba(200, 155, 60, 0.06)`,
      }}
    >
      {/* Ligne d'accent colorée en haut (rouge si urgent, dorée sinon) */}
      <div
        className="h-0.5 w-full"
        style={{
          background: advice.priority === 'high'
            ? `linear-gradient(90deg, #ef4444, ${meta.color}60, transparent)`
            : `linear-gradient(90deg, #C89B3C, ${colors.accent}60, transparent)`,
        }}
      />

      <div className="px-4 py-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            {/* Badge catégorie (principal) ou style si pas de catégorie */}
            {catBadge ? (
              <span
                className="text-[9px] font-black px-2 py-0.5 clip-bevel-sm tracking-widest"
                style={{ backgroundColor: `${catBadge.color}25`, color: catBadge.color }}
              >
                {catBadge.label}
              </span>
            ) : (
              <span
                className="text-[9px] font-black px-2 py-0.5 clip-bevel-sm tracking-widest"
                style={{ backgroundColor: `${colors.accent}25`, color: colors.accent }}
              >
                {advice.style}
              </span>
            )}
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
            {/* Skip button */}
            {onSkip && queueTotal > 1 && (
              <button
                onClick={onSkip}
                className="text-[10px] font-bold leading-none opacity-40 hover:opacity-80 transition-opacity"
                title="Conseil suivant"
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
                ⏭
              </button>
            )}
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
        <p style={{ color: colors.text, fontSize: 13, lineHeight: '1.55' }}>
          {advice.text}
        </p>

        {/* Style coaching — discret, en bas si catégorie affichée en haut */}
        {catBadge && (
          <div className="mt-2 flex items-center gap-1">
            <span
              className="text-[8px] font-black tracking-widest opacity-30"
              style={{ color: colors.accent }}
            >
              {advice.style}
            </span>
          </div>
        )}

        {/* Barre de décompte 30s */}
        <div
          className="h-px mt-2 rounded-full overflow-hidden"
          style={{ backgroundColor: `${colors.accent}20` }}
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

      {/* Dots indicateurs avec transition smooth */}
      {queueTotal > 1 && (
        <div className="flex items-center justify-center gap-1 pb-2">
          {Array.from({ length: queueTotal }, (_, i) => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: i === queuePos - 1 ? 10 : 4,
                height: 4,
                backgroundColor: i === queuePos - 1 ? colors.accent : `${colors.accent}30`,
                transition: 'width 0.3s ease, background-color 0.3s ease',
              }}
            />
          ))}
        </div>
      )}

    </div>
  )
}
