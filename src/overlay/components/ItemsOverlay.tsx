import type { GameData } from '../../../shared/types'

interface Props {
  gameData: GameData
  colors: { bg: string; text: string; accent: string; border: string }
}

export function ItemsOverlay({ gameData, colors }: Props) {
  const { items } = gameData

  if (items.length === 0) return null

  // Raccourcir les noms longs pour rester compact
  const shortName = (name: string) => {
    if (name.length <= 14) return name
    // Garder le premier mot significatif
    return name.split(' ').slice(0, 2).join(' ')
  }

  return (
    <div
      className="rounded-xl overflow-hidden animate-fade-in"
      style={{
        background: 'rgba(8, 10, 18, 0.85)',
        border: `1px solid ${colors.border}`,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}
    >
      {/* Header */}
      <div
        className="px-3 pt-2 pb-1 text-[8px] font-black uppercase tracking-[0.2em]"
        style={{ color: colors.accent, opacity: 0.5, borderBottom: `1px solid ${colors.border}40` }}
      >
        Items ({items.length})
      </div>

      <div className="px-3 py-1.5 flex flex-wrap gap-1">
        {items.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="text-[8px] font-medium px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: `${colors.accent}15`,
              color: `${colors.text}CC`,
              border: `1px solid ${colors.border}40`,
            }}
          >
            {shortName(item)}
          </span>
        ))}
      </div>
    </div>
  )
}
