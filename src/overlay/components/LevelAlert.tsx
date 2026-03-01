import type { GameData } from '../../../shared/types'

interface Props {
  gameData: GameData
  colors: { bg: string; text: string; accent: string; border: string }
}

const POSITION_FR: Record<string, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MIDDLE: 'Mid',
  BOTTOM: 'Bot',
  UTILITY: 'Support',
}

export function LevelAlert({ gameData, colors }: Props) {
  const { matchup } = gameData
  if (!matchup || matchup.levelDiff === 0) return null

  const ahead = matchup.levelDiff > 0
  const diff = Math.abs(matchup.levelDiff)
  const posLabel = POSITION_FR[matchup.position] ?? matchup.position

  return (
    <div
      className="rounded-xl overflow-hidden animate-fade-in"
      style={{
        background: 'rgba(8, 10, 18, 0.92)',
        border: `1px solid ${ahead ? '#22c55e40' : '#ef444440'}`,
        boxShadow: ahead
          ? '0 0 12px rgba(34,197,94,0.15)'
          : '0 0 12px rgba(239,68,68,0.15)',
      }}
    >
      {/* Barre d'accent */}
      <div
        className="h-0.5 w-full"
        style={{
          background: ahead
            ? 'linear-gradient(90deg, #22c55e, transparent)'
            : 'linear-gradient(90deg, #ef4444, transparent)',
        }}
      />

      <div className="px-4 py-2.5">
        {/* Header */}
        <div className="flex items-center justify-between mb-1.5">
          <span
            className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: ahead ? '#22c55e20' : '#ef444420',
              color: ahead ? '#22c55e' : '#ef4444',
            }}
          >
            {posLabel} matchup
          </span>
          <span className="text-[9px] font-mono" style={{ color: `${colors.text}50` }}>
            Niv {gameData.level} vs {matchup.level}
          </span>
        </div>

        {/* Message */}
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none">
            {ahead ? '⬆' : '⬇'}
          </span>
          <p className="text-[13px] font-semibold leading-snug" style={{
            color: ahead ? '#86efac' : '#fca5a5',
          }}>
            {ahead
              ? `+${diff} niveau${diff > 1 ? 'x' : ''} sur ${matchup.champion} — ${diff >= 2 ? 'avantage massif, force le trade/dive' : 'pression de niveau, trade avantageux'}`
              : `-${diff} niveau${diff > 1 ? 'x' : ''} vs ${matchup.champion} — ${diff >= 2 ? 'danger ! joue safe, ne trade pas' : 'prudence, évite les all-in'}`
            }
          </p>
        </div>
      </div>
    </div>
  )
}
