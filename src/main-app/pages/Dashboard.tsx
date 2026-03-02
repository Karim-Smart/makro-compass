import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../stores/gameStore'
import { useCoachingStore } from '../stores/coachingStore'
import { useSubscriptionStore } from '../stores/subscriptionStore'
import { useOverlayStore } from '../stores/overlayStore'
import { useSettingsStore } from '../stores/settingsStore'
import { COACHING_STYLES, TIER_LABELS } from '../../../shared/constants'
import { IPC } from '../../../shared/ipc-channels'
import { getChampionIconUrl } from '../../../shared/champion-images'
import { computeStreak, computeRecentForm } from '../../../shared/game-analysis'
import type { RankedGame } from '../../../shared/types'

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

export default function Dashboard() {
  const navigate = useNavigate()
  const { isInGame, champion, gameData } = useGameStore()
  const { selectedStyle, lastAdvice, isGenerating } = useCoachingStore()
  const { status: subStatus } = useSubscriptionStore()
  const { isVisible, toggle } = useOverlayStore()
  const { settings } = useSettingsStore()
  const tier = subStatus?.tier ?? 'free'
  const enabledPanels = Object.entries(settings.overlayPanels ?? {})
    .filter(([, on]) => on).map(([key]) => key)
  const style = COACHING_STYLES[selectedStyle]
  const c = style.colors

  // Données classées pour la session
  const [todayGames, setTodayGames] = useState<RankedGame[]>([])
  const [sessionKey, setSessionKey] = useState(0)

  useEffect(() => {
    window.electronAPI.invoke(IPC.RANKED_HISTORY, 'RANKED_SOLO')
      .then((data) => {
        const all = (data as RankedGame[]) ?? []
        const start = new Date(); start.setHours(0, 0, 0, 0)
        setTodayGames(all.filter(g => g.timestamp >= start.getTime()))
      })
      .catch(() => {})
  }, [sessionKey])

  // Refresh la session quand une partie se termine
  useEffect(() => {
    const onImportDone = () => setSessionKey((k) => k + 1)
    window.electronAPI.on(IPC.RANKED_IMPORT_DONE, onImportDone)
    return () => window.electronAPI.removeListener(IPC.RANKED_IMPORT_DONE, onImportDone)
  }, [])

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

  // Session du jour
  const todayWins = todayGames.filter(g => g.result === 'win').length
  const todayLosses = todayGames.length - todayWins
  const todayWr = todayGames.length > 0 ? Math.round((todayWins / todayGames.length) * 100) : null
  const todayStreak = computeStreak(todayGames)

  // Kill participation live
  const kp = gameData && gameData.teamKills > 0
    ? Math.round(((gameData.kda.kills + gameData.kda.assists) / gameData.teamKills) * 100)
    : null

  return (
    <div className="flex flex-col gap-3 p-5 h-full overflow-auto" style={{ background: 'linear-gradient(180deg, #010A13 0%, #091428 100%)' }}>

      {/* ─── STATUS BANNER ─── */}
      <div
        className="clip-bevel-lg px-5 py-4 flex items-center justify-between flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, ${c.bg} 0%, ${c.border}60 100%)`,
          border: `1px solid ${isInGame ? c.accent + '70' : c.border}`,
          boxShadow: isInGame ? `0 0 28px ${c.accent}18` : 'none',
          transition: 'box-shadow 0.5s ease, border-color 0.5s ease',
        }}
      >
        <div className="flex items-center gap-3.5">
          {/* Icône champion ou dot statut */}
          {isInGame && champion ? (
            <div className="w-10 h-10 clip-hex overflow-hidden flex-shrink-0" style={{ border: `1.5px solid ${c.accent}60` }}>
              <img
                src={getChampionIconUrl(champion)}
                alt={champion}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            </div>
          ) : (
            <div className="relative flex-shrink-0 w-3 h-3">
              <div className="absolute inset-0 rounded-full" style={{ backgroundColor: '#374151' }} />
            </div>
          )}

          <div>
            <div
              className="text-[9px] font-black uppercase tracking-[0.22em] leading-none mb-0.5"
              style={{ color: isInGame ? '#22c55e' : '#4b5563' }}
            >
              {isInGame ? '● En partie' : '○ Hors partie'}
            </div>
            {isInGame && champion
              ? <div className="font-bold text-base text-white leading-tight">{champion}</div>
              : <div className="text-xs text-gray-600">Lance League of Legends pour commencer</div>
            }
          </div>
        </div>

        {isInGame && gameData ? (
          <div className="flex items-center gap-4">
            {/* Phase de jeu */}
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wider" style={{ color: c.text, opacity: 0.35 }}>Phase</div>
              <div className="font-mono font-bold text-sm" style={{ color: c.text }}>
                {gameData.gameTime < 840 ? 'EARLY' : gameData.gameTime < 1500 ? 'MID' : 'LATE'}
              </div>
            </div>
            {/* Timer */}
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wider" style={{ color: c.text, opacity: 0.35 }}>Durée</div>
              <div className="font-mono font-black text-2xl leading-none" style={{ color: c.accent }}>
                {formatGameTime(gameData.gameTime)}
              </div>
            </div>
          </div>
        ) : (
          /* Session du jour — hors partie */
          todayGames.length > 0 ? (
            <div className="flex items-center gap-4">
              {/* Streak */}
              {todayStreak.count >= 2 && todayStreak.type !== 'none' && (
                <div className="text-right">
                  <div
                    className="text-[9px] font-black uppercase tracking-widest leading-none mb-0.5"
                    style={{ color: todayStreak.type === 'win' ? '#22c55e' : '#ef4444', opacity: 0.7 }}
                  >
                    {todayStreak.type === 'win' ? '🔥 Streak' : '❄️ Streak'}
                  </div>
                  <div
                    className="font-mono font-black text-xl leading-none"
                    style={{ color: todayStreak.type === 'win' ? '#22c55e' : '#ef4444' }}
                  >
                    {todayStreak.count}
                  </div>
                </div>
              )}
              <div className="text-right">
                <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: c.text, opacity: 0.35 }}>Aujourd'hui</div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono font-black text-lg leading-none" style={{ color: '#22c55e' }}>{todayWins}W</span>
                  <span className="font-mono font-black text-lg leading-none" style={{ color: '#ef4444' }}>{todayLosses}L</span>
                  {todayWr !== null && (
                    <span className="text-[10px] font-mono" style={{ color: todayWr >= 50 ? '#22c55e' : '#ef4444' }}>
                      {todayWr}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : null
        )}
      </div>

      {/* ─── STATS EN PARTIE ─── */}
      {isInGame && gameData ? (
        <div className="grid grid-cols-5 gap-2 flex-shrink-0 stagger-enter">
          {[
            {
              label: 'KDA',
              value: `${gameData.kda.kills}/${gameData.kda.deaths}/${gameData.kda.assists}`,
              sub: kdaRatio,
              accentOverride: gameData.kda.deaths === 0
                ? '#22c55e'
                : parseFloat(kdaRatio) >= 4 ? '#22c55e' : parseFloat(kdaRatio) >= 2 ? c.accent : '#ef4444',
            },
            { label: 'CS/min', value: csPerMin, sub: `${gameData.cs} CS`, accentOverride: null },
            { label: 'Gold', value: `${(gameData.gold / 1000).toFixed(1)}k`, sub: `${gameData.gold.toLocaleString()}`, accentOverride: null },
            { label: 'Niveau', value: String(gameData.level), sub: gameData.champion, accentOverride: null },
            { label: 'KP%', value: kp !== null ? `${kp}%` : '—', sub: `${gameData.kda.kills + gameData.kda.assists} participations`, accentOverride: null },
          ].map(({ label, value, sub, accentOverride }) => (
            <div
              key={label}
              className="clip-bevel px-3 py-3 text-center hextech-card"
              style={{
                background: `linear-gradient(160deg, ${c.bg} 0%, ${c.border}50 100%)`,
                border: `1px solid ${c.border}`,
              }}
            >
              <div className="text-[9px] font-black uppercase tracking-[0.18em] mb-1.5" style={{ color: c.text, opacity: 0.38 }}>
                {label}
              </div>
              <div className="font-mono font-black text-base leading-none" style={{ color: accentOverride ?? c.accent }}>
                {value}
              </div>
              <div className="text-[9px] font-mono mt-1 truncate" style={{ color: c.text, opacity: 0.42 }}>
                {sub}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Grille vide stylée */
        <div className="grid grid-cols-5 gap-2 flex-shrink-0 pointer-events-none select-none">
          {['KDA', 'CS/min', 'Gold', 'Niveau', 'KP%'].map(l => (
            <div
              key={l}
              className="clip-bevel px-3 py-3 text-center opacity-20"
              style={{ border: `1px solid ${c.border}`, background: c.bg }}
            >
              <div className="text-[9px] font-black uppercase tracking-[0.18em] mb-1.5" style={{ color: c.text, opacity: 0.5 }}>{l}</div>
              <div className="font-mono font-black text-base leading-none" style={{ color: c.text }}>—</div>
            </div>
          ))}
        </div>
      )}

      {/* ─── SESSION DU JOUR — hors partie ─── */}
      {!isInGame && todayGames.length === 0 && (
        <div
          className="clip-bevel px-4 py-3 flex items-center gap-3 flex-shrink-0"
          style={{ background: `${c.bg}`, border: `1px solid ${c.border}50` }}
        >
          <span className="text-[9px] font-black uppercase tracking-widest flex-shrink-0" style={{ color: c.text, opacity: 0.25 }}>
            Aucune partie aujourd'hui
          </span>
        </div>
      )}

      {/* Session détaillée du jour */}
      {!isInGame && todayGames.length > 0 && (() => {
        const form = computeRecentForm(todayGames, todayGames.length)
        const avgKda = todayGames.reduce((a, g) => a + (g.deaths === 0 ? (g.kills + g.assists) : (g.kills + g.assists) / g.deaths), 0) / todayGames.length
        const avgCsMin = todayGames.reduce((a, g) => a + (g.gameTime > 0 ? g.cs / (g.gameTime / 60) : 0), 0) / todayGames.length

        // Champion le plus joué
        const champCounts: Record<string, { count: number; wins: number }> = {}
        for (const g of todayGames) {
          if (!champCounts[g.champion]) champCounts[g.champion] = { count: 0, wins: 0 }
          champCounts[g.champion].count++
          if (g.result === 'win') champCounts[g.champion].wins++
        }
        const topChamp = Object.entries(champCounts).sort(([, a], [, b]) => b.count - a.count)[0]

        return (
          <div
            className="clip-bevel-lg px-4 py-3 flex-shrink-0"
            style={{ background: `linear-gradient(160deg, ${c.bg} 0%, ${c.border}30 100%)`, border: `1px solid ${c.border}` }}
          >
            {/* Sparkline + stats */}
            <div className="flex items-center gap-4">
              {/* Sparkline wins/losses */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {form.map((w, i) => (
                  <div
                    key={i}
                    className="w-2.5 h-4 clip-bevel-sm"
                    style={{
                      backgroundColor: w === 1 ? '#22c55e' : '#ef4444',
                      opacity: 0.7,
                    }}
                  />
                ))}
              </div>

              {/* Stats moyennes */}
              <div className="flex items-center gap-3 ml-auto">
                <div className="text-center">
                  <div className="text-[7px] font-black uppercase tracking-widest" style={{ color: c.text, opacity: 0.3 }}>KDA moy</div>
                  <div className="text-xs font-mono font-bold" style={{ color: avgKda >= 3 ? '#22c55e' : avgKda >= 1.5 ? c.accent : '#ef4444' }}>
                    {avgKda.toFixed(1)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[7px] font-black uppercase tracking-widest" style={{ color: c.text, opacity: 0.3 }}>CS/min</div>
                  <div className="text-xs font-mono font-bold" style={{ color: c.accent }}>
                    {avgCsMin.toFixed(1)}
                  </div>
                </div>
                {topChamp && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 clip-hex overflow-hidden flex-shrink-0">
                      <img
                        src={getChampionIconUrl(topChamp[0])}
                        alt={topChamp[0]}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    </div>
                    <div>
                      <div className="text-[8px] font-bold" style={{ color: c.text }}>{topChamp[0]}</div>
                      <div className="text-[7px] font-mono" style={{ color: c.text, opacity: 0.5 }}>
                        {topChamp[1].count}G · {Math.round((topChamp[1].wins / topChamp[1].count) * 100)}%
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ─── DERNIER CONSEIL ─── */}
      <div
        className="clip-bevel-lg p-4 flex-1 min-h-[90px]"
        style={{
          background: `linear-gradient(160deg, ${c.bg} 0%, ${c.border}35 100%)`,
          border: `1px solid ${c.border}`,
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-0.5 h-[14px] rounded-full flex-shrink-0" style={{ backgroundColor: c.accent }} />
          <span className="text-[9px] font-black uppercase tracking-[0.22em]" style={{ color: c.text, opacity: 0.4 }}>
            Dernier conseil
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
                className="text-[9px] font-black px-2 py-0.5 clip-bevel-sm tracking-widest"
                style={{ backgroundColor: `${c.accent}20`, color: c.accent }}
              >
                {lastAdvice.style}
              </span>
              <span
                className="text-[9px] font-bold px-2 py-0.5 clip-bevel-sm"
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
              : 'Lance une partie pour recevoir des conseils.'}
          </p>
        )}
      </div>

      {/* ─── ABONNEMENT + OVERLAY ─── */}
      <div className="grid grid-cols-2 gap-3 flex-shrink-0">

        {/* Abonnement */}
        <div
          className="clip-bevel-lg p-4"
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
              className="text-[9px] font-black px-2 py-0.5 clip-bevel-sm tracking-widest uppercase"
              style={{
                backgroundColor: tier === 'elite' ? '#FFD700' : tier === 'pro' ? '#C89B3C' : c.accent,
                color: tier === 'elite' ? '#000' : tier === 'pro' ? '#fff' : c.bg,
              }}
            >
              {TIER_LABELS[tier]}
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
          {tier === 'free' && (
            <button
              onClick={() => navigate('/pricing')}
              className="mt-2 w-full py-1.5 clip-bevel-sm text-[10px] font-bold transition-all hover:scale-[1.02]"
              style={{ backgroundColor: '#C89B3C20', color: '#C89B3C', border: '1px solid #C89B3C40' }}
            >
              Passer à Pro
            </button>
          )}
        </div>

        {/* Overlay toggle */}
        <button
          onClick={toggle}
          className="clip-bevel-lg p-4 text-left transition-all duration-200 active:scale-[0.97]"
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
              className="text-[9px] px-1.5 py-0.5 clip-bevel-sm font-mono border"
              style={{ borderColor: c.border, color: c.text, opacity: 0.35 }}
            >
              {settings.hotkey}
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
              {isVisible ? 'Overlay actif' : 'Overlay masqué'}
            </span>
          </div>
          {/* Panneaux actifs */}
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            {isVisible && enabledPanels.map(p => (
              <span key={p} className="text-[8px] px-1.5 py-0.5 clip-bevel-sm font-mono" style={{ backgroundColor: `${c.accent}15`, color: c.accent }}>
                {p}
              </span>
            ))}
          </div>
        </button>

      </div>
    </div>
  )
}
