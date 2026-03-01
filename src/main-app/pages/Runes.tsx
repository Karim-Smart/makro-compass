import { useState, useMemo } from 'react'
import { useCoachingStore } from '../stores/coachingStore'
import { COACHING_STYLES } from '../../../shared/constants'
import { CHAMPIONS } from '../../../shared/champion-data'
import { ROLE_POOL } from '../../../shared/draft-data'
import { getChampionLoadingUrl } from '../../../shared/champion-images'
import { RUNE_TREES, STAT_SHARDS, getRuneTree, getRuneIconUrl, generateRunePages } from '../../../shared/rune-data'
import type { RunePageSet, FullRunePage, PlayerRole } from '../../../shared/types'

type Variant = 'standard' | 'offensive' | 'defensive'

const VARIANT_LABELS: Record<Variant, { label: string; desc: string }> = {
  standard:  { label: 'Standard',  desc: 'Page équilibrée pour la plupart des matchups' },
  offensive: { label: 'Offensif',  desc: 'Maximise les dégâts et le snowball' },
  defensive: { label: 'Défensif',  desc: 'Priorité survie et scaling safe' },
}

const ROLES: { key: PlayerRole; label: string }[] = [
  { key: 'TOP', label: 'Top' },
  { key: 'JUNGLE', label: 'Jungle' },
  { key: 'MID', label: 'Mid' },
  { key: 'ADC', label: 'ADC' },
  { key: 'SUPPORT', label: 'Support' },
]

export default function Runes() {
  const { selectedStyle } = useCoachingStore()
  const c = COACHING_STYLES[selectedStyle].colors

  const [role, setRole] = useState<PlayerRole>('MID')
  const [champion, setChampion] = useState('')
  const [search, setSearch] = useState('')
  const [variant, setVariant] = useState<Variant>('standard')
  const [showDropdown, setShowDropdown] = useState(false)

  const pool = ROLE_POOL[role]
  const suggestions = search.length > 0
    ? pool.filter(ch => ch.toLowerCase().includes(search.toLowerCase())).slice(0, 8)
    : pool.slice(0, 8)

  const runePages: RunePageSet | null = useMemo(() => {
    if (!champion) return null
    return generateRunePages(champion, selectedStyle)
  }, [champion, selectedStyle])

  const page: FullRunePage | null = runePages ? runePages[variant] : null
  const primaryTree = page ? getRuneTree(page.primaryTreeId) : null
  const subTree = page ? getRuneTree(page.subTreeId) : null
  const selectedIds = new Set(page?.selectedPerkIds ?? [])
  const keystoneId = page?.selectedPerkIds[0] ?? 0

  const selectChampion = (name: string) => {
    setChampion(name)
    setSearch(name)
    setShowDropdown(false)
  }

  const handleImport = () => {
    if (!page) return
    if (window.electronAPI) {
      window.electronAPI.send('import:runes', variant)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-5 h-full overflow-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">Runes</h1>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded"
          style={{ backgroundColor: `${c.accent}20`, color: c.accent }}>
          {selectedStyle}
        </span>
      </div>

      {/* Role selector */}
      <div className="flex gap-2">
        {ROLES.map(r => (
          <button key={r.key} onClick={() => { setRole(r.key); setChampion(''); setSearch('') }}
            className="flex-1 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
            style={{
              backgroundColor: role === r.key ? `${c.accent}20` : '#ffffff08',
              border: `1px solid ${role === r.key ? c.accent : '#ffffff15'}`,
              color: role === r.key ? c.accent : '#9ca3af',
            }}>
            {r.label}
          </button>
        ))}
      </div>

      {/* Champion search */}
      <div className="relative">
        <input
          type="text" value={search} placeholder="Chercher un champion..."
          onChange={e => { setSearch(e.target.value); setShowDropdown(true); if (!e.target.value) setChampion('') }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          className="w-full text-sm px-4 py-2.5 rounded-xl bg-white/5 border text-white placeholder-gray-600 outline-none transition-colors"
          style={{ borderColor: champion ? `${c.accent}60` : '#ffffff15' }}
        />
        {showDropdown && suggestions.length > 0 && (
          <div className="absolute z-50 top-full mt-1 w-full bg-gray-900 border border-white/10 rounded-xl shadow-xl max-h-64 overflow-auto">
            {suggestions.map(ch => {
              const info = CHAMPIONS[ch]
              return (
                <button key={ch} onMouseDown={() => selectChampion(ch)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-violet-500/20 transition-colors flex items-center gap-2">
                  <img src={getChampionLoadingUrl(ch)} alt={ch}
                    className="w-6 h-6 rounded-full object-cover object-top flex-shrink-0"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  <span className="text-white font-medium">{ch}</span>
                  {info && <span className="text-[9px] text-gray-500 ml-auto">{info.class}</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Rune display */}
      {champion && page && primaryTree && subTree ? (
        <div className="flex gap-4">

          {/* Left: Champion info + variant tabs */}
          <div className="flex flex-col gap-3 w-48 flex-shrink-0">
            {/* Champion card */}
            <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${c.border}` }}>
              <img src={getChampionLoadingUrl(champion)} alt={champion}
                className="w-full h-32 object-cover object-top"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              <div className="p-3" style={{ backgroundColor: `${c.bg}` }}>
                <div className="text-sm font-bold text-white">{champion}</div>
                <div className="text-[10px] mt-1" style={{ color: `${c.text}80` }}>{page.name}</div>
              </div>
            </div>

            {/* Variant tabs */}
            <div className="flex flex-col gap-1.5">
              {(['standard', 'offensive', 'defensive'] as Variant[]).map(v => (
                <button key={v} onClick={() => setVariant(v)}
                  className="text-left px-3 py-2 rounded-lg transition-all"
                  style={{
                    backgroundColor: variant === v ? `${c.accent}15` : '#ffffff06',
                    border: `1px solid ${variant === v ? `${c.accent}50` : '#ffffff10'}`,
                    color: variant === v ? c.accent : '#9ca3af',
                  }}>
                  <div className="text-xs font-bold">{VARIANT_LABELS[v].label}</div>
                  <div className="text-[9px] mt-0.5 opacity-60">{VARIANT_LABELS[v].desc}</div>
                </button>
              ))}
            </div>

            {/* Import button */}
            <button onClick={handleImport}
              className="py-2.5 rounded-xl font-bold text-sm uppercase tracking-wider transition-all"
              style={{
                background: `${c.accent}20`, color: c.accent,
                border: `1px solid ${c.accent}50`,
              }}>
              Importer (F6)
            </button>
          </div>

          {/* Right: Rune tree */}
          <div className="flex-1 rounded-xl p-4" style={{ backgroundColor: '#ffffff06', border: `1px solid ${c.border}` }}>

            {/* Primary tree */}
            <div className="flex items-center gap-2 mb-3">
              <img src={getRuneIconUrl(primaryTree.icon)} alt={primaryTree.name} className="w-5 h-5" />
              <span className="text-sm font-bold" style={{ color: c.accent }}>{primaryTree.name}</span>
            </div>

            {/* Keystones */}
            <div className="flex justify-center gap-3 mb-4">
              {primaryTree.keystones.map(ks => {
                const isSel = ks.id === keystoneId
                return (
                  <div key={ks.id} className="flex flex-col items-center gap-1">
                    <img src={getRuneIconUrl(ks.icon)} alt={ks.name} title={ks.name}
                      className="rounded-full transition-all"
                      style={{
                        width: 48, height: 48,
                        opacity: isSel ? 1 : 0.25, filter: isSel ? 'none' : 'grayscale(100%)',
                        border: isSel ? `3px solid ${c.accent}` : '3px solid transparent',
                        boxShadow: isSel ? `0 0 12px ${c.accent}50` : 'none',
                      }} />
                    <span className="text-[8px] text-center max-w-[56px] leading-tight"
                      style={{ color: isSel ? c.accent : '#ffffff30' }}>
                      {ks.name}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* 3 primary tiers */}
            {primaryTree.tiers.map((tier, ti) => (
              <div key={ti} className="flex justify-center gap-4 mb-2">
                {tier.runes.map(rune => {
                  const isSel = selectedIds.has(rune.id)
                  return (
                    <div key={rune.id} className="flex flex-col items-center gap-0.5">
                      <img src={getRuneIconUrl(rune.icon)} alt={rune.name} title={rune.name}
                        className="rounded-full transition-all"
                        style={{
                          width: 36, height: 36,
                          opacity: isSel ? 1 : 0.25, filter: isSel ? 'none' : 'grayscale(100%)',
                          border: isSel ? `2px solid ${c.accent}` : '2px solid transparent',
                          boxShadow: isSel ? `0 0 8px ${c.accent}40` : 'none',
                        }} />
                      <span className="text-[7px] text-center max-w-[48px] leading-tight"
                        style={{ color: isSel ? '#ffffffcc' : '#ffffff20' }}>
                        {rune.name}
                      </span>
                    </div>
                  )
                })}
              </div>
            ))}

            {/* Separator */}
            <div className="w-full h-px my-3" style={{ background: `${c.border}60` }} />

            {/* Secondary tree */}
            <div className="flex items-center gap-2 mb-2">
              <img src={getRuneIconUrl(subTree.icon)} alt={subTree.name} className="w-4 h-4" />
              <span className="text-xs font-bold" style={{ color: `${c.text}80` }}>
                {subTree.name} (secondaire)
              </span>
            </div>

            {subTree.tiers.map((tier, ti) => (
              <div key={ti} className="flex justify-center gap-4 mb-2">
                {tier.runes.map(rune => {
                  const isSel = selectedIds.has(rune.id)
                  return (
                    <div key={rune.id} className="flex flex-col items-center gap-0.5">
                      <img src={getRuneIconUrl(rune.icon)} alt={rune.name} title={rune.name}
                        className="rounded-full transition-all"
                        style={{
                          width: 32, height: 32,
                          opacity: isSel ? 1 : 0.25, filter: isSel ? 'none' : 'grayscale(100%)',
                          border: isSel ? `2px solid ${c.accent}` : '2px solid transparent',
                          boxShadow: isSel ? `0 0 6px ${c.accent}40` : 'none',
                        }} />
                      <span className="text-[7px] text-center max-w-[44px] leading-tight"
                        style={{ color: isSel ? '#ffffffcc' : '#ffffff20' }}>
                        {rune.name}
                      </span>
                    </div>
                  )
                })}
              </div>
            ))}

            {/* Separator */}
            <div className="w-full h-px my-3" style={{ background: `${c.border}60` }} />

            {/* Stat shards */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold" style={{ color: `${c.text}60` }}>Stat Shards</span>
            </div>
            {STAT_SHARDS.map((line, li) => (
              <div key={li} className="flex justify-center gap-4 mb-1.5">
                {line.map(shard => {
                  const isSel = selectedIds.has(shard.id)
                  return (
                    <div key={`${li}-${shard.id}`} className="flex flex-col items-center gap-0.5">
                      <img src={getRuneIconUrl(shard.icon)} alt={shard.name} title={shard.name}
                        className="rounded-full transition-all"
                        style={{
                          width: 24, height: 24,
                          opacity: isSel ? 1 : 0.25, filter: isSel ? 'none' : 'grayscale(100%)',
                          border: isSel ? `1px solid ${c.accent}` : '1px solid transparent',
                        }} />
                      <span className="text-[7px]" style={{ color: isSel ? '#ffffffcc' : '#ffffff20' }}>
                        {shard.name}
                      </span>
                    </div>
                  )
                })}
              </div>
            ))}

          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <span className="text-3xl">🔮</span>
          <span className="text-sm text-gray-500 text-center">
            Sélectionne un champion pour voir ses runes
          </span>
          <span className="text-xs text-gray-600">
            Les runes s'adaptent automatiquement au style {selectedStyle}
          </span>
        </div>
      )}
    </div>
  )
}
