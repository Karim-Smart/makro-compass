import type { GameData } from '../../../shared/types'

interface Props {
  gameData: GameData
  colors: { bg: string; text: string; accent: string; border: string }
}

export function StatsOverlay({ gameData, colors }: Props) {
  const csPerMin = gameData.gameTime > 0
    ? (gameData.cs / (gameData.gameTime / 60)).toFixed(1)
    : '0.0'

  const kdaRatio = gameData.kda.deaths === 0
    ? '∞'
    : ((gameData.kda.kills + gameData.kda.assists) / gameData.kda.deaths).toFixed(1)

  const minutes = Math.floor(gameData.gameTime / 60)
  const seconds = Math.floor(gameData.gameTime % 60)
  const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`

  // Phase de jeu
  const phase = gameData.gameTime < 840 ? 'EARLY' : gameData.gameTime < 1500 ? 'MID' : 'LATE'

  const cols = [
    {
      label: timeStr,
      main:  `${gameData.kda.kills}/${gameData.kda.deaths}/${gameData.kda.assists}`,
      sub:   `${kdaRatio} KDA`,
    },
    {
      label: phase,
      main:  `${csPerMin}`,
      sub:   `${gameData.cs} CS`,
    },
    {
      label: `Niv ${gameData.level}`,
      main:  `${(gameData.gold / 1000).toFixed(1)}k`,
      sub:   gameData.champion,
    },
  ]

  return (
    <div
      className="rounded-xl overflow-hidden animate-fade-in"
      style={{
        background: 'rgba(8, 10, 18, 0.85)',
        border: `1px solid ${colors.border}`,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}
    >
      <div className="flex">
        {cols.map(({ label, main, sub }, i) => (
          <div
            key={label}
            className="px-3 py-2 text-center flex-1"
            style={i > 0 ? { borderLeft: `1px solid ${colors.border}50` } : {}}
          >
            <div className="text-[8px] font-black uppercase tracking-[0.15em] mb-0.5" style={{ color: colors.accent, opacity: 0.5 }}>
              {label}
            </div>
            <div className="text-xs font-mono font-black leading-tight" style={{ color: colors.text }}>
              {main}
            </div>
            <div className="text-[9px] font-mono leading-none mt-0.5" style={{ color: colors.text, opacity: 0.5 }}>
              {sub}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
