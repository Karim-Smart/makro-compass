import type { GameData } from '../../../shared/types'

interface Props {
  gameData: GameData
  colors: { bg: string; text: string; accent: string; border: string }
}

// Couleurs par type de dragon soul
const SOUL_COLORS: Record<string, { color: string; icon: string }> = {
  Infernal:  { color: '#ef4444', icon: '🔥' },
  Mountain:  { color: '#a3a3a3', icon: '🏔' },
  Ocean:     { color: '#3b82f6', icon: '🌊' },
  Cloud:     { color: '#a5f3fc', icon: '💨' },
  Hextech:   { color: '#06b6d4', icon: '⚡' },
  Chemtech:  { color: '#84cc16', icon: '☣' },
}

export function ObjectivesOverlay({ gameData, colors }: Props) {
  const { objectives, towers, teamKills, enemyKills } = gameData
  const killDiff = teamKills - enemyKills

  return (
    <div
      className="rounded-xl overflow-hidden animate-fade-in"
      style={{
        background: 'rgba(8, 10, 18, 0.85)',
        border: `1px solid ${colors.border}`,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}
    >
      <div className="px-3 py-2 space-y-1.5">

        {/* Kill diff */}
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: `${colors.text}60` }}>
            Kills
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono font-black" style={{ color: colors.text }}>
              {teamKills}
            </span>
            <span className="text-[9px] font-mono" style={{
              color: killDiff > 0 ? '#22c55e' : killDiff < 0 ? '#ef4444' : '#6b7280'
            }}>
              {killDiff > 0 ? `+${killDiff}` : killDiff < 0 ? `${killDiff}` : '='}
            </span>
            <span className="text-[11px] font-mono font-black" style={{ color: `${colors.text}80` }}>
              {enemyKills}
            </span>
          </div>
        </div>

        {/* Dragons — alliés vs ennemis */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-xs leading-none">🐉</span>
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: `${colors.text}60` }}>
              Drake
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Ally stacks */}
            <div className="flex gap-0.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={`a${i}`}
                  className="w-2 h-2 rounded-sm"
                  style={{
                    backgroundColor: i < objectives.dragonStacks ? colors.accent : `${colors.border}60`,
                    boxShadow: i < objectives.dragonStacks ? `0 0 4px ${colors.accent}80` : 'none',
                  }}
                />
              ))}
            </div>
            <span className="text-[8px]" style={{ color: `${colors.text}40` }}>vs</span>
            {/* Enemy stacks */}
            <div className="flex gap-0.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={`e${i}`}
                  className="w-2 h-2 rounded-sm"
                  style={{
                    backgroundColor: i < objectives.enemyDragonStacks ? '#ef4444' : `${colors.border}60`,
                    boxShadow: i < objectives.enemyDragonStacks ? '0 0 4px #ef444480' : 'none',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Dragon Soul type */}
        {objectives.dragonSoul && SOUL_COLORS[objectives.dragonSoul] && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs leading-none">
              {SOUL_COLORS[objectives.dragonSoul].icon}
            </span>
            <span
              className="text-[9px] font-bold uppercase tracking-wider"
              style={{ color: SOUL_COLORS[objectives.dragonSoul].color }}
            >
              {objectives.dragonSoul} Soul
            </span>
          </div>
        )}

        {/* Elder Dragon actif */}
        {objectives.elderActive && (
          <div
            className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded"
            style={{
              backgroundColor: '#7c2d1280',
              color: '#fca5a5',
              boxShadow: '0 0 8px #dc262640',
              animation: 'pulseOpacity 1.5s ease-in-out infinite',
            }}
          >
            <span>🐲</span>
            <span>ELDER ACTIF</span>
          </div>
        )}

        {/* Baron */}
        {objectives.baronActive && (
          <div
            className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded"
            style={{
              backgroundColor: '#5b21b680',
              color: '#e9d5ff',
              boxShadow: '0 0 8px #7c3aed40',
            }}
          >
            <span>👁</span>
            <span>BARON BUFF</span>
          </div>
        )}

        {/* Tours */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-xs leading-none">🏰</span>
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: `${colors.text}60` }}>
              Tours
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono" style={{ color: '#22c55e' }}>
              +{towers.enemyDestroyed}
            </span>
            <span className="text-[8px]" style={{ color: `${colors.text}40` }}>/</span>
            <span className="text-[10px] font-mono" style={{ color: '#ef4444' }}>
              -{towers.allyDestroyed}
            </span>
          </div>
        </div>

      </div>

    </div>
  )
}
