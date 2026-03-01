import { useState } from 'react'
import { IPC } from '../../../shared/ipc-channels'
import type { DraftOracleRequest, DraftOracleResponse, DraftPick, CoachingStyle } from '../../../shared/types'
import FeatureLock from './FeatureLock'

interface Props {
  myTeam: DraftPick[]
  theirTeam: DraftPick[]
  assignedPosition: string
  style: CoachingStyle
  colors: { bg: string; text: string; accent: string; border: string }
}

export default function DraftOraclePanel({ myTeam, theirTeam, assignedPosition, style, colors: c }: Props) {
  const [result, setResult] = useState<DraftOracleResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalPicks = [...myTeam, ...theirTeam].filter((p) => p.completed && p.championName).length
  const canAnalyze = totalPicks >= 3

  const handleAnalyze = async () => {
    if (!canAnalyze || loading) return
    setLoading(true)
    setError(null)
    try {
      const req: DraftOracleRequest = { myTeam, theirTeam, assignedPosition, style }
      const response = await window.electronAPI.invoke(IPC.DRAFT_ORACLE, req) as DraftOracleResponse | null
      if (response) {
        setResult(response)
      } else {
        setError('Analyse indisponible')
      }
    } catch (err) {
      setError((err as Error).message ?? 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <FeatureLock feature="draft_oracle">
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: `1px solid ${c.border}`, background: `linear-gradient(160deg, ${c.bg} 0%, ${c.border}30 100%)` }}
      >
        {/* Header */}
        <div
          className="px-4 py-2.5 flex items-center justify-between"
          style={{ borderBottom: `1px solid ${c.border}50` }}
        >
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4" style={{ color: c.accent }}>
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span className="text-xs font-black uppercase tracking-wider" style={{ color: c.accent }}>
              AI Draft Oracle
            </span>
            <span className="text-[8px] px-1.5 py-0.5 rounded font-black" style={{ backgroundColor: '#9B6EF320', color: '#9B6EF3' }}>
              PRO
            </span>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={!canAnalyze || loading}
            className="px-3 py-1 rounded-lg text-[10px] font-bold transition-all disabled:opacity-30"
            style={{
              backgroundColor: canAnalyze ? c.accent : `${c.border}50`,
              color: canAnalyze ? c.bg : c.text,
            }}
          >
            {loading ? 'Analyse...' : 'Analyser avec l\'IA'}
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-3">
          {!result && !loading && !error && (
            <p className="text-[10px] italic" style={{ color: c.text, opacity: 0.35 }}>
              {canAnalyze
                ? 'Clique sur "Analyser" pour obtenir des suggestions IA'
                : 'Sélectionne au moins 3 champions pour activer l\'analyse'}
            </p>
          )}

          {loading && (
            <div className="flex flex-col gap-2 animate-pulse">
              <div className="h-3 rounded w-3/4" style={{ backgroundColor: `${c.border}60` }} />
              <div className="h-3 rounded w-1/2" style={{ backgroundColor: `${c.border}40` }} />
              <div className="h-3 rounded w-2/3" style={{ backgroundColor: `${c.border}30` }} />
            </div>
          )}

          {error && (
            <p className="text-[10px]" style={{ color: '#ef4444' }}>{error}</p>
          )}

          {result && !loading && (
            <div className="flex flex-col gap-3">
              {/* Analyse */}
              <p className="text-xs leading-relaxed" style={{ color: c.text, opacity: 0.8 }}>
                {result.analysis}
              </p>

              {/* Suggestions */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: c.accent, opacity: 0.5 }}>
                  Suggestions
                </span>
                {result.suggestions.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
                    style={{ backgroundColor: `${c.border}30` }}
                  >
                    <span className="font-black text-sm" style={{ color: c.accent }}>{s.champion}</span>
                    <span className="flex-1 text-[10px]" style={{ color: c.text, opacity: 0.6 }}>{s.reason}</span>
                    <span
                      className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: s.score >= 80 ? '#22c55e20' : s.score >= 60 ? '#f59e0b20' : '#ef444420',
                        color: s.score >= 80 ? '#22c55e' : s.score >= 60 ? '#f59e0b' : '#ef4444',
                      }}
                    >
                      {s.score}%
                    </span>
                  </div>
                ))}
              </div>

              {/* Win conditions */}
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: c.accent, opacity: 0.5 }}>
                  Win conditions
                </span>
                <ul className="mt-1">
                  {result.winConditions.map((wc, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[10px] leading-relaxed" style={{ color: c.text, opacity: 0.65 }}>
                      <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: c.accent }} />
                      {wc}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </FeatureLock>
  )
}
