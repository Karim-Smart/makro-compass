import { useState } from 'react'
import type { RunePageSet, FullRunePage } from '../../../shared/types'
import { RUNE_TREES, STAT_SHARDS, getRuneTree, getRuneIconUrl } from '../../../shared/rune-data'

interface RunesOverlayProps {
  pages: RunePageSet
  colors: { bg: string; text: string; accent: string; border: string }
}

type Variant = 'standard' | 'offensive' | 'defensive'

const VARIANT_LABELS: Record<Variant, string> = {
  standard: 'Standard',
  offensive: 'Offensif',
  defensive: 'Défensif',
}

export function RunesOverlay({ pages, colors }: RunesOverlayProps) {
  const [variant, setVariant] = useState<Variant>('standard')
  const page: FullRunePage = pages[variant]

  const primaryTree = getRuneTree(page.primaryTreeId)
  const subTree = getRuneTree(page.subTreeId)

  const selectedIds = new Set(page.selectedPerkIds)

  // Trouver quel keystone est sélectionné
  const keystoneId = page.selectedPerkIds[0]

  return (
    <div
      className="flex flex-col h-full p-2 gap-1"
      style={{ background: colors.bg, color: colors.text, fontSize: 10 }}
    >
      {/* Onglets */}
      <div className="flex gap-1 mb-1">
        {(['standard', 'offensive', 'defensive'] as Variant[]).map((v) => (
          <button
            key={v}
            onClick={() => setVariant(v)}
            className="flex-1 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all"
            style={{
              // @ts-expect-error: propriété CSS Electron
              WebkitAppRegion: 'no-drag',
              cursor: 'pointer',
              background: variant === v ? `${colors.accent}30` : 'transparent',
              color: variant === v ? colors.accent : `${colors.text}80`,
              border: variant === v ? `1px solid ${colors.accent}60` : '1px solid transparent',
            }}
          >
            {VARIANT_LABELS[v]}
          </button>
        ))}
      </div>

      {/* Arbre primaire */}
      {primaryTree && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1 mb-0.5">
            <img
              src={getRuneIconUrl(primaryTree.icon)}
              alt={primaryTree.name}
              className="w-4 h-4"
            />
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: colors.accent }}>
              {primaryTree.name}
            </span>
          </div>

          {/* Keystones */}
          <div className="flex justify-center gap-2 mb-1">
            {primaryTree.keystones.map((ks) => {
              const isSelected = ks.id === keystoneId
              return (
                <div key={ks.id} className="relative">
                  <img
                    src={getRuneIconUrl(ks.icon)}
                    alt={ks.name}
                    title={ks.name}
                    className="rounded-full transition-all"
                    style={{
                      width: 36,
                      height: 36,
                      opacity: isSelected ? 1 : 0.3,
                      filter: isSelected ? 'none' : 'grayscale(100%)',
                      border: isSelected ? `2px solid ${colors.accent}` : '2px solid transparent',
                      boxShadow: isSelected ? `0 0 8px ${colors.accent}60` : 'none',
                    }}
                  />
                </div>
              )
            })}
          </div>

          {/* 3 tiers primary */}
          {primaryTree.tiers.map((tier, tierIdx) => (
            <div key={tierIdx} className="flex justify-center gap-2">
              {tier.runes.map((rune) => {
                const isSelected = selectedIds.has(rune.id)
                return (
                  <img
                    key={rune.id}
                    src={getRuneIconUrl(rune.icon)}
                    alt={rune.name}
                    title={rune.name}
                    className="rounded-full transition-all"
                    style={{
                      width: 28,
                      height: 28,
                      opacity: isSelected ? 1 : 0.3,
                      filter: isSelected ? 'none' : 'grayscale(100%)',
                      border: isSelected ? `2px solid ${colors.accent}` : '2px solid transparent',
                      boxShadow: isSelected ? `0 0 6px ${colors.accent}40` : 'none',
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* Séparateur */}
      <div className="w-full h-px my-1" style={{ background: `${colors.border}40` }} />

      {/* Arbre secondaire */}
      {subTree && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1 mb-0.5">
            <img
              src={getRuneIconUrl(subTree.icon)}
              alt={subTree.name}
              className="w-3 h-3"
            />
            <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: `${colors.text}80` }}>
              {subTree.name} (secondaire)
            </span>
          </div>

          {subTree.tiers.map((tier, tierIdx) => (
            <div key={tierIdx} className="flex justify-center gap-2">
              {tier.runes.map((rune) => {
                const isSelected = selectedIds.has(rune.id)
                return (
                  <img
                    key={rune.id}
                    src={getRuneIconUrl(rune.icon)}
                    alt={rune.name}
                    title={rune.name}
                    className="rounded-full transition-all"
                    style={{
                      width: 24,
                      height: 24,
                      opacity: isSelected ? 1 : 0.3,
                      filter: isSelected ? 'none' : 'grayscale(100%)',
                      border: isSelected ? `2px solid ${colors.accent}` : '2px solid transparent',
                      boxShadow: isSelected ? `0 0 6px ${colors.accent}40` : 'none',
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* Séparateur */}
      <div className="w-full h-px my-1" style={{ background: `${colors.border}40` }} />

      {/* Stat Shards */}
      <div className="flex flex-col gap-1">
        {STAT_SHARDS.map((line, lineIdx) => (
          <div key={lineIdx} className="flex justify-center gap-2">
            {line.map((shard) => {
              const isSelected = selectedIds.has(shard.id)
              return (
                <img
                  key={`${lineIdx}-${shard.id}`}
                  src={getRuneIconUrl(shard.icon)}
                  alt={shard.name}
                  title={shard.name}
                  className="rounded-full transition-all"
                  style={{
                    width: 20,
                    height: 20,
                    opacity: isSelected ? 1 : 0.3,
                    filter: isSelected ? 'none' : 'grayscale(100%)',
                    border: isSelected ? `1px solid ${colors.accent}` : '1px solid transparent',
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>

      {/* Bouton import */}
      <button
        onClick={() => window.overlayAPI.importRunes(variant)}
        className="mt-auto py-1.5 rounded font-bold text-[10px] uppercase tracking-wider transition-all"
        style={{
          // @ts-expect-error: propriété CSS Electron
          WebkitAppRegion: 'no-drag',
          cursor: 'pointer',
          background: `${colors.accent}25`,
          color: colors.accent,
          border: `1px solid ${colors.accent}60`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = `${colors.accent}40`
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = `${colors.accent}25`
        }}
      >
        IMPORTER (F6)
      </button>
    </div>
  )
}
