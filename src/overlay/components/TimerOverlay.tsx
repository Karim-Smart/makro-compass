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

function fmtCountdown(targetMs: number | null, now: number): { text: string; urgent: boolean } {
  if (targetMs === null) return { text: '--:--', urgent: false }
  const remaining = Math.max(0, targetMs - now)
  const s = Math.floor(remaining / 1000)
  const m = Math.floor(s / 60)
  const ss = s % 60
  return {
    text: `${m}:${ss.toString().padStart(2, '0')}`,
    urgent: remaining > 0 && remaining < 30_000,
  }
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
      className="rounded-xl overflow-hidden animate-fade-in min-w-[160px]"
      style={{
        background: 'rgba(8, 10, 18, 0.85)',
        border: `1px solid ${colors.border}`,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
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
          const { text, urgent } = fmtCountdown(timer.nextSpawn, now)

          return (
            <div key={key} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-sm leading-none">{icon}</span>
                <span className="text-[11px] font-medium" style={{ color: colors.text, opacity: 0.75 }}>
                  {label}
                </span>
              </div>

              {isDead ? (
                <span
                  className="text-xs font-mono font-black"
                  style={{
                    color: urgent ? '#ef4444' : '#94a3b8',
                    animation: urgent ? 'pulseOpacity 0.8s ease-in-out infinite' : 'none',
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

      <style>{`
        @keyframes pulseOpacity {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
