import type { ChampionBuild, RecommendedItem } from '../../../shared/types'
import { getItemIconUrl } from '../../../shared/champion-images'

interface BuildStripProps {
  build: ChampionBuild
  colors: { bg: string; text: string; accent: string; border: string }
}

function ItemIcon({ item, colors, size = 48, index }: { item: RecommendedItem; colors: BuildStripProps['colors']; size?: number; index: number }) {
  const isCore = !item.situational
  return (
    <div
      className="relative group clip-bevel-sm"
      title={`${item.name}\n${item.reason}`}
      style={{
        animation: `fade-in 0.3s ease-out ${index * 0.06}s both`,
      }}
    >
      {/* Bordure dorée pour les items core */}
      {isCore && (
        <div
          className="absolute inset-0 clip-bevel-sm pointer-events-none"
          style={{ boxShadow: `inset 0 0 0 2px #C89B3C60, 0 0 6px #C89B3C20` }}
        />
      )}
      <img
        src={getItemIconUrl(item.itemId)}
        alt={item.name}
        className="clip-bevel-sm"
        style={{
          width: size,
          height: size,
          border: isCore
            ? `2px solid #C89B3C60`
            : `1px solid ${colors.text}25`,
        }}
        onError={(e) => {
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
      style={{ background: 'none' }}
    >
      {allItems.map((item, idx) => (
        <ItemIcon key={idx} item={item} colors={colors} size={48} index={idx} />
      ))}

      {/* Bouton refresh */}
      <button
        onClick={() => window.overlayAPI.refreshBuild()}
        className="mt-auto flex items-center justify-center clip-bevel-sm transition-all"
        title="Recalculer le build"
        style={{
          // @ts-expect-error: propriété CSS Electron
          WebkitAppRegion: 'no-drag',
          cursor: 'pointer',
          width: 48,
          height: 28,
          background: '#C89B3C18',
          color: '#C89B3C',
          border: '1px solid #C89B3C35',
          fontSize: 14,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#C89B3C35'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#C89B3C18'
        }}
      >
        &#x1f504;
      </button>
    </div>
  )
}
