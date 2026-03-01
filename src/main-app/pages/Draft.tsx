import { useState, useRef, useEffect, useMemo } from 'react'
import { useDraftStore } from '../stores/draftStore'
import { useCoachingStore } from '../stores/coachingStore'
import { ROLE_POOL, CHAMPION_RUNES, CHAMPION_COUNTERS, CHAMPION_SYNERGIES, getSynergyScore, deduceEnemyRoles, generateMatchupAnalysis, generateLockReaction } from '../../../shared/draft-data'
import type { MatchupAnalysis } from '../../../shared/draft-data'
import { CHAMPIONS, getChampion } from '../../../shared/champion-data'
import type { ChampionClass } from '../../../shared/champion-data'
import { getChampionLoadingUrl } from '../../../shared/champion-images'
import { getMatchupWinrate } from '../../../shared/matchup-winrates'
import { COACHING_STYLES } from '../../../shared/constants'
import type { PlayerRole, ChampionRecommendation } from '../../../shared/types'
import DraftOraclePanel from '../components/DraftOraclePanel'

// ─── Analyse de composition ──────────────────────────────────────────────────

type CompTag = 'engage' | 'burst' | 'poke' | 'sustain' | 'splitpush' | 'teamfight'

const COMP_TAG_META: Record<CompTag, { label: string; color: string; icon: string }> = {
  engage:    { label: 'Engage',    color: '#ef4444', icon: '🛡️' },
  burst:     { label: 'Burst',     color: '#f97316', icon: '💥' },
  poke:      { label: 'Poke',      color: '#3b82f6', icon: '🎯' },
  sustain:   { label: 'Sustain',   color: '#22c55e', icon: '💚' },
  splitpush: { label: 'Split',     color: '#a855f7', icon: '🗡️' },
  teamfight: { label: 'Teamfight', color: '#eab308', icon: '⚔️' },
}

const CLASS_TO_TAGS: Record<ChampionClass, CompTag[]> = {
  assassin:   ['burst', 'splitpush'],
  mage:       ['poke', 'teamfight', 'burst'],
  marksman:   ['teamfight', 'sustain'],
  bruiser:    ['splitpush', 'sustain'],
  tank:       ['engage', 'teamfight'],
  enchanter:  ['sustain', 'poke'],
  engage:     ['engage', 'teamfight'],
  skirmisher: ['splitpush', 'burst'],
}

function computeCompProfile(picks: string[]): Record<CompTag, number> {
  const profile: Record<CompTag, number> = { engage: 0, burst: 0, poke: 0, sustain: 0, splitpush: 0, teamfight: 0 }
  for (const name of picks) {
    if (!name) continue
    const info = getChampion(name)
    if (!info) continue
    const tags = CLASS_TO_TAGS[info.class] ?? []
    for (const tag of tags) profile[tag]++
  }
  return profile
}

function getWinCondition(profile: Record<CompTag, number>): { label: string; color: string } | null {
  const entries = Object.entries(profile) as [CompTag, number][]
  const sorted = entries.sort((a, b) => b[1] - a[1])
  if (sorted[0][1] === 0) return null
  const meta = COMP_TAG_META[sorted[0][0]]
  return { label: meta.label, color: meta.color }
}

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
  const selectedStyle = useCoachingStore((s) => s.selectedStyle)
  const styleColors = COACHING_STYLES[selectedStyle].colors

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

  // Profils de composition des deux équipes
  const allyProfile = useMemo(() => computeCompProfile(allyPicks), [allyPicks])
  const enemyProfile = useMemo(() => computeCompProfile(enemyPicks), [enemyPicks])
  const allyWinCond = useMemo(() => getWinCondition(allyProfile), [allyProfile])
  const enemyWinCond = useMemo(() => getWinCondition(enemyProfile), [enemyProfile])
  const hasAnyPick = allyPicks.some(Boolean) || enemyPicks.some(Boolean)

  // Score global du draft (basé sur les matchup winrates moyennes)
  const draftScore = useMemo(() => {
    const lanes = ROLES.map((_, roleIdx) => {
      const ally = allyPicks[roleIdx] ?? ''
      const enemyPickIdx = enemyRoleMap[roleIdx]
      const enemy = enemyPickIdx >= 0 ? enemyPicks[enemyPickIdx] : ''
      if (!ally || !enemy) return null
      return getMatchupWinrate(ally, enemy)
    }).filter((x): x is number => x !== null)
    if (lanes.length === 0) return null
    return Math.round(lanes.reduce((a, b) => a + b, 0) / lanes.length)
  }, [allyPicks, enemyPicks, enemyRoleMap])

  return (
    <div className="flex flex-col gap-3 p-4 max-w-2xl mx-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 48px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold" style={{ color: '#F0E6D2', fontFamily: 'Cinzel, serif' }}>Draft Advisor</h1>
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
        <span className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: '#C89B3C90' }}>
          Ton rôle
        </span>
        <div className="flex gap-2">
          {ROLES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRole(r.key)}
              className="flex flex-col items-center gap-1 px-3 py-2 clip-bevel transition-all"
              style={{
                backgroundColor: role === r.key ? '#C89B3C18' : '#ffffff08',
                border: `1px solid ${role === r.key ? '#C89B3C' : '#ffffff15'}`,
                color: role === r.key ? '#F0E6D2' : '#9ca3af',
                transform: role === r.key ? 'scale(1.05)' : 'scale(1)',
                boxShadow: role === r.key ? '0 0 12px rgba(200, 155, 60, 0.15)' : 'none',
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

      {/* Lane Matchups — Winrates par lane */}
      <LaneMatchups
        allyPicks={allyPicks}
        enemyPicks={enemyPicks}
        enemyRoleMap={enemyRoleMap}
      />

      {/* Composition analysis — profil visuel des deux équipes */}
      {hasAnyPick && (
        <TeamCompAnalysis
          allyProfile={allyProfile}
          enemyProfile={enemyProfile}
          allyWinCond={allyWinCond}
          enemyWinCond={enemyWinCond}
          draftScore={draftScore}
        />
      )}

      {/* Drop Zone — Matchup mechanics */}
      <MatchupDropZone
        myChampion={myChamp}
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

      {/* Composition analysis — tips textuels */}
      {compTips.length > 0 && (
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: '#C89B3C90' }}>
            Conseils vs cette comp
          </span>
          <div className="flex flex-col gap-1 stagger-enter">
            {compTips.map((tip, i) => (
              <div
                key={i}
                className="text-xs px-3 py-2 clip-bevel"
                style={{ backgroundColor: '#C89B3C08', border: '1px solid #C89B3C25', color: '#F0E6D2' }}
              >
                {tip}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rune lookup for any champion */}
      <RuneLookup role={role} />

      {/* AI Draft Oracle */}
      <DraftOraclePanel
        myTeam={ROLES.map((r, i) => ({
          championId: 0,
          championName: allyPicks[i] ?? '',
          assignedPosition: r.key,
          completed: !!allyPicks[i],
        }))}
        theirTeam={ROLES.map((r, i) => ({
          championId: 0,
          championName: enemyPicks[i] ?? '',
          assignedPosition: r.key,
          completed: !!enemyPicks[i],
        }))}
        assignedPosition={role}
        style={selectedStyle}
        colors={styleColors}
      />

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
  value, placeholder, onChange, accent = '#C89B3C', side, allyPicks = [], enemyPicks = [],
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
        className="w-9 h-9 clip-hex mb-1 overflow-hidden flex-shrink-0"
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
        className="w-full text-xs px-2 py-1.5 clip-bevel bg-white/5 border text-white placeholder-gray-600 outline-none transition-colors text-center"
        style={{ borderColor: value ? `${accent}60` : '#ffffff15' }}
      />

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-gray-900 border border-white/10 clip-bevel shadow-xl overflow-hidden">
          {suggestions.map((champ) => {
            const info = CHAMPIONS[champ]
            const suggImgUrl = getChampionLoadingUrl(champ)
            return (
              <button
                key={champ}
                onMouseDown={() => selectChamp(champ)}
                className="w-full text-left px-2 py-1.5 text-xs hover:bg-amber-700/20 transition-colors flex items-center gap-2"
              >
                <img
                  src={suggImgUrl}
                  alt={champ}
                  className="w-5 h-5 clip-hex object-cover object-top flex-shrink-0"
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
        className="w-9 h-9 clip-hex mb-1 overflow-hidden flex-shrink-0 transition-all"
        style={{
          border: dragOver ? '2px solid #C89B3C' : pick ? '2px solid #ef444480' : '2px solid #ffffff10',
          backgroundColor: dragOver ? '#C89B3C15' : '#ffffff08',
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
        className="w-full text-xs px-2 py-1.5 clip-bevel bg-white/5 border text-white placeholder-gray-600 outline-none transition-colors text-center"
        style={{ borderColor: pick ? '#ef444460' : '#ffffff15' }}
      />

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-gray-900 border border-white/10 clip-bevel shadow-xl overflow-hidden">
          {suggestions.map((champ) => {
            const info = CHAMPIONS[champ]
            const suggImgUrl = getChampionLoadingUrl(champ)
            return (
              <button
                key={champ}
                onMouseDown={() => selectChamp(champ)}
                className="w-full text-left px-2 py-1.5 text-xs hover:bg-amber-700/20 transition-colors flex items-center gap-2"
              >
                <img
                  src={suggImgUrl}
                  alt={champ}
                  className="w-5 h-5 clip-hex object-cover object-top flex-shrink-0"
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
    early: '#ef4444', mid: '#f59e0b', late: '#22c55e', all: '#C89B3C',
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
      className="absolute z-[60] w-72 clip-bevel-lg shadow-2xl overflow-hidden"
      style={{
        top: '-8px',
        left: '50%',
        transform: 'translate(-50%, -100%)',
        border: '1px solid #C89B3C40',
        backgroundColor: '#0A1628',
        animation: 'tooltipIn 0.15s ease-out',
      }}
    >
      {/* Header avec mini portrait */}
      <div className="flex items-center gap-2.5 p-2.5" style={{ borderBottom: '1px solid #ffffff10' }}>
        <img
          src={imgUrl}
          alt={champion}
          className="w-10 h-10 clip-hex object-cover object-top flex-shrink-0"
          style={{ border: '2px solid #C89B3C50' }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
        <div className="min-w-0">
          <div className="text-sm font-bold text-white">{champion}</div>
          {info && (
            <div className="flex gap-1.5 mt-0.5">
              <span className="text-[8px] font-bold uppercase px-1.5 py-px rounded" style={{ backgroundColor: '#ffffff10', color: '#F0E6D2' }}>
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

        {/* Winrate matchups */}
        {side === 'enemy' && filledAllies.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-bold text-gray-400">WINRATE</span>
            {filledAllies.map((ally) => {
              const wr = getMatchupWinrate(ally, champion)
              const wins = wr >= 50
              return (
                <div key={ally} className="flex items-center gap-1">
                  <span className="text-[9px] text-gray-300 w-16 truncate">{ally}</span>
                  <span className="text-[9px] font-black font-mono" style={{ color: wins ? '#22c55e' : '#ef4444' }}>
                    {wr}%
                  </span>
                  <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: '#ef444420', maxWidth: 60 }}>
                    <div className="h-full rounded-full" style={{ width: `${wr}%`, backgroundColor: wins ? '#22c55e' : '#ef4444' }} />
                  </div>
                  <span className="text-[9px] font-black font-mono" style={{ color: !wins ? '#22c55e' : '#ef4444' }}>
                    {100 - wr}%
                  </span>
                </div>
              )
            })}
          </div>
        )}
        {side === 'ally' && filledEnemies.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-bold text-gray-400">WINRATE VS</span>
            {filledEnemies.map((enemy) => {
              const wr = getMatchupWinrate(champion, enemy)
              const wins = wr >= 50
              return (
                <div key={enemy} className="flex items-center gap-1">
                  <span className="text-[9px] text-gray-300 w-16 truncate">{enemy}</span>
                  <span className="text-[9px] font-black font-mono" style={{ color: wins ? '#22c55e' : '#ef4444' }}>
                    {wr}%
                  </span>
                  <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: '#ef444420', maxWidth: 60 }}>
                    <div className="h-full rounded-full" style={{ width: `${wr}%`, backgroundColor: wins ? '#22c55e' : '#ef4444' }} />
                  </div>
                  <span className="text-[9px] font-black font-mono" style={{ color: !wins ? '#22c55e' : '#ef4444' }}>
                    {100 - wr}%
                  </span>
                </div>
              )
            })}
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
          borderTop: '6px solid #0A1628',
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

// ─── Lane Matchups — Winrates par lane ──────────────────────────────────────

function LaneMatchups({
  allyPicks, enemyPicks, enemyRoleMap,
}: {
  allyPicks: string[]; enemyPicks: string[]; enemyRoleMap: number[]
}) {
  const lanes = ROLES.map((r, roleIdx) => {
    const ally = allyPicks[roleIdx] ?? ''
    const enemyPickIdx = enemyRoleMap[roleIdx]
    const enemy = enemyPickIdx >= 0 ? enemyPicks[enemyPickIdx] : ''
    if (!ally || !enemy) return null
    const winrate = getMatchupWinrate(ally, enemy)
    const enemyWinrate = 100 - winrate
    return { role: r, ally, enemy, winrate, enemyWinrate }
  }).filter(Boolean) as Array<{
    role: typeof ROLES[number]; ally: string; enemy: string; winrate: number; enemyWinrate: number
  }>

  if (lanes.length === 0) return null

  return (
    <div>
      <span className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: '#C89B3C90' }}>
        Matchups par lane
      </span>
      <div className="flex flex-col gap-1.5 stagger-enter">
        {lanes.map(({ role, ally, enemy, winrate, enemyWinrate }) => {
          const allyWins = winrate >= 50
          const allyImgUrl = getChampionLoadingUrl(ally)
          const enemyImgUrl = getChampionLoadingUrl(enemy)

          return (
            <div
              key={role.key}
              className="flex items-center gap-2 px-3 py-2 clip-bevel hextech-card"
              style={{ backgroundColor: '#0A162890', border: '1px solid #C89B3C15' }}
            >
              {/* Role */}
              <span className="text-[9px] font-bold uppercase text-gray-500 w-10 text-center flex-shrink-0">
                {role.icon} {role.label}
              </span>

              {/* Ally */}
              <div className="flex items-center gap-1.5 w-24 flex-shrink-0">
                <img
                  src={allyImgUrl}
                  alt={ally}
                  className="w-6 h-6 clip-hex object-cover object-top flex-shrink-0"
                  style={{ border: '1.5px solid #22c55e50' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <span className="text-[10px] font-bold text-white truncate">{ally}</span>
              </div>

              {/* Winrate bar */}
              <div className="flex-1 flex items-center gap-1.5 min-w-0">
                <span
                  className="text-xs font-black font-mono w-9 text-right flex-shrink-0"
                  style={{ color: allyWins ? '#22c55e' : '#ef4444' }}
                >
                  {winrate}%
                </span>
                <div
                  className="flex-1 h-2 rounded-full overflow-hidden"
                  style={{ backgroundColor: '#ef444425' }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${winrate}%`,
                      backgroundColor: allyWins ? '#22c55e' : '#ef4444',
                      opacity: 0.8,
                    }}
                  />
                </div>
                <span
                  className="text-xs font-black font-mono w-9 flex-shrink-0"
                  style={{ color: !allyWins ? '#22c55e' : '#ef4444' }}
                >
                  {enemyWinrate}%
                </span>
              </div>

              {/* Enemy */}
              <div className="flex items-center gap-1.5 w-24 flex-shrink-0 justify-end">
                <span className="text-[10px] font-bold text-white truncate">{enemy}</span>
                <img
                  src={enemyImgUrl}
                  alt={enemy}
                  className="w-6 h-6 clip-hex object-cover object-top flex-shrink-0"
                  style={{ border: '1.5px solid #ef444450' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Drop Zone — Matchup Mechanics ──────────────────────────────────────────

function MatchupDropZone({
  myChampion,
  champion,
  matchup,
  onDrop,
  onClear,
}: {
  myChampion: string
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
        className="flex flex-col items-center justify-center py-4 clip-bevel-lg transition-all"
        style={{
          border: `2px dashed ${hovering ? '#C89B3C' : '#ffffff15'}`,
          backgroundColor: hovering ? '#C89B3C10' : 'transparent',
        }}
      >
        <div
          className="w-14 h-14 clip-hex flex items-center justify-center transition-all"
          style={{
            border: `2px dashed ${hovering ? '#C89B3C' : '#ffffff20'}`,
            backgroundColor: hovering ? '#C89B3C15' : '#ffffff05',
            transform: hovering ? 'scale(1.1)' : 'scale(1)',
          }}
        >
          <span className="text-lg" style={{ opacity: hovering ? 1 : 0.4 }}>⚔️</span>
        </div>
        <span className="text-[10px] mt-2" style={{ color: hovering ? '#F0E6D2' : '#6b7280' }}>
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
      className="clip-bevel-lg overflow-hidden"
      style={{ border: `1px solid ${adv.border}`, backgroundColor: '#0A1628' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-3" style={{ borderBottom: '1px solid #ffffff10' }}>
        <img
          src={imgUrl}
          alt={champion}
          className="w-12 h-12 clip-hex object-cover object-top flex-shrink-0"
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
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-[9px] font-bold uppercase px-2 py-0.5 clip-bevel-sm inline-block"
              style={{ backgroundColor: adv.bg, color: adv.text, border: `1px solid ${adv.border}` }}
            >
              {adv.label}
            </span>
            {myChampion && champion && (() => {
              const wr = getMatchupWinrate(myChampion, champion)
              const enemyWr = 100 - wr
              const wins = wr >= 50
              return (
                <span className="flex items-center gap-1">
                  <span className="text-[10px] font-black font-mono" style={{ color: wins ? '#22c55e' : '#ef4444' }}>
                    {wr}%
                  </span>
                  <span className="text-[8px] text-gray-600">vs</span>
                  <span className="text-[10px] font-black font-mono" style={{ color: !wins ? '#22c55e' : '#ef4444' }}>
                    {enemyWr}%
                  </span>
                </span>
              )
            })()}
          </div>
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
      className="text-[10px] px-2 py-0.5 clip-bevel-sm flex items-center gap-1"
      style={{ backgroundColor: `${color}12`, color: `${color}cc`, border: `1px solid ${color}30` }}
    >
      <img
        src={imgUrl}
        alt={name}
        className="w-3.5 h-3.5 clip-hex object-cover object-top"
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
    ? { bg: '#C89B3C10', border: '#C89B3C40', accent: '#F0E6D2' }
    : info.dangerLevel === 2
    ? { bg: '#f59e0b10', border: '#f59e0b40', accent: '#fcd34d' }
    : { bg: '#ef444410', border: '#ef444440', accent: '#fca5a5' }

  return (
    <div
      className="clip-bevel-lg overflow-hidden"
      style={{ border: `1px solid ${dangerColors.border}`, backgroundColor: dangerColors.bg }}
    >
      <div className="flex items-start gap-3 p-3">
        <img
          src={imgUrl}
          alt={champion}
          className="w-10 h-10 clip-hex object-cover object-top flex-shrink-0"
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

function scoreColor(score: number): string {
  if (score >= 75) return '#22c55e'
  if (score >= 50) return '#f59e0b'
  return '#ef4444'
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'EXCELLENT'
  if (score >= 65) return 'BON PICK'
  if (score >= 50) return 'VIABLE'
  return 'RISQUÉ'
}

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
      <span className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: '#C89B3C90' }}>
        Picks recommandés {role}
      </span>
      <div className="flex flex-col gap-2 stagger-enter">
        {recommendations.map((rec, i) => {
          const imgUrl = getChampionLoadingUrl(rec.champion)
          const sColor = scoreColor(rec.score)
          const isTop = i === 0
          return (
            <div
              key={rec.champion}
              draggable
              onDragStart={(e) => startDrag(e, rec.champion)}
              className="flex items-start gap-3 px-3 py-2.5 clip-bevel-lg transition-all hover:bg-white/5"
              style={{
                border: isTop ? `1px solid ${sColor}40` : '1px solid #C89B3C18',
                backgroundColor: isTop ? `${sColor}08` : 'transparent',
                cursor: 'grab',
                boxShadow: isTop ? `0 0 16px ${sColor}10` : 'none',
              }}
            >
              {/* Rang + portrait */}
              <div className="relative flex-shrink-0">
                <img
                  src={imgUrl}
                  alt={rec.champion}
                  className="w-10 h-10 clip-hex object-cover object-top"
                  style={{ border: `2px solid ${medalColors[i]}40` }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <div
                  className="absolute -top-1 -left-1 w-4 h-4 clip-bevel-sm flex items-center justify-center text-[9px] font-black"
                  style={{ backgroundColor: '#0A1628', border: `1.5px solid ${medalColors[i]}`, color: medalColors[i] }}
                >
                  {i + 1}
                </div>
              </div>

              {/* Infos */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-white">{rec.champion}</span>
                  {/* Score badge avec label contextuel */}
                  <span
                    className="text-[9px] font-black px-2 py-0.5 rounded tracking-wider flex-shrink-0"
                    style={{ backgroundColor: `${sColor}20`, color: sColor, border: `1px solid ${sColor}40` }}
                  >
                    {scoreLabel(rec.score)}
                  </span>
                </div>

                {/* Barre de score 0-100 */}
                <div className="flex items-center gap-2 mb-1.5">
                  <div
                    className="flex-1 h-1.5 rounded-full overflow-hidden"
                    style={{ backgroundColor: '#ffffff10' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, rec.score)}%`, backgroundColor: sColor }}
                    />
                  </div>
                  <span className="text-[10px] font-mono font-black flex-shrink-0" style={{ color: sColor }}>
                    {rec.score}
                  </span>
                </div>

                <p className="text-[10px] text-gray-400 leading-relaxed">
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
    primary:   { bg: '#C89B3C15', border: '#C89B3C40', color: '#F0E6D2' },
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
        className="w-full text-xs px-3 py-2 clip-bevel bg-white/5 border border-white/10 text-white placeholder-gray-600 outline-none transition-colors"
        style={{ borderColor: search ? '#C89B3C50' : undefined }}
      />
      {match && runes && (
        <div className="mt-2 px-3 py-2.5 clip-bevel flex items-center gap-3" style={{ backgroundColor: '#ffffff06', border: '1px solid #ffffff10' }}>
          <img
            src={imgUrl}
            alt={match}
            className="w-10 h-10 clip-hex object-cover object-top flex-shrink-0"
            style={{ border: '2px solid #C89B3C40' }}
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

// ─── Team Composition Analysis ──────────────────────────────────────────────

function TeamCompAnalysis({
  allyProfile,
  enemyProfile,
  allyWinCond,
  enemyWinCond,
  draftScore,
}: {
  allyProfile: Record<CompTag, number>
  enemyProfile: Record<CompTag, number>
  allyWinCond: { label: string; color: string } | null
  enemyWinCond: { label: string; color: string } | null
  draftScore: number | null
}) {
  const tags = Object.keys(COMP_TAG_META) as CompTag[]
  const maxVal = Math.max(
    ...tags.map((t) => allyProfile[t]),
    ...tags.map((t) => enemyProfile[t]),
    1,
  )

  const hasAlly = tags.some((t) => allyProfile[t] > 0)
  const hasEnemy = tags.some((t) => enemyProfile[t] > 0)
  if (!hasAlly && !hasEnemy) return null

  return (
    <div className="clip-bevel-lg overflow-hidden" style={{ border: '1px solid #C89B3C20', backgroundColor: '#0A1628' }}>
      {/* Header avec score global */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5" style={{ borderBottom: '1px solid #C89B3C15' }}>
        <span className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: '#C89B3C' }}>
          Profil de composition
        </span>
        {draftScore !== null && (
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-mono font-bold" style={{ color: '#A0A7B4' }}>
              DRAFT
            </span>
            <span
              className="text-xs font-black font-mono"
              style={{ color: draftScore >= 55 ? '#22c55e' : draftScore >= 45 ? '#f59e0b' : '#ef4444' }}
            >
              {draftScore}%
            </span>
          </div>
        )}
      </div>

      {/* Barres comparatives */}
      <div className="px-3 py-2.5 flex flex-col gap-1.5">
        {tags.map((tag) => {
          const meta = COMP_TAG_META[tag]
          const allyVal = allyProfile[tag]
          const enemyVal = enemyProfile[tag]
          if (allyVal === 0 && enemyVal === 0) return null

          const allyPct = (allyVal / maxVal) * 100
          const enemyPct = (enemyVal / maxVal) * 100

          return (
            <div key={tag} className="flex items-center gap-2">
              <span className="text-[10px] w-16 text-right flex-shrink-0 flex items-center justify-end gap-1" style={{ color: meta.color }}>
                <span>{meta.icon}</span>
                <span className="font-bold">{meta.label}</span>
              </span>

              {/* Barre allié (gauche) */}
              <div className="flex-1 flex justify-end">
                <div className="h-2 rounded-full" style={{
                  width: `${allyPct}%`,
                  minWidth: allyVal > 0 ? 8 : 0,
                  backgroundColor: '#22c55e',
                  opacity: 0.7,
                  transition: 'width 0.3s ease',
                }} />
              </div>

              {/* Séparateur */}
              <div className="w-px h-3 flex-shrink-0" style={{ backgroundColor: '#C89B3C30' }} />

              {/* Barre ennemi (droite) */}
              <div className="flex-1 flex justify-start">
                <div className="h-2 rounded-full" style={{
                  width: `${enemyPct}%`,
                  minWidth: enemyVal > 0 ? 8 : 0,
                  backgroundColor: '#ef4444',
                  opacity: 0.7,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Win conditions */}
      {(allyWinCond || enemyWinCond) && (
        <div className="flex items-center justify-between px-3 pb-2" style={{ borderTop: '1px solid #C89B3C10' }}>
          {allyWinCond ? (
            <span className="text-[8px] font-black uppercase tracking-wider" style={{ color: '#22c55e90' }}>
              Notre force : {allyWinCond.label}
            </span>
          ) : <span />}
          {enemyWinCond ? (
            <span className="text-[8px] font-black uppercase tracking-wider" style={{ color: '#ef444490' }}>
              Leur force : {enemyWinCond.label}
            </span>
          ) : <span />}
        </div>
      )}

      {/* Légende */}
      <div className="flex items-center justify-center gap-4 pb-2">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#22c55e' }} />
          <span className="text-[7px] font-mono text-gray-500">ALLIÉS</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#ef4444' }} />
          <span className="text-[7px] font-mono text-gray-500">ENNEMIS</span>
        </span>
      </div>
    </div>
  )
}
