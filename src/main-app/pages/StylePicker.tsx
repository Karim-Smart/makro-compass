import { useNavigate } from 'react-router-dom'
import { useCoachingStore } from '../stores/coachingStore'
import { useSubscriptionStore } from '../stores/subscriptionStore'
import { StyleCard } from '../components/StyleCard'
import { COACHING_STYLES, TIER_LABELS } from '../../../shared/constants'
import type { CoachingStyle } from '../../../shared/types'
import { canAccess } from '../../../shared/feature-gates'

const STYLES: CoachingStyle[] = ['LCK', 'LEC', 'LCS', 'LPL']

// Philosophies enrichies par style
const PHILOSOPHY: Record<CoachingStyle, { headline: string; pillars: string[] }> = {
  LCK: {
    headline: 'Contrôle parfait, zéro risque inutile',
    pillars: ['Slow push + crash', 'Vision dominante', 'Objectifs avant kills', 'Split push calculé'],
  },
  LEC: {
    headline: 'Snowball créatif, convertis chaque avantage',
    pillars: ['Roaming créatif', 'Tempo rapide', 'Convertir kill → tour → objectif', 'Appât baron'],
  },
  LCS: {
    headline: 'Teamfight groupé autour des objectifs',
    pillars: ["Cohésion d'équipe", 'Setup complet avant baron', 'Peeling du carry', 'Adaptation au game state'],
  },
  LPL: {
    headline: 'Pression maximale, ne laisse jamais respirer',
    pillars: ['Invade level 1', 'Kill → push → objectif sans reset', 'Baron agressif 50/50', 'Jungle deny constant'],
  },
}

export default function StylePicker() {
  const { selectedStyle, setStyle } = useCoachingStore()
  const tier = useSubscriptionStore((s) => s.status?.tier ?? 'free')
  const hasAllStyles = canAccess('all_coaching_styles', tier)
  const current = COACHING_STYLES[selectedStyle]
  const phil = PHILOSOPHY[selectedStyle]

  return (
    <div className="h-full flex flex-col overflow-auto">

      {/* ─── Hero ─── */}
      <div
        className="relative px-8 pt-7 pb-5 overflow-hidden flex-shrink-0"
        style={{
          background: `linear-gradient(180deg, ${current.colors.border}35 0%, transparent 100%)`
        }}
      >
        <div
          className="absolute left-0 top-0 bottom-0 w-1 rounded-r"
          style={{ backgroundColor: current.colors.accent }}
        />
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.25em] mb-1" style={{ color: current.colors.accent, opacity: 0.6 }}>
              Style de coaching
            </div>
            <h1 className="text-2xl font-black tracking-tight mb-1" style={{ color: '#F0E6D2', fontFamily: 'Cinzel, serif' }}>
              Choisis ta philosophie
            </h1>
            <p className="text-xs opacity-40 text-white max-w-md">
              Chaque région a une approche macro unique. Ce style guide tous les conseils de l'overlay en partie.
            </p>
          </div>
          {/* Style actif badge compact */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 clip-bevel-sm flex-shrink-0"
            style={{
              backgroundColor: `${current.colors.accent}15`,
              border: `1px solid ${current.colors.accent}40`,
            }}
          >
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: current.colors.accent }} />
            <span className="text-xs font-black" style={{ color: current.colors.accent }}>{current.name} actif</span>
          </div>
        </div>
      </div>

      {/* ─── Grille 2×2 ─── */}
      <div className="flex-1 px-6 pb-4 overflow-auto">
        <div className="grid grid-cols-2 gap-3 max-w-3xl mx-auto stagger-enter">
          {STYLES.map((style) => {
            const locked = !hasAllStyles && style !== 'LCK'
            return (
              <div key={style} className="relative">
                <StyleCard
                  style={style}
                  isSelected={selectedStyle === style}
                  onSelect={locked ? () => {} : setStyle}
                />
                {locked && (
                  <div className="absolute inset-0 clip-bevel-lg flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <span
                      className="px-3 py-1 clip-bevel-sm text-[10px] font-black uppercase tracking-wider"
                      style={{ backgroundColor: '#C89B3C25', color: '#C89B3C', border: '1px solid #C89B3C50' }}
                    >
                      {TIER_LABELS.pro} requis
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ─── Philosophie du style actif ─── */}
        <div
          className="mt-4 max-w-3xl mx-auto clip-bevel-lg overflow-hidden"
          style={{
            border: `1px solid ${current.colors.border}`,
          }}
        >
          {/* Header philosophie */}
          <div
            className="px-5 py-3 flex items-center justify-between"
            style={{
              background: `linear-gradient(90deg, ${current.colors.border}60 0%, transparent 100%)`,
              borderBottom: `1px solid ${current.colors.border}50`,
            }}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-lg">{current.flag}</span>
              <div>
                <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: current.colors.text, opacity: 0.4 }}>
                  Philosophie {current.name}
                </div>
                <div className="text-sm font-bold" style={{ color: current.colors.accent }}>
                  {phil.headline}
                </div>
              </div>
            </div>
            <div className="flex gap-1">
              {current.traits.map((t) => (
                <span
                  key={t}
                  className="text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-wider"
                  style={{ backgroundColor: `${current.colors.accent}20`, color: current.colors.accent }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Pilliers tactiques */}
          <div
            className="px-5 py-3 grid grid-cols-4 gap-3"
            style={{ backgroundColor: `${current.colors.bg}80` }}
          >
            {phil.pillars.map((p, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <div
                  className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0"
                  style={{ backgroundColor: current.colors.accent }}
                />
                <span className="text-[10px] leading-relaxed" style={{ color: current.colors.text, opacity: 0.7 }}>
                  {p}
                </span>
              </div>
            ))}
          </div>

          {/* Preview conseil overlay */}
          <div
            className="px-5 py-3 flex items-center gap-3"
            style={{
              borderTop: `1px solid ${current.colors.border}40`,
              backgroundColor: `${current.colors.bg}60`,
            }}
          >
            <div
              className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest flex-shrink-0"
              style={{ backgroundColor: `${current.colors.accent}20`, color: current.colors.accent }}
            >
              Aperçu overlay
            </div>
            <span
              className="text-xs italic"
              style={{ color: current.colors.text, opacity: 0.65 }}
            >
              "{current.previewAdvice}"
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
