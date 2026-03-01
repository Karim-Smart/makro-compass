import type { WinConditionData } from '../../../shared/types'

interface Props {
  data: WinConditionData
  colors: { bg: string; text: string; accent: string; border: string; glow: string }
}

function getTrendIcon(trend: WinConditionData['trend']): string {
  switch (trend) {
    case 'up': return '↑'
    case 'down': return '↓'
    default: return '→'
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

  return (
    <div className="px-3 py-2 h-full flex flex-col justify-center gap-1">
      {/* Ligne 1 : % victoire + tendance */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono font-black text-xl leading-none" style={{ color: winColor }}>
            {data.winProbability}%
          </span>
          <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: c.text, opacity: 0.35 }}>
            win
          </span>
        </div>
        <span
          className="text-sm font-black"
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
        <span className="text-[8px] leading-tight line-clamp-1" style={{ color: c.text, opacity: 0.55 }}>
          {data.nextAction}
        </span>
      </div>
    </div>
  )
}
