import { useState, useEffect, useRef } from 'react'
import type { GameData } from '../../../shared/types'

interface Props {
  gameData: GameData
  colors: { bg: string; text: string; accent: string; border: string }
}

export function StatsOverlay({ gameData, colors }: Props) {
  // Horloge interne lisse : interpolation entre les polls (tous les 5s)
  const [displayTime, setDisplayTime] = useState(gameData.gameTime)
  const baseRef = useRef({ gameTime: gameData.gameTime, receivedAt: Date.now() })

  useEffect(() => {
    baseRef.current = { gameTime: gameData.gameTime, receivedAt: Date.now() }
    setDisplayTime(gameData.gameTime)
  }, [gameData.gameTime])

  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = (Date.now() - baseRef.current.receivedAt) / 1000
      setDisplayTime(baseRef.current.gameTime + elapsed)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const csPerMin = displayTime > 0
    ? (gameData.cs / (displayTime / 60)).toFixed(1)
    : '0.0'

  const kdaRatio = gameData.kda.deaths === 0
    ? '∞'
    : ((gameData.kda.kills + gameData.kda.assists) / gameData.kda.deaths).toFixed(1)

  const minutes = Math.floor(displayTime / 60)
  const seconds = Math.floor(displayTime % 60)
  const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`

  // Phase de jeu
  const phase = displayTime < 840 ? 'EARLY' : displayTime < 1500 ? 'MID' : 'LATE'

  // Kill participation
  const kp = gameData.teamKills > 0
    ? Math.round(((gameData.kda.kills + gameData.kda.assists) / gameData.teamKills) * 100)
    : 0

  // Couleur KDA contextuelle
  const kdaNum = gameData.kda.deaths === 0 ? 10 : (gameData.kda.kills + gameData.kda.assists) / gameData.kda.deaths
  const kdaColor = kdaNum >= 4 ? '#22c55e' : kdaNum >= 2 ? colors.text : '#ef4444'

  const cols = [
    {
      label: timeStr,
      main:  `${gameData.kda.kills}/${gameData.kda.deaths}/${gameData.kda.assists}`,
      sub:   `${kdaRatio} KDA`,
      mainColor: kdaColor,
    },
    {
      label: phase,
      main:  `${csPerMin}`,
      sub:   `${gameData.cs} CS · ${kp}% KP`,
      mainColor: colors.text,
    },
    {
      label: `Niv ${gameData.level}`,
      main:  `${(gameData.gold / 1000).toFixed(1)}k`,
      sub:   gameData.champion,
      mainColor: colors.text,
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
        {cols.map(({ label, main, sub, mainColor }, i) => (
          <div
            key={i}
            className="px-3 py-2 text-center flex-1"
            style={i > 0 ? { borderLeft: `1px solid ${colors.border}50` } : {}}
          >
            <div className="text-[8px] font-black uppercase tracking-[0.15em] mb-0.5" style={{ color: colors.accent, opacity: 0.5 }}>
              {label}
            </div>
            <div className="text-xs font-mono font-black leading-tight stat-value" style={{ color: mainColor }}>
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
