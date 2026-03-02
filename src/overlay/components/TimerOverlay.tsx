import { useState, useEffect } from 'react'
import type { ObjectiveTimers, GameData } from '../../../shared/types'

interface Props {
  timers: ObjectiveTimers
  colors: { bg: string; text: string; accent: string; border: string }
  gameData?: GameData
}

function useNow(interval = 500) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval)
    return () => clearInterval(id)
  }, [interval])
  return now
}

function fmtCountdown(targetMs: number | null, now: number): { text: string; urgencyColor: string } {
  if (targetMs === null) return { text: '--:--', urgencyColor: '#94a3b8' }
  const remaining = Math.max(0, targetMs - now)
  const s = Math.floor(remaining / 1000)
  const m = Math.floor(s / 60)
  const ss = s % 60
  const urgencyColor = remaining > 60_000 ? '#22c55e' : remaining > 30_000 ? '#f59e0b' : '#ef4444'
  return {
    text: `${m}:${ss.toString().padStart(2, '0')}`,
    urgencyColor,
  }
}

const DRAGON_TYPE_SHORT: Record<string, string> = {
  Infernal:  '🔥',
  Mountain:  '🪨',
  Ocean:     '🌊',
  Cloud:     '💨',
  Hextech:   '⚡',
  Chemtech:  '☠️',
  Elder:     '🌀',
}

const OBJECTIVES = [
  { key: 'dragon' as const, label: 'Dragon',  icon: '🐉', alwaysShow: true  },
  { key: 'baron'  as const, label: 'Baron',   icon: '👁', alwaysShow: false },
  { key: 'herald' as const, label: 'Herald',  icon: '🟡', alwaysShow: false },
]

export function TimerOverlay({ timers, colors, gameData }: Props) {
  const now = useNow()

  const active = OBJECTIVES.filter(({ key, alwaysShow }) => {
    if (key === 'baron')  return timers.baron.available
    if (key === 'herald') return timers.herald.available
    return alwaysShow
  })

  if (active.length === 0) return null

  return (
    <div
      className="overflow-hidden animate-fade-in min-w-[160px] overlay-glass clip-bevel"
    >
      {/* Accent line dorée */}
      <div
        className="h-[1px]"
        style={{ background: 'linear-gradient(90deg, transparent, #C89B3C40, transparent)' }}
      />
      {/* Header */}
      <div
        className="px-3 pt-2 pb-1.5 text-[9px] font-black uppercase tracking-[0.22em]"
        style={{ color: '#C89B3C', borderBottom: `1px solid ${colors.border}30` }}
      >
        Objectifs
      </div>

      {/* Dragon soul counter */}
      {gameData && gameData.objectives.dragonStacks > 0 && (
        <div className="px-3 pt-1.5 pb-0.5 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="w-2 h-2 clip-bevel-sm"
                style={{
                  backgroundColor: i < gameData.objectives.dragonStacks ? '#C89B3C' : `${colors.border}50`,
                  transition: 'background-color 0.3s ease',
                }}
              />
            ))}
          </div>
          <span className="text-[7px] font-mono font-bold" style={{ color: colors.accent, opacity: 0.6 }}>
            {gameData.objectives.dragonStacks}/4
            {gameData.objectives.dragonSoul ? ` ${gameData.objectives.dragonSoul}` : ' soul'}
          </span>
        </div>
      )}

      {/* Team score */}
      {gameData && (
        <div className="px-3 pb-1 flex items-center justify-between">
          <span className="text-[8px] font-mono font-bold" style={{ color: '#22c55e' }}>
            {gameData.teamKills}
          </span>
          <span className="text-[7px] font-mono" style={{ color: colors.text, opacity: 0.3 }}>
            KILLS
          </span>
          <span className="text-[8px] font-mono font-bold" style={{ color: '#ef4444' }}>
            {gameData.enemyKills}
          </span>
        </div>
      )}

      <div style={{ height: 1, backgroundColor: `${colors.border}25` }} />

      <div className="px-3 py-2 space-y-1.5">
        {active.map(({ key, label, icon }) => {
          const timer = timers[key]
          const isDead = 'isDead' in timer ? timer.isDead : false
          const { text, urgencyColor } = fmtCountdown(timer.nextSpawn, now)
          // Type dragon si disponible (ex: 🔥 Infernal)
          const dragonType = key === 'dragon' && 'type' in timer && timer.type
            ? timer.type as string
            : null
          const dragonEmoji = dragonType ? DRAGON_TYPE_SHORT[dragonType] : null
          const displayLabel = dragonType
            ? `${dragonType}`
            : label

          // Calcul du pourcentage de progression pour la mini-barre
          const respawnDuration = key === 'dragon' ? 300 : key === 'baron' ? 360 : 360
          const remaining = timer.nextSpawn ? Math.max(0, timer.nextSpawn - now) / 1000 : 0
          const progressPct = isDead && remaining > 0
            ? Math.max(0, Math.min(100, ((respawnDuration - remaining) / respawnDuration) * 100))
            : 0

          return (
            <div key={key} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm leading-none">{dragonEmoji ?? icon}</span>
                  <span className="text-[11px] font-medium" style={{ color: colors.text, opacity: 0.75 }}>
                    {displayLabel}
                  </span>
                </div>

                {isDead ? (
                  <span
                    className={`text-xs font-mono font-black timer-urgency ${urgencyColor === '#ef4444' ? 'timer-urgent timer-border-pulse' : urgencyColor === '#f59e0b' ? 'timer-warning' : ''}`}
                    style={{
                      color: urgencyColor,
                      animation: urgencyColor === '#ef4444'
                        ? 'pulseOpacity 0.8s ease-in-out infinite'
                        : urgencyColor === '#f59e0b'
                          ? 'pulseOpacity 1.5s ease-in-out infinite'
                          : 'none',
                    }}
                  >
                    ⟳ {text}
                  </span>
                ) : (
                  <span
                    className="text-[10px] font-semibold flex items-center gap-1"
                    style={{ color: '#22c55e' }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
                    Vivant
                  </span>
                )}
              </div>
              {/* Mini progress bar pour les timers de respawn */}
              {isDead && (
                <div className="h-[2px] w-full rounded-full overflow-hidden" style={{ backgroundColor: `${colors.border}30` }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${progressPct}%`,
                      backgroundColor: urgencyColor,
                      transition: 'width 0.5s linear, background-color 0.5s ease',
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

    </div>
  )
}
