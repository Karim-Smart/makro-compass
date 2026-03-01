import { useGameStore } from '../stores/gameStore'
import { useCoachingStore } from '../stores/coachingStore'
import { useSubscriptionStore } from '../stores/subscriptionStore'
import { useOverlayStore } from '../stores/overlayStore'
import { COACHING_STYLES } from '../../../shared/constants'

function formatGameTime(s: number): string {
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${m}:${ss.toString().padStart(2, '0')}`
}

const PRIORITY_META = {
  high:   { color: '#ef4444', label: 'URGENT',  bg: '#ef444418' },
  medium: { color: '#f59e0b', label: 'MOYEN',   bg: '#f59e0b18' },
  low:    { color: '#6b7280', label: 'INFO',     bg: '#6b728018' },
} as const

interface StatCardProps {
  label: string
  value: string
  sub: string
  accent: string
  border: string
  bg: string
  text: string
}

function StatCard({ label, value, sub, accent, border, bg, text }: StatCardProps) {
  return (
    <div
      className="rounded-xl px-3 py-3 text-center"
      style={{
        background: `linear-gradient(160deg, ${bg} 0%, ${border}50 100%)`,
        border: `1px solid ${border}`,
      }}
    >
      <div className="text-[9px] font-black uppercase tracking-[0.18em] mb-1.5" style={{ color: text, opacity: 0.38 }}>
        {label}
      </div>
      <div className="font-mono font-black text-xl leading-none" style={{ color: accent }}>
        {value}
      </div>
      <div className="text-[10px] font-mono mt-1" style={{ color: text, opacity: 0.42 }}>
        {sub}
      </div>
    </div>
  )
}

function EmptyStatCard({ label, border, bg, text }: { label: string; border: string; bg: string; text: string }) {
  return (
    <div
      className="rounded-xl px-3 py-3 text-center opacity-20"
      style={{ border: `1px solid ${border}`, background: bg }}
    >
      <div className="text-[9px] font-black uppercase tracking-[0.18em] mb-1.5" style={{ color: text, opacity: 0.5 }}>
        {label}
      </div>
      <div className="font-mono font-black text-xl leading-none" style={{ color: text }}>—</div>
    </div>
  )
}

export default function Dashboard() {
  const { isInGame, champion, gameData } = useGameStore()
  const { selectedStyle, lastAdvice, isGenerating } = useCoachingStore()
  const { status: subStatus } = useSubscriptionStore()
  const { isVisible, toggle } = useOverlayStore()
  const style = COACHING_STYLES[selectedStyle]
  const c = style.colors

  const csPerMin = gameData && gameData.gameTime > 0
    ? (gameData.cs / (gameData.gameTime / 60)).toFixed(1)
    : '—'

  const kdaRatio = gameData
    ? gameData.kda.deaths === 0
      ? 'Perfect'
      : ((gameData.kda.kills + gameData.kda.assists) / gameData.kda.deaths).toFixed(2)
    : '—'

  const quotaPct = subStatus?.quotaMax
    ? Math.min(100, (subStatus.quotaUsed / subStatus.quotaMax) * 100)
    : 0

  const advicePriority = lastAdvice?.priority as keyof typeof PRIORITY_META | undefined
  const pMeta = advicePriority ? PRIORITY_META[advicePriority] : PRIORITY_META.medium

  return (
    <div className="flex flex-col gap-3 p-5 h-full overflow-auto">

      {/* ─── STATUS BANNER ─── */}
      <div
        className="rounded-xl px-5 py-4 flex items-center justify-between flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, ${c.bg} 0%, ${c.border}60 100%)`,
          border: `1px solid ${isInGame ? c.accent + '70' : c.border}`,
          boxShadow: isInGame ? `0 0 28px ${c.accent}18` : 'none',
          transition: 'box-shadow 0.5s ease, border-color 0.5s ease',
        }}
      >
        <div className="flex items-center gap-3.5">
          {/* Point de statut animé */}
          <div className="relative flex-shrink-0 w-3 h-3">
            <div
              className="absolute inset-0 rounded-full"
              style={{ backgroundColor: isInGame ? '#22c55e' : '#374151' }}
            />
            {isInGame && (
              <div
                className="absolute inset-0 rounded-full animate-ping opacity-50"
                style={{ backgroundColor: '#22c55e' }}
              />
            )}
          </div>

          <div>
            <div
              className="text-[9px] font-black uppercase tracking-[0.22em] leading-none mb-0.5"
              style={{ color: isInGame ? '#22c55e' : '#4b5563' }}
            >
              {isInGame ? 'En partie' : 'Hors partie'}
            </div>
            {isInGame && champion
              ? <div className="font-bold text-base text-white leading-tight">{champion}</div>
              : <div className="text-xs text-gray-600">Lance League of Legends pour commencer</div>
            }
          </div>
        </div>

        {isInGame && gameData && (
          <div className="text-right flex-shrink-0">
            <div className="text-[9px] uppercase tracking-wider text-gray-600">Durée</div>
            <div className="font-mono font-black text-2xl leading-none" style={{ color: c.accent }}>
              {formatGameTime(gameData.gameTime)}
            </div>
          </div>
        )}
      </div>

      {/* ─── STATS (en partie) ─── */}
      {isInGame && gameData ? (
        <div className="grid grid-cols-4 gap-2 flex-shrink-0">
          <StatCard label="KDA"     value={`${gameData.kda.kills}/${gameData.kda.deaths}/${gameData.kda.assists}`} sub={kdaRatio}                           accent={c.accent} border={c.border} bg={c.bg} text={c.text} />
          <StatCard label="CS / Min" value={csPerMin}                                                              sub={`${gameData.cs} CS`}                accent={c.accent} border={c.border} bg={c.bg} text={c.text} />
          <StatCard label="Gold"     value={`${(gameData.gold / 1000).toFixed(1)}k`}                               sub={gameData.gold.toLocaleString()}      accent={c.accent} border={c.border} bg={c.bg} text={c.text} />
          <StatCard label="Niveau"   value={String(gameData.level)}                                                sub="actuel"                             accent={c.accent} border={c.border} bg={c.bg} text={c.text} />
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2 flex-shrink-0 pointer-events-none select-none">
          {['KDA', 'CS / Min', 'Gold', 'Niveau'].map(l => (
            <EmptyStatCard key={l} label={l} border={c.border} bg={c.bg} text={c.text} />
          ))}
        </div>
      )}

      {/* ─── DERNIER CONSEIL IA ─── */}
      <div
        className="rounded-xl p-4 flex-1 min-h-[96px]"
        style={{
          background: `linear-gradient(160deg, ${c.bg} 0%, ${c.border}35 100%)`,
          border: `1px solid ${c.border}`,
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-0.5 h-[14px] rounded-full flex-shrink-0" style={{ backgroundColor: c.accent }} />
          <span className="text-[9px] font-black uppercase tracking-[0.22em]" style={{ color: c.text, opacity: 0.4 }}>
            Dernier conseil IA
          </span>
          {isGenerating && (
            <span className="ml-auto flex items-center gap-1.5 text-[10px] font-semibold" style={{ color: c.accent }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block" style={{ backgroundColor: c.accent }} />
              Génération...
            </span>
          )}
        </div>

        {lastAdvice ? (
          <>
            <p className="text-sm leading-relaxed" style={{ color: c.text }}>
              "{lastAdvice.text}"
            </p>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span
                className="text-[9px] font-black px-2 py-0.5 rounded tracking-widest"
                style={{ backgroundColor: `${c.accent}20`, color: c.accent }}
              >
                {lastAdvice.style}
              </span>
              <span
                className="text-[9px] font-bold px-2 py-0.5 rounded"
                style={{ backgroundColor: pMeta.bg, color: pMeta.color }}
              >
                {pMeta.label}
              </span>
              <span className="text-[9px] font-mono ml-auto" style={{ color: c.text, opacity: 0.3 }}>
                à {formatGameTime(lastAdvice.gameTime)} de jeu
              </span>
            </div>
          </>
        ) : (
          <p className="text-sm italic" style={{ color: c.text, opacity: 0.3 }}>
            {isInGame
              ? 'En attente du premier conseil...'
              : 'Lance une partie pour recevoir des conseils IA.'}
          </p>
        )}
      </div>

      {/* ─── ABONNEMENT + OVERLAY ─── */}
      <div className="grid grid-cols-2 gap-3 flex-shrink-0">

        {/* Abonnement */}
        <div
          className="rounded-xl p-4"
          style={{
            background: `linear-gradient(160deg, ${c.bg} 0%, ${c.border}40 100%)`,
            border: `1px solid ${c.border}`,
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: c.text, opacity: 0.35 }}>
              Abonnement
            </div>
            <span
              className="text-[9px] font-black px-2 py-0.5 rounded tracking-widest uppercase"
              style={{ backgroundColor: c.accent, color: c.bg }}
            >
              {subStatus?.tier ?? 'FREE'}
            </span>
          </div>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="font-mono font-black text-xl" style={{ color: c.accent }}>
              {subStatus?.quotaUsed ?? 0}
            </span>
            <span className="text-xs font-mono" style={{ color: c.text, opacity: 0.35 }}>
              / {subStatus?.quotaMax ?? '∞'}
            </span>
            <span className="text-[9px] ml-1" style={{ color: c.text, opacity: 0.3 }}>conseils</span>
          </div>
          {subStatus?.quotaMax && (
            <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: `${c.border}` }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${quotaPct}%`,
                  backgroundColor: quotaPct >= 90 ? '#ef4444' : c.accent,
                }}
              />
            </div>
          )}
        </div>

        {/* Overlay toggle */}
        <button
          onClick={toggle}
          className="rounded-xl p-4 text-left transition-all duration-200 active:scale-[0.97]"
          style={{
            background: isVisible
              ? `linear-gradient(160deg, ${c.accent}10 0%, ${c.accent}05 100%)`
              : `linear-gradient(160deg, ${c.bg} 0%, ${c.border}40 100%)`,
            border: `1px solid ${isVisible ? c.accent + '55' : c.border}`,
            boxShadow: isVisible ? `0 0 18px ${c.accent}12` : 'none',
            transition: 'all 0.25s ease',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: c.text, opacity: 0.35 }}>
              Overlay
            </div>
            <kbd
              className="text-[9px] px-1.5 py-0.5 rounded font-mono border"
              style={{ borderColor: c.border, color: c.text, opacity: 0.35 }}
            >
              F9
            </kbd>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                backgroundColor: isVisible ? '#22c55e' : '#374151',
                boxShadow: isVisible ? '0 0 6px #22c55e' : 'none',
                transition: 'all 0.3s ease',
              }}
            />
            <span
              className="font-bold text-sm"
              style={{ color: isVisible ? c.accent : '#4b5563' }}
            >
              {isVisible ? 'Visible' : 'Masqué'}
            </span>
          </div>
        </button>

      </div>
    </div>
  )
}
