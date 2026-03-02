import type { PlayerInfo } from '../../../shared/types'
import { getChampionIconUrl } from '../../../shared/champion-images'

interface Props {
  players: PlayerInfo[]
  colors: { bg: string; text: string; accent: string; border: string }
}

const LANE_ORDER = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']
const LANE_LABELS: Record<string, string> = {
  TOP: 'TOP', JUNGLE: 'JGL', MIDDLE: 'MID', BOTTOM: 'BOT', UTILITY: 'SUP',
}

function fmtGold(g: number): string {
  return g >= 1000 ? `${(g / 1000).toFixed(1)}k` : `${g}`
}

function fmtGoldDiff(diff: number): string {
  const abs = Math.abs(diff)
  const str = abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : `${abs}`
  return diff >= 0 ? `+${str}` : `-${str}`
}

/**
 * Scoreboard Overlay — 5 lignes lane-matched (allié vs ennemi)
 * Inspiré de Blitz.gg / Porofessor : gold diff par matchup de lane.
 */
export function ScoreboardOverlay({ players, colors }: Props) {
  if (players.length < 2) return null

  const allies = players.filter(p => p.team === 'ally')
  const enemies = players.filter(p => p.team === 'enemy')

  // Matchup par lane
  const lanes = LANE_ORDER.map(lane => {
    const ally = allies.find(p => p.position === lane)
    const enemy = enemies.find(p => p.position === lane)
    return { lane, ally: ally ?? null, enemy: enemy ?? null }
  }).filter(row => row.ally || row.enemy)

  // Si les positions ne sont pas renseignées, fallback par index
  if (lanes.length === 0) {
    for (let i = 0; i < Math.max(allies.length, enemies.length); i++) {
      lanes.push({
        lane: LANE_ORDER[i] ?? `P${i + 1}`,
        ally: allies[i] ?? null,
        enemy: enemies[i] ?? null,
      })
    }
  }

  // Gold total par équipe
  const allyTotalGold = allies.reduce((s, p) => s + p.estimatedGold, 0)
  const enemyTotalGold = enemies.reduce((s, p) => s + p.estimatedGold, 0)
  const teamGoldDiff = allyTotalGold - enemyTotalGold

  return (
    <div className="overlay-glass clip-bevel overflow-hidden animate-fade-in">
      {/* Accent line */}
      <div
        className="h-[1px]"
        style={{ background: 'linear-gradient(90deg, transparent, #C89B3C40, transparent)' }}
      />

      {/* Header — gold total par équipe */}
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{ borderBottom: '1px solid #C89B3C15' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: '#C89B3C' }}>
            Scoreboard
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono font-bold" style={{ color: '#22c55e' }}>
            {fmtGold(allyTotalGold)}
          </span>
          <span
            className="text-[9px] font-mono font-black clip-bevel-sm px-1.5 py-0.5"
            style={{
              color: teamGoldDiff >= 0 ? '#22c55e' : '#ef4444',
              backgroundColor: teamGoldDiff >= 0 ? '#22c55e12' : '#ef444412',
              border: `1px solid ${teamGoldDiff >= 0 ? '#22c55e30' : '#ef444430'}`,
            }}
          >
            {fmtGoldDiff(teamGoldDiff)}
          </span>
          <span className="text-[9px] font-mono font-bold" style={{ color: '#ef4444' }}>
            {fmtGold(enemyTotalGold)}
          </span>
        </div>
      </div>

      {/* Lignes par lane */}
      <div className="px-1.5 py-1 flex flex-col gap-[3px]">
        {lanes.map(({ lane, ally, enemy }) => {
          const goldDiff = (ally?.estimatedGold ?? 0) - (enemy?.estimatedGold ?? 0)
          const diffColor = goldDiff > 200 ? '#22c55e' : goldDiff < -200 ? '#ef4444' : '#A0A7B4'
          const absDiff = Math.abs(goldDiff)

          return (
            <div
              key={lane}
              className="flex items-center gap-0 clip-bevel-sm"
              style={{
                backgroundColor: ally?.isMe ? '#C89B3C10' : '#0A162880',
                border: ally?.isMe ? '1px solid #C89B3C25' : '1px solid transparent',
              }}
            >
              {/* Allié */}
              <PlayerCell player={ally} side="ally" colors={colors} />

              {/* Lane + Gold diff au centre */}
              <div className="flex flex-col items-center justify-center w-[56px] flex-shrink-0 py-1">
                <span className="text-[7px] font-black uppercase tracking-wider" style={{ color: '#A0A7B4', opacity: 0.4 }}>
                  {LANE_LABELS[lane] ?? lane}
                </span>
                {(ally && enemy) ? (
                  <span
                    className="text-[9px] font-mono font-black"
                    style={{ color: diffColor }}
                  >
                    {absDiff < 200 ? '≈' : fmtGoldDiff(goldDiff)}
                  </span>
                ) : (
                  <span className="text-[7px] font-mono" style={{ color: '#A0A7B4', opacity: 0.3 }}>—</span>
                )}
              </div>

              {/* Ennemi */}
              <PlayerCell player={enemy} side="enemy" colors={colors} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Cellule joueur (allié ou ennemi) ────────────────────────────────────────

function PlayerCell({
  player,
  side,
  colors,
}: {
  player: PlayerInfo | null
  side: 'ally' | 'enemy'
  colors: { bg: string; text: string; accent: string; border: string }
}) {
  if (!player) {
    return <div className="flex-1 px-2 py-1" />
  }

  const kda = `${player.kills}/${player.deaths}/${player.assists}`
  const isAlly = side === 'ally'
  const kdaRatio = player.deaths === 0 ? 10 : (player.kills + player.assists) / player.deaths
  const kdaColor = kdaRatio >= 4 ? '#22c55e' : kdaRatio >= 2 ? colors.text : '#ef4444'

  return (
    <div
      className={`flex items-center gap-1.5 flex-1 px-2 py-1 min-w-0 ${isAlly ? '' : 'flex-row-reverse'}`}
      style={{ opacity: player.isDead ? 0.45 : 1 }}
    >
      {/* Champion icon */}
      <div
        className="w-5 h-5 clip-bevel-sm overflow-hidden flex-shrink-0"
        style={{ border: `1px solid ${isAlly ? '#22c55e40' : '#ef444440'}` }}
      >
        <img
          src={getChampionIconUrl(player.champion)}
          alt={player.champion}
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      </div>

      {/* Stats */}
      <div className={`flex flex-col min-w-0 ${isAlly ? '' : 'items-end'}`}>
        <div className="flex items-center gap-1">
          <span
            className="text-[8px] font-mono font-bold leading-none truncate"
            style={{ color: kdaColor }}
          >
            {kda}
          </span>
          <span className="text-[7px] font-mono leading-none" style={{ color: colors.text, opacity: 0.3 }}>
            Nv{player.level}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[7px] font-mono" style={{ color: colors.text, opacity: 0.4 }}>
            {player.cs}cs
          </span>
          <span className="text-[7px] font-mono" style={{ color: '#C89B3C', opacity: 0.5 }}>
            {fmtGold(player.estimatedGold)}
          </span>
        </div>
      </div>
    </div>
  )
}
