import type { CoachingStyle } from '../../../shared/types'
import { COACHING_STYLES } from '../../../shared/constants'
import lckLogo from '../../assets/leagues/lck.svg'
import lecLogo from '../../assets/leagues/lec.svg'
import lcsLogo from '../../assets/leagues/lcs.svg'
import lplLogo from '../../assets/leagues/lpl.svg'

const LOGOS: Record<CoachingStyle, string> = {
  LCK: lckLogo,
  LEC: lecLogo,
  LCS: lcsLogo,
  LPL: lplLogo
}

interface StyleCardProps {
  style: CoachingStyle
  isSelected: boolean
  onSelect: (style: CoachingStyle) => void
}

export function StyleCard({ style, isSelected, onSelect }: StyleCardProps) {
  const config = COACHING_STYLES[style]
  const { colors } = config
  const logo = LOGOS[style]

  return (
    <button
      onClick={() => onSelect(style)}
      className="relative w-full text-left clip-bevel-lg overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] group"
      style={{
        background: `linear-gradient(135deg, ${colors.bg} 0%, ${colors.border}60 100%)`,
        border: `2px solid ${isSelected ? colors.accent : colors.border}`,
        boxShadow: isSelected
          ? `0 0 30px ${colors.glow}50, 0 0 60px ${colors.glow}20, inset 0 0 30px ${colors.glow}08`
          : `0 4px 20px #00000040`,
      }}
    >
      {/* Ligne de brillance en haut */}
      <div
        className="absolute top-0 left-0 right-0 h-px opacity-50"
        style={{ background: `linear-gradient(90deg, transparent, ${colors.accent}, transparent)` }}
      />

      {/* Badge ACTIF */}
      {isSelected && (
        <div
          className="absolute top-3 right-3 z-10 flex items-center gap-1 px-2.5 py-1 clip-bevel-sm text-xs font-black tracking-widest"
          style={{ backgroundColor: colors.accent, color: colors.bg }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          ACTIF
        </div>
      )}

      <div className="flex gap-4 p-5">
        {/* Logo de la ligue */}
        <div className="flex-shrink-0 flex items-center justify-center">
          <div
            className="w-20 h-20 clip-bevel flex items-center justify-center transition-all duration-300 group-hover:scale-110"
            style={{
              background: `radial-gradient(circle, ${colors.border}80 0%, transparent 70%)`,
              filter: isSelected ? `drop-shadow(0 0 12px ${colors.glow}80)` : 'none'
            }}
          >
            <img src={logo} alt={style} className="w-16 h-16 object-contain" />
          </div>
        </div>

        {/* Infos */}
        <div className="flex-1 min-w-0">
          {/* Région + flag */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">{config.flag}</span>
            <span className="text-xs opacity-60" style={{ color: colors.text }}>
              {config.region}
            </span>
          </div>

          {/* Nom court */}
          <div
            className="text-3xl font-black tracking-tight leading-none mb-0.5"
            style={{ color: colors.accent }}
          >
            {config.name}
          </div>

          {/* Nom complet */}
          <div className="text-xs font-medium opacity-70 mb-3 truncate" style={{ color: colors.text }}>
            {config.label}
          </div>

          {/* Traits */}
          <div className="flex flex-wrap gap-1.5">
            {config.traits.map((trait) => (
              <span
                key={trait}
                className="text-[10px] font-bold px-2 py-0.5 clip-bevel-sm uppercase tracking-wider"
                style={{
                  backgroundColor: `${colors.accent}18`,
                  border: `1px solid ${colors.accent}40`,
                  color: colors.accent
                }}
              >
                {trait}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Séparateur */}
      <div
        className="mx-5 h-px opacity-20"
        style={{ backgroundColor: colors.accent }}
      />

      {/* Preview conseil */}
      <div className="px-5 py-3">
        <div className="text-[10px] uppercase tracking-widest opacity-40 mb-1" style={{ color: colors.text }}>
          Aperçu overlay
        </div>
        <div
          className="text-xs italic leading-relaxed opacity-80"
          style={{ color: colors.text }}
        >
          "{config.previewAdvice}"
        </div>
      </div>

      {/* Effet hover bas */}
      <div
        className="absolute bottom-0 left-0 right-0 h-16 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: `linear-gradient(0deg, ${colors.glow}15 0%, transparent 100%)`
        }}
      />
    </button>
  )
}
