import type { ReviewEvent } from '../../../shared/types'

interface Props {
  event: ReviewEvent
  eventIndex: number
  totalEvents: number
  colors: { bg: string; text: string; accent: string; border: string }
}

const CATEGORY_META = {
  error:    { color: '#ef4444', label: 'ERREUR',      icon: '✕' },
  strength: { color: '#22c55e', label: 'POINT FORT',  icon: '✓' },
  tip:      { color: '#f59e0b', label: 'CONSEIL',     icon: '◆' },
} as const

export function ReviewEventOverlay({ event, eventIndex, totalEvents, colors }: Props) {
  const meta = CATEGORY_META[event.category]

  return (
    <div
      className="w-80 rounded-xl overflow-hidden animate-slide-up"
      style={{
        background: 'rgba(8, 10, 18, 0.92)',
        border: `1px solid ${meta.color}40`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px ${meta.color}15`,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {/* Ligne d'accent colorée selon la catégorie */}
      <div
        className="h-0.5 w-full"
        style={{ background: `linear-gradient(90deg, ${meta.color}, transparent)` }}
      />

      <div className="px-4 py-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            {/* Badge catégorie */}
            <span
              className="text-[9px] font-black px-2 py-0.5 rounded tracking-widest"
              style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
            >
              {meta.icon} {meta.label}
            </span>
            {/* Badge REVIEW mode */}
            <span
              className="text-[9px] font-bold tracking-widest"
              style={{ color: colors.accent, opacity: 0.6 }}
            >
              REVIEW
            </span>
          </div>
          {/* Compteur événements */}
          <span className="text-[8px] font-mono text-white opacity-30">
            {eventIndex + 1}/{totalEvents}
          </span>
        </div>

        {/* Titre */}
        <p className="text-xs font-bold mb-1.5" style={{ color: meta.color }}>
          {event.title}
        </p>

        {/* Description */}
        <p className="text-sm leading-relaxed" style={{ color: colors.text }}>
          {event.description}
        </p>

        {/* Barre de décompte 15s */}
        <div
          className="h-px mt-3 rounded-full overflow-hidden"
          style={{ backgroundColor: `${meta.color}30` }}
        >
          <div
            className="h-full rounded-full"
            style={{
              backgroundColor: meta.color,
              animation: 'shrink15s 15s linear forwards',
            }}
          />
        </div>
      </div>

      {/* Dots indicateurs de progression */}
      {totalEvents > 1 && (
        <div className="flex items-center justify-center gap-1 pb-2">
          {Array.from({ length: Math.min(totalEvents, 9) }, (_, i) => (
            <div
              key={i}
              className="rounded-full transition-all"
              style={{
                width: i === eventIndex ? 10 : 4,
                height: 4,
                backgroundColor: i === eventIndex ? meta.color : `${meta.color}25`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
