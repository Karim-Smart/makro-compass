import { useCoachingStore } from '../stores/coachingStore'
import { StyleCard } from '../components/StyleCard'
import { COACHING_STYLES } from '../../../shared/constants'
import type { CoachingStyle } from '../../../shared/types'

const STYLES: CoachingStyle[] = ['LCK', 'LEC', 'LCS', 'LPL']

export default function StylePicker() {
  const { selectedStyle, setStyle } = useCoachingStore()
  const current = COACHING_STYLES[selectedStyle]

  return (
    <div className="h-full flex flex-col overflow-auto">
      {/* En-tête hero */}
      <div
        className="relative px-8 pt-8 pb-6 overflow-hidden"
        style={{
          background: `linear-gradient(180deg, ${current.colors.border}30 0%, transparent 100%)`
        }}
      >
        {/* Ligne décorative gauche */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 rounded-r"
          style={{ backgroundColor: current.colors.accent }}
        />

        <h1 className="text-3xl font-black text-white tracking-tight mb-1">
          Choisis ta région
        </h1>
        <p className="text-sm opacity-50 text-white max-w-lg">
          Chaque championnat a une philosophie de jeu unique.
          Ton style détermine la façon dont l'IA te coache pendant la partie.
        </p>
      </div>

      {/* Grille des cartes */}
      <div className="flex-1 px-6 pb-6">
        <div className="grid grid-cols-2 gap-4 max-w-3xl mx-auto">
          {STYLES.map((style) => (
            <StyleCard
              key={style}
              style={style}
              isSelected={selectedStyle === style}
              onSelect={setStyle}
            />
          ))}
        </div>

        {/* Style actif résumé */}
        <div
          className="mt-5 max-w-3xl mx-auto rounded-xl px-5 py-4 flex items-center gap-4"
          style={{
            background: `linear-gradient(90deg, ${current.colors.bg} 0%, ${current.colors.border}40 100%)`,
            border: `1px solid ${current.colors.border}`
          }}
        >
          <div className="text-2xl">{current.flag}</div>
          <div className="flex-1">
            <div className="text-xs uppercase tracking-widest opacity-50 mb-0.5" style={{ color: current.colors.text }}>
              Style actif
            </div>
            <div className="font-bold" style={{ color: current.colors.accent }}>
              {current.name} — {current.label}
            </div>
            <div className="text-xs opacity-60 mt-0.5" style={{ color: current.colors.text }}>
              {current.description}
            </div>
          </div>
          <div className="text-right">
            <div className="flex gap-1 justify-end">
              {current.traits.map((t) => (
                <span
                  key={t}
                  className="text-[10px] px-1.5 py-0.5 rounded font-bold opacity-80"
                  style={{ backgroundColor: `${current.colors.accent}25`, color: current.colors.accent }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
