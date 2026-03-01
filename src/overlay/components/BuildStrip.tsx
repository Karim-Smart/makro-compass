import type { ChampionBuild, RecommendedItem } from '../../../shared/types'
import { getItemIconUrl } from '../../../shared/champion-images'

interface BuildStripProps {
  build: ChampionBuild
  colors: { bg: string; text: string; accent: string; border: string }
}

function ItemIcon({ item, colors, size = 48 }: { item: RecommendedItem; colors: BuildStripProps['colors']; size?: number }) {
  return (
    <div
      className="relative group"
      title={`${item.name}\n${item.reason}`}
    >
      <img
        src={getItemIconUrl(item.itemId)}
        alt={item.name}
        className="clip-bevel-sm"
        style={{
          width: size,
          height: size,
          border: item.situational
            ? `1px solid ${colors.text}30`
            : `2px solid ${colors.accent}60`,
          boxShadow: item.situational ? 'none' : `0 0 4px ${colors.accent}30`,
        }}
        onError={(e) => {
          // Fallback si l'image ne charge pas
          e.currentTarget.style.opacity = '0.3'
        }}
      />
    </div>
  )
}

export function BuildStrip({ build, colors }: BuildStripProps) {
  // Construire la liste des 6 items : 3 core + 2 situationnels + boots
  const allItems: RecommendedItem[] = [
    ...build.coreItems.slice(0, 3),
    ...build.situationalItems.slice(0, 2),
    build.boots,
  ]

  return (
    <div
      className="flex flex-col items-center gap-1 p-1 h-full"
      style={{ background: 'transparent' }}
    >
      {allItems.map((item, idx) => (
        <ItemIcon key={idx} item={item} colors={colors} size={48} />
      ))}

      {/* Bouton refresh */}
      <button
        onClick={() => window.overlayAPI.refreshBuild()}
        className="mt-auto flex items-center justify-center rounded transition-all"
        title="Recalculer le build"
        style={{
          // @ts-expect-error: propriété CSS Electron
          WebkitAppRegion: 'no-drag',
          cursor: 'pointer',
          width: 48,
          height: 32,
          background: `${colors.accent}20`,
          color: colors.accent,
          border: `1px solid ${colors.accent}40`,
          fontSize: 16,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = `${colors.accent}40`
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = `${colors.accent}20`
        }}
      >
        &#x1f504;
      </button>
    </div>
  )
}
