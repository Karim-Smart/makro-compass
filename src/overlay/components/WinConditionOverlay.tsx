import type { WinConditionData } from '../../../shared/types'

interface Props {
  data: WinConditionData
  colors: { bg: string; text: string; accent: string; border: string; glow: string }
}

function getTrendIcon(trend: WinConditionData['trend']): string {
  switch (trend) {
    case 'up': return '▲'
    case 'down': return '▼'
    default: return '▸'
  }
}

function getTrendColor(trend: WinConditionData['trend']): string {
  switch (trend) {
    case 'up': return '#22c55e'
    case 'down': return '#ef4444'
    default: return '#f59e0b'
  }
}

function getWinColor(pct: number): string {
  if (pct >= 60) return '#22c55e'
  if (pct >= 45) return '#f59e0b'
  return '#ef4444'
}

export function WinConditionOverlay({ data, colors: c }: Props) {
  const winColor = getWinColor(data.winProbability)
  const trendColor = getTrendColor(data.trend)
  const pct = Math.min(100, Math.max(0, data.winProbability))

  return (
    <div className="px-3 py-2 h-full flex flex-col justify-center gap-1.5 overlay-glass clip-bevel animate-fade-in">
      {/* Accent line dorée en haut */}
      <div
        className="absolute top-0 left-[8px] right-[8px] h-[1px]"
        style={{ background: 'linear-gradient(90deg, transparent, #C89B3C50, transparent)' }}
      />

      {/* Ligne 1 : % victoire + barre + tendance */}
      <div className="flex items-center gap-2">
        <span className="font-mono font-black text-xl leading-none" style={{ color: winColor }}>
          {data.winProbability}%
        </span>

        {/* Mini barre de progression */}
        <div className="flex-1 h-1.5 clip-bevel-sm overflow-hidden" style={{ background: '#ffffff08' }}>
          <div
            className="h-full transition-all duration-700 ease-out"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${winColor}80, ${winColor})`,
            }}
          />
        </div>

        <span
          className="text-xs font-black"
          style={{ color: trendColor }}
          title={data.trend === 'up' ? 'En progression' : data.trend === 'down' ? 'En déclin' : 'Stable'}
        >
          {getTrendIcon(data.trend)}
        </span>
      </div>

      {/* Ligne 2 : condition + action */}
      <div className="flex flex-col gap-0.5">
        <span className="text-[9px] font-semibold leading-tight line-clamp-2" style={{ color: c.accent }}>
          {data.primaryCondition}
        </span>
        <span className="text-[8px] leading-tight line-clamp-1" style={{ color: '#A0A7B4', opacity: 0.7 }}>
          ▸ {data.nextAction}
        </span>
      </div>
    </div>
  )
}
