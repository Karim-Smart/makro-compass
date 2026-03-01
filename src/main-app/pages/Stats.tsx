import { useEffect, useState } from 'react'
import { useCoachingStore } from '../stores/coachingStore'
import { COACHING_STYLES } from '../../../shared/constants'
import { IPC } from '../../../shared/ipc-channels'

interface StoredAdvice {
  timestamp: number
  style: string
  gameTime: number
  priority: string
  text: string
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${m}:${ss.toString().padStart(2, '0')}`
}

function fmtDate(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
    + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

const PRIORITY_CFG = {
  high:   { color: '#ef4444', label: 'Urgent', bg: '#ef444418', dot: '⚡' },
  medium: { color: '#f59e0b', label: 'Moyen',  bg: '#f59e0b18', dot: '●' },
  low:    { color: '#6b7280', label: 'Info',   bg: '#6b728018', dot: '○' },
} as const

type Priority = keyof typeof PRIORITY_CFG
type Filter = 'all' | Priority

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all',    label: 'Tous'     },
  { id: 'high',   label: '⚡ Urgent' },
  { id: 'medium', label: '● Moyen'  },
  { id: 'low',    label: '○ Info'   },
]

export default function Stats() {
  const { selectedStyle } = useCoachingStore()
  const style = COACHING_STYLES[selectedStyle]
  const c = style.colors

  const [history, setHistory] = useState<StoredAdvice[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    window.electronAPI.invoke(IPC.ADVICE_HISTORY)
      .then((data) => setHistory((data as StoredAdvice[]) ?? []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? history : history.filter((a) => a.priority === filter)

  return (
    <div className="flex flex-col h-full">

      {/* ─── Header ─── */}
      <div className="px-5 pt-5 pb-0 flex-shrink-0">
        <div className="flex items-end justify-between mb-4">
          <div>
            <h1 className="text-base font-black text-white tracking-tight">Historique</h1>
            <p className="text-[10px] mt-0.5" style={{ color: c.text, opacity: 0.3 }}>
              {history.length} conseil{history.length !== 1 ? 's' : ''} au total
            </p>
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex gap-1.5 flex-wrap pb-4">
          {FILTERS.map(({ id, label }) => {
            const active = filter === id
            return (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className="px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-150"
                style={active ? {
                  backgroundColor: c.accent,
                  color: c.bg,
                  boxShadow: `0 0 12px ${c.accent}40`,
                } : {
                  backgroundColor: `${c.border}60`,
                  color: c.text,
                  opacity: 0.6,
                }}
              >
                {label}
              </button>
            )
          })}
          {filter !== 'all' && (
            <span className="ml-1 text-[10px] self-center" style={{ color: c.text, opacity: 0.3 }}>
              {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Séparateur */}
        <div className="h-px -mx-5" style={{ backgroundColor: c.border }} />
      </div>

      {/* ─── Liste ─── */}
      <div className="flex-1 overflow-auto px-5 py-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl h-[72px] animate-pulse"
                style={{ backgroundColor: c.border, opacity: 0.4 }}
              />
            ))}
          </div>

        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center select-none">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 mb-3"
              style={{ color: c.text, opacity: 0.15 }}>
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="font-semibold text-sm" style={{ color: c.text, opacity: 0.3 }}>
              {filter !== 'all' ? 'Aucun conseil dans cette catégorie' : 'Aucun conseil enregistré'}
            </p>
            {filter === 'all' && (
              <p className="text-xs mt-1" style={{ color: c.text, opacity: 0.2 }}>
                Lance une partie pour voir l'historique ici.
              </p>
            )}
          </div>

        ) : (
          <div className="space-y-2">
            {filtered.map((advice, idx) => {
              const pConf = PRIORITY_CFG[advice.priority as Priority] ?? PRIORITY_CFG.medium
              return (
                <div
                  key={idx}
                  className="rounded-xl p-4 relative"
                  style={{
                    background: `linear-gradient(135deg, ${c.bg} 0%, ${c.border}30 100%)`,
                    border: `1px solid ${c.border}`,
                    borderLeftColor: pConf.color + 'A0',
                    borderLeftWidth: 3,
                  }}
                >
                  {/* Meta */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span
                      className="text-[9px] font-black px-1.5 py-0.5 rounded tracking-widest"
                      style={{ backgroundColor: `${c.accent}20`, color: c.accent }}
                    >
                      {advice.style}
                    </span>
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: pConf.bg, color: pConf.color }}
                    >
                      {pConf.dot} {pConf.label.toUpperCase()}
                    </span>
                    <span className="text-[9px] font-mono" style={{ color: c.text, opacity: 0.3 }}>
                      {fmtTime(advice.gameTime)} de jeu
                    </span>
                    <span className="text-[9px] font-mono ml-auto" style={{ color: c.text, opacity: 0.22 }}>
                      {fmtDate(advice.timestamp)}
                    </span>
                  </div>

                  {/* Texte */}
                  <p className="text-xs leading-relaxed" style={{ color: c.text, opacity: 0.85 }}>
                    {advice.text}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
