import type { CoachingStyle } from '../../../shared/types'
import { COACHING_STYLES } from '../../../shared/constants'

const STYLES: CoachingStyle[] = ['LCK', 'LEC', 'LCS', 'LPL']

// Icônes SVG inline par style — représentent la philosophie de chaque région
const STYLE_ICONS: Record<CoachingStyle, React.ReactNode> = {
  // LCK — Bouclier/diamant (précision, discipline)
  LCK: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"
        stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15" />
      <path d="M12 6l-4 3v4l4 5 4-5V9l-4-3z" fill="currentColor" fillOpacity="0.4" />
    </svg>
  ),
  // LEC — Étoile/étincelle (créativité, flair)
  LEC: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 2l2.4 7.2H22l-6 4.8 2.4 7.2L12 16.4l-6.4 4.8 2.4-7.2-6-4.8h7.6L12 2z"
        stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15" />
      <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.4" />
    </svg>
  ),
  // LCS — Poings/équipe (teamfight, unité)
  LCS: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15" />
      <circle cx="5" cy="11" r="2.5" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.1" />
      <circle cx="19" cy="11" r="2.5" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.1" />
      <path d="M3 20c0-3.5 2-5 4.5-5.5M21 20c0-3.5-2-5-4.5-5.5M7 20c0-4 2.2-6 5-6s5 2 5 6"
        stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.1" />
    </svg>
  ),
  // LPL — Foudre/épée (agression, tempo)
  LPL: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M13 2L4 14h6l-2 8 9-12h-6l2-8z"
        stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.25" />
    </svg>
  ),
}

// Sous-titre court pour chaque style
const STYLE_TAGLINE: Record<CoachingStyle, string> = {
  LCK: 'Macro',
  LEC: 'Créatif',
  LCS: 'Team',
  LPL: 'Aggro',
}

interface Props {
  selectedStyle: CoachingStyle
}

export function StyleSwitcher({ selectedStyle }: Props) {
  return (
    <div className="flex flex-col h-full">
      {/* Header draggable */}
      <div
        className="px-2 pt-2 pb-1 text-[7px] font-black uppercase tracking-[0.25em] text-center"
        style={{
          color: 'rgba(255,255,255,0.2)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          // @ts-expect-error: propriété CSS Electron pour le drag
          WebkitAppRegion: 'drag',
        }}
      >
        Coach
      </div>

      {/* Boutons cliquables (no-drag) */}
      <div
        className="flex-1 flex flex-col"
        style={{
          // @ts-expect-error: propriété CSS Electron
          WebkitAppRegion: 'no-drag',
        }}
      >
        {STYLES.map((style) => {
          const s = COACHING_STYLES[style]
          const isActive = style === selectedStyle

          return (
            <button
              key={style}
              onClick={() => window.overlayAPI.changeStyle(style)}
              className="flex-1 flex flex-col items-center justify-center gap-[2px] transition-all duration-200 relative"
              style={{
                backgroundColor: isActive ? `${s.colors.accent}18` : 'transparent',
                borderLeft: isActive ? `2px solid ${s.colors.accent}` : '2px solid transparent',
                cursor: 'pointer',
                color: isActive ? s.colors.accent : 'rgba(255,255,255,0.3)',
              }}
            >
              {/* Glow actif */}
              {isActive && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: `radial-gradient(ellipse at left center, ${s.colors.accent}12, transparent 70%)`,
                  }}
                />
              )}

              {/* Icône SVG */}
              <div className="relative z-10 transition-transform duration-200" style={{
                transform: isActive ? 'scale(1.1)' : 'scale(0.9)',
                filter: isActive ? `drop-shadow(0 0 4px ${s.colors.accent}60)` : 'none',
              }}>
                {STYLE_ICONS[style]}
              </div>

              {/* Label */}
              <span
                className="relative z-10 text-[8px] font-black tracking-[0.15em] leading-none"
                style={{
                  color: isActive ? s.colors.accent : 'rgba(255,255,255,0.3)',
                }}
              >
                {style}
              </span>

              {/* Tagline (seulement actif) */}
              {isActive && (
                <span
                  className="relative z-10 text-[6px] uppercase tracking-[0.2em] leading-none"
                  style={{ color: `${s.colors.accent}80` }}
                >
                  {STYLE_TAGLINE[style]}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
