import { useState, useMemo } from 'react'
import { useCoachingStore } from '../stores/coachingStore'
import { useGameStore } from '../stores/gameStore'
import { COACHING_STYLES } from '../../../shared/constants'
import { CHAMPIONS, getChampion, analyzeEnemyComp } from '../../../shared/champion-data'
import type { ChampionClass } from '../../../shared/champion-data'
import { ROLE_POOL } from '../../../shared/draft-data'
import { getChampionLoadingUrl, getItemIconUrl } from '../../../shared/champion-images'
import { CLASS_BUILDS, STYLE_BUILD_TIPS } from '../../../shared/build-data'
import type { PlayerRole, RecommendedItem, EnemyDamageProfile } from '../../../shared/types'

const ROLES: { key: PlayerRole; label: string }[] = [
  { key: 'TOP', label: 'Top' },
  { key: 'JUNGLE', label: 'Jungle' },
  { key: 'MID', label: 'Mid' },
  { key: 'ADC', label: 'ADC' },
  { key: 'SUPPORT', label: 'Support' },
]

function analyzeProfile(enemies: string[]): EnemyDamageProfile {
  let apCount = 0, adCount = 0, tankCount = 0, healCount = 0, assassinCount = 0
  const apC: ChampionClass[] = ['mage', 'enchanter']
  const adC: ChampionClass[] = ['marksman', 'assassin', 'skirmisher']
  const tankC: ChampionClass[] = ['tank', 'engage']
  for (const e of enemies) {
    const info = getChampion(e)
    if (!info) continue
    if (apC.includes(info.class)) apCount++
    if (adC.includes(info.class)) adCount++
    if (tankC.includes(info.class)) tankCount++
    if (info.class === 'enchanter') healCount++
    if (info.class === 'assassin') assassinCount++
  }
  let dominantType: EnemyDamageProfile['dominantType'] = 'mixed'
  if (apCount >= 3) dominantType = 'ap'
  else if (adCount >= 3) dominantType = 'ad'
  else if (tankCount >= 3) dominantType = 'tank'
  return { apCount, adCount, tankCount, healCount, assassinCount, dominantType }
}

export default function Build() {
  const { selectedStyle } = useCoachingStore()
  const { isInGame, gameData } = useGameStore()
  const c = COACHING_STYLES[selectedStyle].colors

  const [role, setRole] = useState<PlayerRole>('MID')
  const [champion, setChampion] = useState('')
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [enemies, setEnemies] = useState<string[]>(['', '', '', '', ''])
  const [enemySearch, setEnemySearch] = useState<string[]>(['', '', '', '', ''])
  const [activeEnemyIdx, setActiveEnemyIdx] = useState(-1)

  const pool = ROLE_POOL[role]
  const suggestions = search.length > 0
    ? pool.filter(ch => ch.toLowerCase().includes(search.toLowerCase())).slice(0, 8)
    : []

  // Si en game, utiliser les données live
  const activeChampion = isInGame && gameData ? gameData.champion : champion
  const activeEnemies = isInGame && gameData ? gameData.enemies : enemies.filter(Boolean)

  const champInfo = activeChampion ? getChampion(activeChampion) : null
  const champClass: ChampionClass = champInfo?.class ?? 'bruiser'
  const classBuild = CLASS_BUILDS[champClass]

  const profile = useMemo(() => analyzeProfile(activeEnemies), [activeEnemies])
  const compTips = useMemo(() => analyzeEnemyComp(activeEnemies), [activeEnemies])

  // Build items
  const coreItems: RecommendedItem[] = classBuild.coreItems.map(i => ({
    name: i.name, itemId: i.itemId, reason: 'Item core', situational: false,
  }))
  const boots: RecommendedItem = {
    name: classBuild.boots.name, itemId: classBuild.boots.itemId, reason: 'Boots', situational: false,
  }

  // Situational
  const sitItems: RecommendedItem[] = []
  if (profile.healCount >= 2) {
    const i = classBuild.situationalHeal[0]
    sitItems.push({ name: i.name, itemId: i.itemId, reason: 'Anti-heal (compo heal)', situational: true })
  }
  if (profile.dominantType === 'ap') {
    const i = classBuild.situationalAP[0]
    sitItems.push({ name: i.name, itemId: i.itemId, reason: 'Résistance AP', situational: true })
  } else if (profile.dominantType === 'ad') {
    const i = classBuild.situationalAD[0]
    sitItems.push({ name: i.name, itemId: i.itemId, reason: 'Résistance AD', situational: true })
  } else if (profile.dominantType === 'tank') {
    const i = classBuild.situationalTank[0]
    sitItems.push({ name: i.name, itemId: i.itemId, reason: 'Anti-tank', situational: true })
  }
  if (sitItems.length === 0) {
    const i = profile.apCount > profile.adCount ? classBuild.situationalAP[0] : classBuild.situationalAD[0]
    sitItems.push({ name: i.name, itemId: i.itemId, reason: 'Adaptif', situational: true })
  }

  const selectChampion = (name: string) => {
    setChampion(name); setSearch(name); setShowDropdown(false)
  }

  const setEnemy = (idx: number, name: string) => {
    setEnemies(prev => { const next = [...prev]; next[idx] = name; return next })
    setEnemySearch(prev => { const next = [...prev]; next[idx] = name; return next })
    setActiveEnemyIdx(-1)
  }

  const allItems = [...coreItems, ...sitItems, boots]

  const dominantLabels: Record<string, string> = {
    ap: 'AP dominante', ad: 'AD dominante', tank: 'Tanky', mixed: 'Mixte',
  }
  const dominantColors: Record<string, string> = {
    ap: '#a78bfa', ad: '#f87171', tank: '#60a5fa', mixed: '#fbbf24',
  }

  return (
    <div className="flex flex-col gap-4 p-5 h-full overflow-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.25em] mb-0.5" style={{ color: '#C89B3C', opacity: 0.5 }}>
            Équipement
          </div>
          <h1 className="text-lg font-bold" style={{ color: '#F0E6D2', fontFamily: 'Cinzel, serif' }}>Build</h1>
        </div>
        <div className="flex items-center gap-2">
          {isInGame && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 clip-bevel-sm"
              style={{ backgroundColor: '#22c55e20', color: '#22c55e' }}>
              Live
            </span>
          )}
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 clip-bevel-sm"
            style={{ backgroundColor: `${c.accent}20`, color: c.accent }}>
            {selectedStyle}
          </span>
        </div>
      </div>

      {/* Live banner */}
      {isInGame && gameData && (
        <div className="clip-bevel px-4 py-3 flex items-center gap-3"
          style={{ backgroundColor: '#22c55e08', border: '1px solid #22c55e30' }}>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#22c55e' }} />
          <span className="text-xs text-gray-300">
            En partie avec <strong className="text-white">{gameData.champion}</strong> — build adapté en temps réel
          </span>
        </div>
      )}

      {/* Manual mode: role + champion + enemies */}
      {!isInGame && (
        <>
          <div className="flex gap-2">
            {ROLES.map(r => (
              <button key={r.key} onClick={() => { setRole(r.key); setChampion(''); setSearch('') }}
                className="flex-1 py-1.5 clip-bevel-sm text-xs font-bold uppercase tracking-wider transition-all"
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
            <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1 block">Ton champion</label>
            <input type="text" value={search} placeholder="Chercher..."
              onChange={e => { setSearch(e.target.value); setShowDropdown(true); if (!e.target.value) setChampion('') }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              className="w-full text-sm px-3 py-2 clip-bevel bg-white/5 border text-white placeholder-gray-600 outline-none"
              style={{ borderColor: champion ? `${c.accent}60` : '#ffffff15' }} />
            {showDropdown && suggestions.length > 0 && (
              <div className="absolute z-50 top-full mt-1 w-full clip-bevel-lg border border-white/10 shadow-xl max-h-48 overflow-auto" style={{ backgroundColor: '#0A1628' }}>
                {suggestions.map(ch => (
                  <button key={ch} onMouseDown={() => selectChampion(ch)}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-amber-700/20 transition-colors flex items-center gap-2">
                    <img src={getChampionLoadingUrl(ch)} alt={ch}
                      className="w-5 h-5 rounded-full object-cover object-top"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    <span className="text-white font-medium">{ch}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Enemy inputs */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold mb-1 block" style={{ color: '#ef444490' }}>
              Ennemis (optionnel)
            </label>
            <div className="flex gap-2">
              {enemies.map((enemy, idx) => (
                <div key={idx} className="relative flex-1">
                  <input type="text" value={enemySearch[idx]} placeholder={`E${idx + 1}`}
                    onChange={e => {
                      const val = e.target.value
                      setEnemySearch(prev => { const n = [...prev]; n[idx] = val; return n })
                      setActiveEnemyIdx(idx)
                      if (!val) setEnemy(idx, '')
                    }}
                    onFocus={() => setActiveEnemyIdx(idx)}
                    onBlur={() => setTimeout(() => setActiveEnemyIdx(-1), 200)}
                    className="w-full text-xs px-2 py-1.5 clip-bevel-sm bg-white/5 border text-white placeholder-gray-600 outline-none text-center"
                    style={{ borderColor: enemy ? '#ef444460' : '#ffffff15' }} />
                  {activeEnemyIdx === idx && enemySearch[idx].length > 0 && (
                    <div className="absolute z-50 top-full mt-1 w-32 clip-bevel border border-white/10 shadow-xl max-h-32 overflow-auto" style={{ backgroundColor: '#0A1628' }}>
                      {Object.keys(CHAMPIONS).filter(ch =>
                        ch.toLowerCase().includes(enemySearch[idx].toLowerCase())
                      ).slice(0, 5).map(ch => (
                        <button key={ch} onMouseDown={() => setEnemy(idx, ch)}
                          className="w-full text-left px-2 py-1 text-[10px] hover:bg-red-500/20 text-white">
                          {ch}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Build display */}
      {activeChampion ? (
        <div className="grid grid-cols-3 gap-4">

          {/* Core items */}
          <div className="col-span-2 clip-bevel-lg p-4" style={{ backgroundColor: '#ffffff06', border: `1px solid ${c.border}` }}>
            <div className="text-[10px] font-black uppercase tracking-wider mb-3" style={{ color: `${c.text}40` }}>
              Build recommandé — {champClass}
            </div>

            <div className="flex flex-wrap gap-3">
              {allItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 clip-bevel-sm"
                  style={{
                    backgroundColor: item.situational ? '#ffffff05' : `${c.accent}08`,
                    border: `1px solid ${item.situational ? '#ffffff15' : `${c.accent}30`}`,
                  }}>
                  <img src={getItemIconUrl(item.itemId)} alt={item.name}
                    className="w-10 h-10 rounded"
                    style={{ border: `2px solid ${item.situational ? '#ffffff20' : `${c.accent}50`}` }}
                    onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3' }} />
                  <div>
                    <div className="text-xs font-bold text-white">{item.name}</div>
                    <div className="text-[9px]" style={{ color: item.situational ? '#f59e0b' : `${c.text}60` }}>
                      {item.reason}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Style tip */}
            <div className="mt-4 px-3 py-2 clip-bevel-sm text-xs italic"
              style={{ backgroundColor: `${c.accent}08`, border: `1px solid ${c.accent}20`, color: `${c.text}80` }}>
              {STYLE_BUILD_TIPS[selectedStyle]}
            </div>
          </div>

          {/* Enemy profile */}
          <div className="clip-bevel-lg p-4" style={{ backgroundColor: '#ffffff06', border: `1px solid ${c.border}` }}>
            <div className="text-[10px] font-black uppercase tracking-wider mb-3" style={{ color: `${c.text}40` }}>
              Profil ennemi
            </div>

            {activeEnemies.length > 0 ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-1 rounded"
                    style={{
                      backgroundColor: `${dominantColors[profile.dominantType]}15`,
                      color: dominantColors[profile.dominantType],
                      border: `1px solid ${dominantColors[profile.dominantType]}30`,
                    }}>
                    {dominantLabels[profile.dominantType]}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 mt-1">
                  <StatPill label="AP" value={profile.apCount} color="#a78bfa" />
                  <StatPill label="AD" value={profile.adCount} color="#f87171" />
                  <StatPill label="Tank" value={profile.tankCount} color="#60a5fa" />
                  <StatPill label="Heal" value={profile.healCount} color="#34d399" />
                  <StatPill label="Assassin" value={profile.assassinCount} color="#fb923c" />
                </div>

                {/* Comp tips */}
                {compTips.length > 0 && (
                  <div className="flex flex-col gap-1 mt-2">
                    {compTips.map((tip, i) => (
                      <div key={i} className="text-[10px] px-2 py-1.5 rounded"
                        style={{ backgroundColor: '#f59e0b08', border: '1px solid #f59e0b20', color: '#fcd34d' }}>
                        {tip}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-600 italic">
                Ajoute les ennemis pour adapter le build
              </p>
            )}
          </div>

        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <span className="text-3xl">🛠️</span>
          <span className="text-sm text-gray-500 text-center">
            Sélectionne un champion pour voir son build recommandé
          </span>
          <span className="text-xs text-gray-600">
            {isInGame ? 'En attente de données de la partie...' : 'Ou lance une partie pour le build live'}
          </span>
        </div>
      )}
    </div>
  )
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between px-2 py-1 rounded text-[10px]"
      style={{ backgroundColor: `${color}10`, border: `1px solid ${color}20` }}>
      <span style={{ color: `${color}cc` }}>{label}</span>
      <span className="font-bold" style={{ color }}>{value}</span>
    </div>
  )
}
