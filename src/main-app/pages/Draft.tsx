import { useState, useRef, useEffect } from 'react'
import { useDraftStore } from '../stores/draftStore'
import { ROLE_POOL, CHAMPION_RUNES, CHAMPION_COUNTERS, CHAMPION_SYNERGIES, getSynergyScore, deduceEnemyRoles, generateMatchupAnalysis, generateLockReaction } from '../../../shared/draft-data'
import type { MatchupAnalysis } from '../../../shared/draft-data'
import { CHAMPIONS, getChampion } from '../../../shared/champion-data'
import { getChampionLoadingUrl } from '../../../shared/champion-images'
import type { PlayerRole, ChampionRecommendation } from '../../../shared/types'

const ROLES: { key: PlayerRole; label: string; icon: string }[] = [
  { key: 'TOP',     label: 'Top',     icon: '⚔️' },
  { key: 'JUNGLE',  label: 'Jungle',  icon: '🌿' },
  { key: 'MID',     label: 'Mid',     icon: '🔮' },
  { key: 'ADC',     label: 'ADC',     icon: '🏹' },
  { key: 'SUPPORT', label: 'Support', icon: '🛡️' },
]

// ─── Helpers drag ────────────────────────────────────────────────────────────

function startDrag(e: React.DragEvent, champion: string) {
  e.dataTransfer.setData('text/plain', champion)
  e.dataTransfer.effectAllowed = 'copy'
}

// ─── Page principale ─────────────────────────────────────────────────────────

export default function Draft() {
  const {
    role, setRole, allyPicks, setAllyPick, enemyPicks, setEnemyPick, clearAll,
    recommendations, compTips, lcuConnected,
  } = useDraftStore()

  const [inspected, setInspected] = useState<string | null>(null)
  const [matchup, setMatchup] = useState<MatchupAnalysis | null>(null)

  // Mon rôle et si j'ai déjà pick
  const myRoleIdx = ROLES.findIndex((r) => r.key === role)
  const myChamp = allyPicks[myRoleIdx] ?? ''
  const hasPicked = !!myChamp

  // Réaction au dernier lock ennemi (texte persistant)
  const [lockReaction, setLockReaction] = useState<{ champion: string; text: string } | null>(null)
  const prevEnemyRef = useRef<string[]>([...enemyPicks])

  useEffect(() => {
    const prev = prevEnemyRef.current
    // Trouver le nouveau lock
    for (let i = 0; i < enemyPicks.length; i++) {
      if (enemyPicks[i] && enemyPicks[i] !== prev[i]) {
        const reaction = generateLockReaction(
          enemyPicks[i], enemyPicks, allyPicks, hasPicked ? myChamp : null, role,
        )
        setLockReaction({ champion: enemyPicks[i], text: reaction })
        break
      }
    }
    prevEnemyRef.current = [...enemyPicks]
  }, [enemyPicks, allyPicks, myChamp, hasPicked, role])

  // Auto-détection des rôles ennemis : roleMapping[roleIdx] = pickIdx
  const [enemyRoleMap, setEnemyRoleMap] = useState<number[]>([-1, -1, -1, -1, -1])

  useEffect(() => {
    const filled = enemyPicks.filter(Boolean)
    if (filled.length > 0) {
      setEnemyRoleMap(deduceEnemyRoles(enemyPicks))
    } else {
      setEnemyRoleMap([-1, -1, -1, -1, -1])
    }
  }, [enemyPicks])

  // Quand on drop un ennemi dans la zone, générer l'analyse de matchup
  const handleInspectDrop = (champion: string) => {
    setInspected(champion)
    setMatchup(generateMatchupAnalysis(myChamp, champion))
  }

  // Swap de rôles ennemis (drag d'un slot à un autre)
  const handleEnemySwap = (fromRoleIdx: number, toRoleIdx: number) => {
    setEnemyRoleMap((prev) => {
      const next = [...prev]
      const tmp = next[fromRoleIdx]
      next[fromRoleIdx] = next[toRoleIdx]
      next[toRoleIdx] = tmp
      return next
    })
  }

  return (
    <div className="flex flex-col gap-3 p-4 max-w-2xl mx-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 48px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">Draft Advisor</h1>
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: lcuConnected ? '#22c55e' : '#6b7280' }}
          />
          <span className="text-[10px] text-gray-500 font-mono">
            {lcuConnected ? 'Client LoL connecté' : 'Mode manuel'}
          </span>
        </div>
      </div>

      {/* Role Selector */}
      <div>
        <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2 block">
          Ton rôle
        </span>
        <div className="flex gap-2">
          {ROLES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRole(r.key)}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all"
              style={{
                backgroundColor: role === r.key ? '#7c3aed20' : '#ffffff08',
                border: `1px solid ${role === r.key ? '#7c3aed' : '#ffffff15'}`,
                color: role === r.key ? '#c4b5fd' : '#9ca3af',
                transform: role === r.key ? 'scale(1.05)' : 'scale(1)',
              }}
            >
              <span className="text-base">{r.icon}</span>
              <span className="text-[10px] font-bold uppercase">{r.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Ally Picks */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#22c55e90' }}>
            Alliés
          </span>
          <button
            onClick={clearAll}
            className="text-[10px] text-gray-500 hover:text-red-400 transition-colors"
          >
            Reset tout
          </button>
        </div>
        <div className="flex gap-2">
          {allyPicks.map((pick, i) => (
            <ChampionInput
              key={`ally-${i}`}
              value={pick}
              placeholder={ROLES[i]?.label ?? `Allié ${i + 1}`}
              onChange={(v) => setAllyPick(i, v)}
              accent="#22c55e"
              side="ally"
              allyPicks={allyPicks}
              enemyPicks={enemyPicks}
            />
          ))}
        </div>
      </div>

      {/* Enemy Picks — slots par rôle avec drag-swap */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: '#ef444490' }}>
          Ennemis
        </span>
        <div className="flex gap-2">
          {ROLES.map((r, roleIdx) => {
            const pickIdx = enemyRoleMap[roleIdx]
            const pick = pickIdx >= 0 ? enemyPicks[pickIdx] : ''
            return (
              <EnemyRoleSlot
                key={`enemy-role-${roleIdx}`}
                roleLabel={r.label}
                roleIcon={r.icon}
                roleIdx={roleIdx}
                pick={pick}
                pickIdx={pickIdx}
                onChangePick={(v) => {
                  // Si aucun pickIdx assigné, utiliser le premier slot vide
                  const idx = pickIdx >= 0 ? pickIdx : enemyPicks.findIndex((p) => !p)
                  if (idx >= 0) setEnemyPick(idx, v)
                }}
                onSwap={handleEnemySwap}
                allyPicks={allyPicks}
                enemyPicks={enemyPicks}
              />
            )
          })}
        </div>
      </div>

      {/* Drop Zone — Matchup mechanics */}
      <MatchupDropZone
        champion={inspected}
        matchup={matchup}
        onDrop={handleInspectDrop}
        onClear={() => { setInspected(null); setMatchup(null) }}
      />

      {/* Lock reaction banner */}
      {lockReaction && (
        <LockReactionBanner champion={lockReaction.champion} text={lockReaction.text} />
      )}

      {/* Recommendations list (masquée une fois que tu as pick) */}
      {!hasPicked && recommendations.length > 0 && (
        <RecommendationList recommendations={recommendations} role={role} />
      )}

      {/* Composition analysis */}
      {compTips.length > 0 && (
        <div>
          <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2 block">
            Analyse de la comp ennemie
          </span>
          <div className="flex flex-col gap-1">
            {compTips.map((tip, i) => (
              <div
                key={i}
                className="text-xs px-3 py-2 rounded-lg"
                style={{ backgroundColor: '#f59e0b10', border: '1px solid #f59e0b30', color: '#fcd34d' }}
              >
                {tip}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rune lookup for any champion */}
      <RuneLookup role={role} />

      {/* Empty state */}
      {recommendations.length === 0 && !inspected && enemyPicks.every((p) => !p) && allyPicks.every((p) => !p) && (
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <span className="text-2xl">🎯</span>
          <span className="text-xs text-gray-500 text-center">
            Ajoute les picks alliés et ennemis pour voir les counters et synergies
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Champion Input avec image draggable + autocomplete ──────────────────────

function ChampionInput({
  value, placeholder, onChange, accent = '#7c3aed', side, allyPicks = [], enemyPicks = [],
}: {
  value: string; placeholder: string; onChange: (v: string) => void; accent?: string
  side?: 'ally' | 'enemy'; allyPicks?: string[]; enemyPicks?: string[]
}) {
  const [search, setSearch] = useState(value)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setSearch(value); setImgError(false) }, [value])

  const allChamps = Object.keys(CHAMPIONS)
  const suggestions = search.length > 0
    ? allChamps.filter((c) => c.toLowerCase().includes(search.toLowerCase())).slice(0, 6)
    : []

  const selectChamp = (champ: string) => {
    setSearch(champ)
    onChange(champ)
    setShowSuggestions(false)
  }

  const imgUrl = value ? getChampionLoadingUrl(value) : ''

  const handleMouseEnter = () => {
    if (!value) return
    hoverTimeout.current = setTimeout(() => setShowTooltip(true), 250)
  }
  const handleMouseLeave = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
    setShowTooltip(false)
  }

  return (
    <div className="relative flex-1 flex flex-col items-center">
      {/* Image bulle — DRAGGABLE + HOVER TOOLTIP */}
      <div
        draggable={!!value}
        onDragStart={(e) => { value && startDrag(e, value); setShowTooltip(false) }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="w-9 h-9 rounded-full mb-1 overflow-hidden flex-shrink-0"
        style={{
          border: value ? `2px solid ${accent}80` : '2px solid #ffffff10',
          backgroundColor: '#ffffff08',
          cursor: value ? 'grab' : 'default',
        }}
      >
        {value && imgUrl && !imgError ? (
          <img
            src={imgUrl}
            alt={value}
            className="w-full h-full object-cover object-top pointer-events-none"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-600">
            {placeholder.charAt(0)}
          </div>
        )}
      </div>

      {/* Tooltip hover */}
      {showTooltip && value && (
        <ChampionHoverTooltip
          champion={value}
          side={side}
          allyPicks={allyPicks}
          enemyPicks={enemyPicks}
        />
      )}

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={search}
        placeholder={placeholder}
        onChange={(e) => {
          setSearch(e.target.value)
          setShowSuggestions(true)
          if (!e.target.value) onChange('')
        }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        className="w-full text-xs px-2 py-1.5 rounded-lg bg-white/5 border text-white placeholder-gray-600 outline-none transition-colors text-center"
        style={{ borderColor: value ? `${accent}60` : '#ffffff15' }}
      />

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-gray-900 border border-white/10 rounded-lg shadow-xl overflow-hidden">
          {suggestions.map((champ) => {
            const info = CHAMPIONS[champ]
            const suggImgUrl = getChampionLoadingUrl(champ)
            return (
              <button
                key={champ}
                onMouseDown={() => selectChamp(champ)}
                className="w-full text-left px-2 py-1.5 text-xs hover:bg-violet-500/20 transition-colors flex items-center gap-2"
              >
                <img
                  src={suggImgUrl}
                  alt={champ}
                  className="w-5 h-5 rounded-full object-cover object-top flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <span className="text-white font-medium truncate">{champ}</span>
                {info && (
                  <span className="text-[9px] text-gray-500 ml-auto flex-shrink-0">{info.class}</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Enemy Role Slot (drag-swap entre rôles) ─────────────────────────────────

function EnemyRoleSlot({
  roleLabel, roleIcon, roleIdx, pick, pickIdx, onChangePick, onSwap, allyPicks, enemyPicks,
}: {
  roleLabel: string; roleIcon: string; roleIdx: number; pick: string; pickIdx: number
  onChangePick: (v: string) => void; onSwap: (from: number, to: number) => void
  allyPicks: string[]; enemyPicks: string[]
}) {
  const [search, setSearch] = useState(pick)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setSearch(pick); setImgError(false) }, [pick])

  const allChamps = Object.keys(CHAMPIONS)
  const suggestions = search.length > 0
    ? allChamps.filter((c) => c.toLowerCase().includes(search.toLowerCase())).slice(0, 6)
    : []

  const selectChamp = (champ: string) => {
    setSearch(champ)
    onChangePick(champ)
    setShowSuggestions(false)
  }

  const imgUrl = pick ? getChampionLoadingUrl(pick) : ''

  const handleMouseEnter = () => {
    if (!pick) return
    hoverTimeout.current = setTimeout(() => setShowTooltip(true), 250)
  }
  const handleMouseLeave = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
    setShowTooltip(false)
  }

  // Drag-swap handlers
  const handleDragStart = (e: React.DragEvent) => {
    if (!pick) return
    e.dataTransfer.setData('text/plain', pick)
    e.dataTransfer.setData('application/x-role-idx', String(roleIdx))
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const fromRoleStr = e.dataTransfer.getData('application/x-role-idx')
    if (fromRoleStr) {
      const fromRole = parseInt(fromRoleStr, 10)
      if (fromRole !== roleIdx) onSwap(fromRole, roleIdx)
    }
  }

  return (
    <div
      className="relative flex-1 flex flex-col items-center"
      onDragOver={handleDragOver}
      onDragEnter={() => setDragOver(true)}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Role label */}
      <span className="text-[8px] font-bold uppercase tracking-wider mb-0.5" style={{ color: '#ef444460' }}>
        {roleIcon} {roleLabel}
      </span>

      {/* Image bulle — DRAGGABLE pour swap */}
      <div
        draggable={!!pick}
        onDragStart={handleDragStart}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="w-9 h-9 rounded-full mb-1 overflow-hidden flex-shrink-0 transition-all"
        style={{
          border: dragOver ? '2px solid #7c3aed' : pick ? '2px solid #ef444480' : '2px solid #ffffff10',
          backgroundColor: dragOver ? '#7c3aed15' : '#ffffff08',
          cursor: pick ? 'grab' : 'default',
          transform: dragOver ? 'scale(1.15)' : 'scale(1)',
        }}
      >
        {pick && imgUrl && !imgError ? (
          <img
            src={imgUrl}
            alt={pick}
            className="w-full h-full object-cover object-top pointer-events-none"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-600">
            {roleLabel.charAt(0)}
          </div>
        )}
      </div>

      {/* Tooltip hover */}
      {showTooltip && pick && (
        <ChampionHoverTooltip champion={pick} side="enemy" allyPicks={allyPicks} enemyPicks={enemyPicks} />
      )}

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={search}
        placeholder={roleLabel}
        onChange={(e) => {
          setSearch(e.target.value)
          setShowSuggestions(true)
          if (!e.target.value) onChangePick('')
        }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        className="w-full text-xs px-2 py-1.5 rounded-lg bg-white/5 border text-white placeholder-gray-600 outline-none transition-colors text-center"
        style={{ borderColor: pick ? '#ef444460' : '#ffffff15' }}
      />

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-gray-900 border border-white/10 rounded-lg shadow-xl overflow-hidden">
          {suggestions.map((champ) => {
            const info = CHAMPIONS[champ]
            const suggImgUrl = getChampionLoadingUrl(champ)
            return (
              <button
                key={champ}
                onMouseDown={() => selectChamp(champ)}
                className="w-full text-left px-2 py-1.5 text-xs hover:bg-violet-500/20 transition-colors flex items-center gap-2"
              >
                <img
                  src={suggImgUrl}
                  alt={champ}
                  className="w-5 h-5 rounded-full object-cover object-top flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <span className="text-white font-medium truncate">{champ}</span>
                {info && (
                  <span className="text-[9px] text-gray-500 ml-auto flex-shrink-0">{info.class}</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Tooltip hover sur les bulles champion ───────────────────────────────────

function ChampionHoverTooltip({
  champion, side, allyPicks, enemyPicks,
}: {
  champion: string; side?: 'ally' | 'enemy'; allyPicks: string[]; enemyPicks: string[]
}) {
  const info = getChampion(champion)
  const runes = CHAMPION_RUNES[champion]
  const imgUrl = getChampionLoadingUrl(champion)
  const filledAllies = allyPicks.filter(Boolean)
  const filledEnemies = enemyPicks.filter(Boolean)

  // Counters contextuels
  const countersEnemies: string[] = []
  for (const enemy of filledEnemies) {
    const c = CHAMPION_COUNTERS[enemy]
    if (c?.some((x) => x.toLowerCase() === champion.toLowerCase())) {
      countersEnemies.push(enemy)
    }
  }
  const counteredBy = CHAMPION_COUNTERS[champion] ?? []

  // Synergies avec alliés
  const synergy = getSynergyScore(champion, filledAllies)

  const powerColors: Record<string, string> = {
    early: '#ef4444', mid: '#f59e0b', late: '#22c55e', all: '#7c3aed',
  }
  const powerLabels: Record<string, string> = {
    early: 'Early', mid: 'Mid', late: 'Late', all: 'All',
  }
  const classLabels: Record<string, string> = {
    assassin: 'Assassin', mage: 'Mage', marksman: 'ADC', bruiser: 'Bruiser',
    tank: 'Tank', enchanter: 'Enchanter', engage: 'Engage', skirmisher: 'Duelliste',
  }

  return (
    <div
      className="absolute z-[60] w-72 rounded-xl shadow-2xl overflow-hidden"
      style={{
        top: '-8px',
        left: '50%',
        transform: 'translate(-50%, -100%)',
        border: '1px solid #7c3aed40',
        backgroundColor: '#111027',
        animation: 'tooltipIn 0.15s ease-out',
      }}
    >
      {/* Header avec mini portrait */}
      <div className="flex items-center gap-2.5 p-2.5" style={{ borderBottom: '1px solid #ffffff10' }}>
        <img
          src={imgUrl}
          alt={champion}
          className="w-10 h-10 rounded-lg object-cover object-top flex-shrink-0"
          style={{ border: '2px solid #7c3aed50' }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
        <div className="min-w-0">
          <div className="text-sm font-bold text-white">{champion}</div>
          {info && (
            <div className="flex gap-1.5 mt-0.5">
              <span className="text-[8px] font-bold uppercase px-1.5 py-px rounded" style={{ backgroundColor: '#ffffff10', color: '#c4b5fd' }}>
                {classLabels[info.class] ?? info.class}
              </span>
              <span className="text-[8px] font-bold uppercase px-1.5 py-px rounded" style={{ backgroundColor: `${powerColors[info.power]}15`, color: powerColors[info.power] }}>
                {powerLabels[info.power]}
              </span>
              {info.dangerLevel != null && info.dangerLevel >= 2 && (
                <span className="text-[8px] font-bold px-1.5 py-px rounded" style={{ backgroundColor: '#ef444418', color: '#fca5a5' }}>
                  {'!'.repeat(info.dangerLevel)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Corps */}
      <div className="p-2.5 flex flex-col gap-1.5 max-h-52 overflow-y-auto">
        {/* Tip principal selon le côté */}
        {side === 'enemy' && info?.tip && (
          <p className="text-[10px] leading-relaxed" style={{ color: '#fdba74' }}>
            <span className="font-bold" style={{ color: '#fb923c' }}>VS : </span>{info.tip}
          </p>
        )}
        {side === 'ally' && info?.allyTip && (
          <p className="text-[10px] leading-relaxed" style={{ color: '#86efac' }}>
            <span className="font-bold" style={{ color: '#4ade80' }}>AVEC : </span>{info.allyTip}
          </p>
        )}
        {/* Si pas de side, montrer les deux */}
        {!side && info?.tip && (
          <p className="text-[10px] leading-relaxed" style={{ color: '#fdba74' }}>
            <span className="font-bold" style={{ color: '#fb923c' }}>VS : </span>{info.tip}
          </p>
        )}
        {!side && info?.allyTip && (
          <p className="text-[10px] leading-relaxed" style={{ color: '#86efac' }}>
            <span className="font-bold" style={{ color: '#4ade80' }}>AVEC : </span>{info.allyTip}
          </p>
        )}

        {/* Counter ennemis */}
        {countersEnemies.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] font-bold text-violet-400">COUNTER</span>
            {countersEnemies.map((e) => (
              <span key={e} className="text-[9px] px-1.5 py-px rounded" style={{ backgroundColor: '#22c55e15', color: '#86efac' }}>
                &gt; {e}
              </span>
            ))}
          </div>
        )}

        {/* Faible vs */}
        {counteredBy.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] font-bold text-red-400">FAIBLE VS</span>
            {counteredBy.slice(0, 3).map((c) => (
              <span key={c} className="text-[9px] px-1.5 py-px rounded" style={{ backgroundColor: '#ef444415', color: '#fca5a5' }}>
                {c}
              </span>
            ))}
          </div>
        )}

        {/* Synergies */}
        {synergy.tips.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-bold text-blue-400">SYNERGIE</span>
            {synergy.tips.slice(0, 2).map((tip, i) => (
              <span key={i} className="text-[9px] text-blue-300/80">{tip}</span>
            ))}
          </div>
        )}

        {/* Runes */}
        {runes && (
          <div className="flex flex-wrap gap-1 items-center">
            <span className="text-[9px] font-bold text-yellow-400 mr-0.5">RUNES</span>
            <RuneBadge label={runes.keystone} type="keystone" />
            <RuneBadge label={runes.primary} type="primary" />
            <RuneBadge label={runes.secondary} type="secondary" />
          </div>
        )}
      </div>

      {/* Flèche en bas */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          bottom: '-6px',
          width: 0, height: 0,
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderTop: '6px solid #111027',
        }}
      />

      <style>{`
        @keyframes tooltipIn {
          from { opacity: 0; transform: translate(-50%, -100%) scale(0.95); }
          to { opacity: 1; transform: translate(-50%, -100%) scale(1); }
        }
      `}</style>
    </div>
  )
}

// ─── Drop Zone — Matchup Mechanics ──────────────────────────────────────────

function MatchupDropZone({
  champion,
  matchup,
  onDrop,
  onClear,
}: {
  champion: string | null
  matchup: MatchupAnalysis | null
  onDrop: (name: string) => void
  onClear: () => void
}) {
  const [hovering, setHovering] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setHovering(false)
    const name = e.dataTransfer.getData('text/plain').trim()
    if (name) onDrop(name)
  }

  // État vide
  if (!champion) {
    return (
      <div
        onDragOver={handleDragOver}
        onDragEnter={() => setHovering(true)}
        onDragLeave={() => setHovering(false)}
        onDrop={handleDrop}
        className="flex flex-col items-center justify-center py-4 rounded-xl transition-all"
        style={{
          border: `2px dashed ${hovering ? '#7c3aed' : '#ffffff15'}`,
          backgroundColor: hovering ? '#7c3aed10' : 'transparent',
        }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center transition-all"
          style={{
            border: `2px dashed ${hovering ? '#7c3aed' : '#ffffff20'}`,
            backgroundColor: hovering ? '#7c3aed15' : '#ffffff05',
            transform: hovering ? 'scale(1.1)' : 'scale(1)',
          }}
        >
          <span className="text-lg" style={{ opacity: hovering ? 1 : 0.4 }}>⚔️</span>
        </div>
        <span className="text-[10px] mt-2" style={{ color: hovering ? '#c4b5fd' : '#6b7280' }}>
          {hovering ? 'Lâche pour analyser le matchup' : 'Glisse un ennemi ici pour voir les mécaniques du matchup'}
        </span>
      </div>
    )
  }

  // État rempli : analyse du matchup
  const imgUrl = getChampionLoadingUrl(champion)
  const advantageColors = {
    you:  { bg: '#22c55e15', border: '#22c55e40', text: '#86efac', label: 'Avantage pour toi' },
    them: { bg: '#ef444415', border: '#ef444440', text: '#fca5a5', label: 'Avantage ennemi' },
    even: { bg: '#f59e0b15', border: '#f59e0b40', text: '#fcd34d', label: 'Matchup neutre' },
  }
  const adv = matchup ? advantageColors[matchup.advantage] : advantageColors.even

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="rounded-xl overflow-hidden"
      style={{ border: `1px solid ${adv.border}`, backgroundColor: '#0d0b1e' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-3" style={{ borderBottom: '1px solid #ffffff10' }}>
        <img
          src={imgUrl}
          alt={champion}
          className="w-12 h-12 rounded-lg object-cover object-top flex-shrink-0"
          style={{ border: `2px solid ${adv.border}` }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white">{matchup?.summary ?? champion}</span>
            <button
              onClick={onClear}
              className="text-[10px] text-gray-500 hover:text-red-400 transition-colors px-1"
            >
              ✕
            </button>
          </div>
          <span
            className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full inline-block mt-1"
            style={{ backgroundColor: adv.bg, color: adv.text, border: `1px solid ${adv.border}` }}
          >
            {adv.label}
          </span>
        </div>
      </div>

      {/* Sections matchup */}
      {matchup && matchup.sections.length > 0 && (
        <div className="p-3 flex flex-col gap-2.5">
          {matchup.sections.map((sec, i) => (
            <div key={i}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm">{sec.icon}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: adv.text }}>
                  {sec.label}
                </span>
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed pl-5">
                {sec.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ChampionChip({ name, color }: { name: string; color: string }) {
  const imgUrl = getChampionLoadingUrl(name)
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1"
      style={{ backgroundColor: `${color}12`, color: `${color}cc`, border: `1px solid ${color}30` }}
    >
      <img
        src={imgUrl}
        alt={name}
        className="w-3.5 h-3.5 rounded-full object-cover object-top"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
      {name}
    </span>
  )
}

// ─── Lock Reaction Banner ────────────────────────────────────────────────────

function LockReactionBanner({ champion, text }: { champion: string; text: string }) {
  const imgUrl = getChampionLoadingUrl(champion)
  const info = getChampion(champion)
  const dangerColors = !info?.dangerLevel || info.dangerLevel <= 1
    ? { bg: '#7c3aed10', border: '#7c3aed40', accent: '#c4b5fd' }
    : info.dangerLevel === 2
    ? { bg: '#f59e0b10', border: '#f59e0b40', accent: '#fcd34d' }
    : { bg: '#ef444410', border: '#ef444440', accent: '#fca5a5' }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: `1px solid ${dangerColors.border}`, backgroundColor: dangerColors.bg }}
    >
      <div className="flex items-start gap-3 p-3">
        <img
          src={imgUrl}
          alt={champion}
          className="w-10 h-10 rounded-lg object-cover object-top flex-shrink-0"
          style={{ border: `2px solid ${dangerColors.border}` }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: dangerColors.accent }}>
              Lock ennemi
            </span>
          </div>
          <p className="text-[11px] text-gray-300 leading-relaxed">{text}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Liste fixe de recommandations ──────────────────────────────────────────

function RecommendationList({
  recommendations,
  role,
}: {
  recommendations: ChampionRecommendation[]
  role: PlayerRole
}) {
  const medalColors = ['#fbbf24', '#9ca3af', '#cd7f32', '#6b7280', '#6b7280']

  return (
    <div>
      <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2 block">
        Picks recommandés {role}
      </span>
      <div className="flex flex-col gap-2">
        {recommendations.map((rec, i) => {
          const imgUrl = getChampionLoadingUrl(rec.champion)
          return (
            <div
              key={rec.champion}
              draggable
              onDragStart={(e) => startDrag(e, rec.champion)}
              className="flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-white/5"
              style={{
                border: '1px solid #7c3aed25',
                backgroundColor: i === 0 ? '#7c3aed08' : 'transparent',
                cursor: 'grab',
              }}
            >
              {/* Rang + portrait */}
              <div className="relative flex-shrink-0">
                <img
                  src={imgUrl}
                  alt={rec.champion}
                  className="w-10 h-10 rounded-lg object-cover object-top"
                  style={{ border: `2px solid ${medalColors[i]}40` }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <div
                  className="absolute -top-1 -left-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black"
                  style={{ backgroundColor: '#0d0b1e', border: `1.5px solid ${medalColors[i]}`, color: medalColors[i] }}
                >
                  {i + 1}
                </div>
              </div>

              {/* Infos */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">{rec.champion}</span>
                  <span
                    className="text-[10px] font-bold px-1.5 py-px rounded-full flex-shrink-0"
                    style={{ backgroundColor: '#7c3aed20', color: '#c4b5fd' }}
                  >
                    +{rec.score}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 leading-relaxed mt-0.5">
                  {rec.detailedReason}
                </p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <RuneBadge label={rec.runes.keystone} type="keystone" />
                  <RuneBadge label={rec.runes.primary} type="primary" />
                  <RuneBadge label={rec.runes.secondary} type="secondary" />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Rune Badge ──────────────────────────────────────────────────────────────

function RuneBadge({ label, type }: { label: string; type: 'keystone' | 'primary' | 'secondary' }) {
  const colors = {
    keystone:  { bg: '#f59e0b20', border: '#f59e0b50', color: '#fcd34d' },
    primary:   { bg: '#7c3aed15', border: '#7c3aed40', color: '#c4b5fd' },
    secondary: { bg: '#22c55e15', border: '#22c55e40', color: '#86efac' },
  }
  const c = colors[type]
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded"
      style={{ backgroundColor: c.bg, border: `1px solid ${c.border}`, color: c.color }}
    >
      {label}
    </span>
  )
}

// ─── Rune Lookup ─────────────────────────────────────────────────────────────

function RuneLookup({ role }: { role: PlayerRole }) {
  const [search, setSearch] = useState('')
  const pool = ROLE_POOL[role]

  const match = search.length > 1
    ? pool.find((c) => c.toLowerCase().startsWith(search.toLowerCase()))
    : null
  const runes = match ? CHAMPION_RUNES[match] : null
  const imgUrl = match ? getChampionLoadingUrl(match) : ''

  return (
    <div>
      <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2 block">
        Runes par champion
      </span>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={`Chercher un champion ${role}...`}
        className="w-full text-xs px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-600 outline-none focus:border-violet-500 transition-colors"
      />
      {match && runes && (
        <div className="mt-2 px-3 py-2.5 rounded-lg flex items-center gap-3" style={{ backgroundColor: '#ffffff06', border: '1px solid #ffffff10' }}>
          <img
            src={imgUrl}
            alt={match}
            className="w-10 h-10 rounded-full object-cover object-top flex-shrink-0"
            style={{ border: '2px solid #7c3aed40' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <div>
            <span className="text-sm font-bold text-white">{match}</span>
            <div className="flex flex-wrap gap-2 mt-1.5">
              <RuneBadge label={runes.keystone} type="keystone" />
              <RuneBadge label={runes.primary} type="primary" />
              <RuneBadge label={runes.secondary} type="secondary" />
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5 italic">{runes.tip}</p>
          </div>
        </div>
      )}
    </div>
  )
}
