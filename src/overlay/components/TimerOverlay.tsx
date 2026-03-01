import { useState, useEffect } from 'react'
import type { ObjectiveTimers } from '../../../shared/types'

interface Props {
  timers: ObjectiveTimers
  colors: { bg: string; text: string; accent: string; border: string }
}

function useNow(interval = 500) {
  const [now, setNow] = useState(Date.now)
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

export function TimerOverlay({ timers, colors }: Props) {
  const now = useNow()

  const active = OBJECTIVES.filter(({ key, alwaysShow }) => {
    if (key === 'baron')  return timers.baron.available
    if (key === 'herald') return timers.herald.available
    return alwaysShow
  })

  if (active.length === 0) return null

  return (
    <div
      className="overflow-hidden animate-fade-in min-w-[160px]"
      style={{
        background: 'transparent',
      }}
    >
      {/* Header */}
      <div
        className="px-3 pt-2.5 pb-1.5 text-[9px] font-black uppercase tracking-[0.22em]"
        style={{ color: colors.accent, borderBottom: `1px solid ${colors.border}40` }}
      >
        Objectifs
      </div>

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

          return (
            <div key={key} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-sm leading-none">{dragonEmoji ?? icon}</span>
                <span className="text-[11px] font-medium" style={{ color: colors.text, opacity: 0.75 }}>
                  {displayLabel}
                </span>
              </div>

              {isDead ? (
                <span
                  className="text-xs font-mono font-black"
                  style={{
                    color: urgencyColor,
                    animation: urgencyColor === '#ef4444' ? 'pulseOpacity 0.8s ease-in-out infinite' : 'none',
                    transition: 'color 0.5s ease',
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
          )
        })}
      </div>

    </div>
  )
}
