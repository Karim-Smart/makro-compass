import type { MatchupBriefingData } from '../../../shared/types'

interface Props {
  data: MatchupBriefingData
  colors: { bg: string; text: string; accent: string; border: string; glow: string }
}

function getDangerColor(level: string): string {
  switch (level) {
    case 'high': return '#ef4444'
    case 'medium': return '#f59e0b'
    default: return '#22c55e'
  }
}

function getDangerLabel(level: string): string {
  switch (level) {
    case 'high': return 'DANGER'
    case 'medium': return 'PRUDENCE'
    default: return 'SAFE'
  }
}

function getAdvantageIcon(adv: string): string {
  switch (adv) {
    case 'you': return '✓'
    case 'enemy': return '✗'
    default: return '='
  }
}

function getAdvantageColor(adv: string): string {
  switch (adv) {
    case 'you': return '#22c55e'
    case 'enemy': return '#ef4444'
    default: return '#f59e0b'
  }
}

export function MatchupBriefingCard({ data, colors: c }: Props) {
  const dangerColor = getDangerColor(data.dangerLevel)

  return (
    <div className="px-3 py-1.5 flex flex-col gap-1 overflow-hidden overlay-glass clip-bevel" style={{ maxHeight: 160 }}>
      {/* Header : MATCHUP + danger level */}
      <div className="flex items-center justify-between">
        <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: c.accent, opacity: 0.5 }}>
          matchup briefing
        </span>
        <span
          className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded"
          style={{ color: '#fff', background: dangerColor }}
        >
          {getDangerLabel(data.dangerLevel)}
        </span>
      </div>

      {/* Summary — max 2 lignes */}
      <p className="text-[10px] font-semibold leading-tight line-clamp-2" style={{ color: c.accent }}>
        {data.summary}
      </p>

      {/* Power spikes — 3 phases en ligne */}
      <div className="flex gap-2">
        {data.powerSpikes.map((spike) => (
          <div key={spike.phase} className="flex items-center gap-1">
            <span className="text-[8px] font-black uppercase" style={{ color: c.text, opacity: 0.4 }}>
              {spike.phase === 'early' ? 'E' : spike.phase === 'mid' ? 'M' : 'L'}
            </span>
            <span
              className="text-[10px] font-black"
              style={{ color: getAdvantageColor(spike.advantage) }}
            >
              {getAdvantageIcon(spike.advantage)}
            </span>
          </div>
        ))}
      </div>

      {/* Key tip — max 2 lignes */}
      <p className="text-[9px] leading-tight line-clamp-2" style={{ color: c.text, opacity: 0.7 }}>
        {data.keyTip}
      </p>
    </div>
  )
}
