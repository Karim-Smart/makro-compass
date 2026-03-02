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
  const [levelFlash, setLevelFlash] = useState(false)
  const [killFlash, setKillFlash] = useState(false)
  const [deathFlash, setDeathFlash] = useState(false)
  const [csFlash, setCsFlash] = useState(false)
  const prevLevelRef = useRef(gameData.level)
  const prevKillsRef = useRef(gameData.kda.kills)
  const prevDeathsRef = useRef(gameData.kda.deaths)
  const prevCsRef = useRef(gameData.cs)

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

  // Détection level up → flash doré
  useEffect(() => {
    if (gameData.level > prevLevelRef.current) {
      setLevelFlash(true)
      const t = setTimeout(() => setLevelFlash(false), 600)
      prevLevelRef.current = gameData.level
      return () => clearTimeout(t)
    }
    prevLevelRef.current = gameData.level
  }, [gameData.level])

  // Détection kill → flash vert
  useEffect(() => {
    if (gameData.kda.kills > prevKillsRef.current) {
      setKillFlash(true)
      const t = setTimeout(() => setKillFlash(false), 400)
      prevKillsRef.current = gameData.kda.kills
      return () => clearTimeout(t)
    }
    prevKillsRef.current = gameData.kda.kills
  }, [gameData.kda.kills])

  // Détection death → flash rouge
  useEffect(() => {
    if (gameData.kda.deaths > prevDeathsRef.current) {
      setDeathFlash(true)
      const t = setTimeout(() => setDeathFlash(false), 400)
      prevDeathsRef.current = gameData.kda.deaths
      return () => clearTimeout(t)
    }
    prevDeathsRef.current = gameData.kda.deaths
  }, [gameData.kda.deaths])

  // Détection gain de CS significatif (toutes les 10 CS)
  useEffect(() => {
    if (gameData.cs >= prevCsRef.current + 10) {
      setCsFlash(true)
      const t = setTimeout(() => setCsFlash(false), 300)
      prevCsRef.current = gameData.cs
      return () => clearTimeout(t)
    }
    if (gameData.cs > prevCsRef.current) prevCsRef.current = gameData.cs
  }, [gameData.cs])

  const csPerMin = displayTime > 0
    ? (gameData.cs / (displayTime / 60)).toFixed(1)
    : '0.0'

  const kdaRatio = gameData.kda.deaths === 0
    ? '∞'
    : ((gameData.kda.kills + gameData.kda.assists) / gameData.kda.deaths).toFixed(1)

  const minutes = Math.floor(displayTime / 60)
  const seconds = Math.floor(displayTime % 60)
  const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`

  // Phase de jeu avec couleur contextuelle
  const phase = displayTime < 840 ? 'EARLY' : displayTime < 1500 ? 'MID' : 'LATE'
  const phaseColor = phase === 'EARLY' ? '#22c55e' : phase === 'MID' ? '#f59e0b' : '#ef4444'

  // Kill participation
  const kp = gameData.teamKills > 0
    ? Math.round(((gameData.kda.kills + gameData.kda.assists) / gameData.teamKills) * 100)
    : 0

  // Couleur KDA contextuelle
  const kdaNum = gameData.kda.deaths === 0 ? 10 : (gameData.kda.kills + gameData.kda.assists) / gameData.kda.deaths
  const kdaColor = kdaNum >= 4 ? '#22c55e' : kdaNum >= 2 ? colors.text : '#ef4444'

  // Gold diff team
  const goldDiff = gameData.teamGold - gameData.enemyGold
  const goldDiffStr = goldDiff >= 0 ? `+${(goldDiff / 1000).toFixed(1)}k` : `${(goldDiff / 1000).toFixed(1)}k`
  const goldDiffColor = goldDiff >= 0 ? '#22c55e' : '#ef4444'

  // Ward score per minute
  const wardPerMin = displayTime > 0 ? (gameData.wardScore / (displayTime / 60)).toFixed(1) : '0.0'

  const cols: { label: string; main: string; sub: string; mainColor: string; labelColor?: string; className?: string }[] = [
    {
      label: timeStr,
      main:  `${gameData.kda.kills}/${gameData.kda.deaths}/${gameData.kda.assists}`,
      sub:   `${kdaRatio} KDA`,
      mainColor: kdaColor,
      className: killFlash ? 'kill-flash' : deathFlash ? 'death-flash' : '',
    },
    {
      label: phase,
      main:  `${csPerMin}`,
      sub:   `${gameData.cs} CS · ${kp}% KP`,
      mainColor: colors.text,
      labelColor: phaseColor,
      className: csFlash ? 'animate-number-up' : '',
    },
    {
      label: `Niv ${gameData.level}`,
      main:  `${(gameData.gold / 1000).toFixed(1)}k`,
      sub:   `${goldDiffStr} diff`,
      mainColor: colors.text,
      className: levelFlash ? 'level-flash' : '',
    },
    {
      label: 'Vision',
      main:  `${wardPerMin}/m`,
      sub:   `${gameData.wardScore} score`,
      mainColor: colors.text,
    },
  ]

  const matchup = gameData.matchup

  return (
    <div
      className="overflow-hidden animate-fade-in overlay-glass clip-bevel"
    >
      {/* Accent line dorée */}
      <div
        className="h-[1px]"
        style={{ background: 'linear-gradient(90deg, transparent, #C89B3C35, transparent)' }}
      />
      <div className="flex">
        {cols.map(({ label, main, sub, mainColor, labelColor, className: extraClass }, i) => (
          <div
            key={i}
            className={`px-3 py-2 text-center flex-1 ${extraClass ?? ''}`}
            style={i > 0 ? { borderLeft: `1px solid ${colors.border}50` } : {}}
          >
            <div
              className="text-[8px] font-black uppercase tracking-[0.15em] mb-0.5"
              style={{ color: labelColor ?? colors.accent, opacity: 0.5, transition: 'color 0.5s ease' }}
            >
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

      {/* Rangée matchup adversaire */}
      {matchup && (
        <>
          <div style={{ height: 1, backgroundColor: `${colors.accent}15` }} />
          <div className="flex">
            {matchup.isDead ? (
              <div className="flex-1 px-3 py-1 text-center">
                <span className="text-[8px] font-mono animate-pulse" style={{ color: '#ef4444' }}>
                  💀 {matchup.champion} — {Math.round(matchup.respawnTimer)}s respawn
                </span>
              </div>
            ) : (
              <>
                <div className="px-3 py-1 text-center flex-1">
                  <div className="text-[8px] font-mono font-bold leading-none" style={{ color: '#ef4444' }}>
                    vs {matchup.champion}
                  </div>
                  <div className="text-[7px] font-mono mt-0.5" style={{ color: '#ef444480' }}>
                    {matchup.levelDiff > 0 ? `⬆+${matchup.levelDiff}` : matchup.levelDiff < 0 ? `⬇${matchup.levelDiff}` : '≈'} niv
                  </div>
                </div>
                <div
                  className="px-3 py-1 text-center flex-1"
                  style={{ borderLeft: `1px solid ${colors.border}30` }}
                >
                  <div className="text-[8px] font-mono font-bold leading-none" style={{ color: '#ef4444' }}>
                    {matchup.oppKda.kills}/{matchup.oppKda.deaths}/{matchup.oppKda.assists}
                  </div>
                  <div className="text-[7px] font-mono mt-0.5" style={{ color: '#ef444480' }}>KDA</div>
                </div>
                <div
                  className="px-3 py-1 text-center flex-1"
                  style={{ borderLeft: `1px solid ${colors.border}30` }}
                >
                  {(() => {
                    const csDiff = gameData.cs - matchup.oppCs
                    const csDiffColor = csDiff >= 0 ? '#22c55e' : '#ef4444'
                    return (
                      <>
                        <div className="text-[8px] font-mono font-bold leading-none" style={{ color: csDiffColor }}>
                          {csDiff >= 0 ? `+${csDiff}` : csDiff}
                        </div>
                        <div className="text-[7px] font-mono mt-0.5" style={{ color: '#ef444480' }}>CS diff</div>
                      </>
                    )
                  })()}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
