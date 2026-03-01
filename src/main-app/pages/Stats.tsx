import { useEffect, useState } from 'react'
import { useCoachingStore } from '../stores/coachingStore'
import { COACHING_STYLES } from '../../../shared/constants'
import { IPC } from '../../../shared/ipc-channels'
import { getChampionIconUrl } from '../../../shared/champion-images'
import type { RankedGame, RankedQueueType, ReviewTimeline, ReviewEvent } from '../../../shared/types'

type QueueTab = 'RANKED_SOLO' | 'RANKED_FLEX'

function fmtGameTime(s: number): string {
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${m}:${ss.toString().padStart(2, '0')}`
}

function fmtDate(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
    + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours}h`
  const days = Math.floor(hours / 24)
  return `il y a ${days}j`
}

export default function Stats() {
  const { selectedStyle } = useCoachingStore()
  const style = COACHING_STYLES[selectedStyle]
  const c = style.colors

  const [games, setGames] = useState<RankedGame[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<QueueTab>('RANKED_SOLO')
  // refreshKey s'incrémente quand l'import LCU termine → force le rechargement
  const [refreshKey, setRefreshKey] = useState(0)

  // Review : stocke la timeline générée par gameId (null = pas chargé, 'loading' = en cours)
  const [reviews, setReviews] = useState<Record<number, ReviewTimeline | 'loading'>>({})
  // ID de la review ouverte (un seul à la fois)
  const [openReviewId, setOpenReviewId] = useState<number | null>(null)
  // Feedback quand le replay est lancé
  const [launchingReplay, setLaunchingReplay] = useState<number | null>(null)
  // Import manuel en cours
  const [importing, setImporting] = useState(false)

  // Rechargement quand l'onglet change ou quand l'import LCU termine
  useEffect(() => {
    setLoading(true)
    window.electronAPI.invoke(IPC.RANKED_HISTORY, tab)
      .then((data) => setGames((data as RankedGame[]) ?? []))
      .catch(() => setGames([]))
      .finally(() => setLoading(false))
  }, [tab, refreshKey])

  // Écouter la fin de l'import automatique pour rafraîchir sans action utilisateur
  useEffect(() => {
    const onImportDone = () => setRefreshKey((k) => k + 1)
    window.electronAPI.on(IPC.RANKED_IMPORT_DONE, onImportDone)
    return () => window.electronAPI.removeListener(IPC.RANKED_IMPORT_DONE, onImportDone)
  }, [])

  // Génère (ou toggle) la review d'une partie
  async function handleAnalyse(gameId: number) {
    if (openReviewId === gameId) {
      setOpenReviewId(null)
      return
    }
    setOpenReviewId(gameId)
    if (reviews[gameId]) return  // déjà chargé
    setReviews((prev) => ({ ...prev, [gameId]: 'loading' }))
    try {
      const timeline = await window.electronAPI.invoke(IPC.REVIEW_GENERATE, gameId) as ReviewTimeline | null
      if (timeline) {
        setReviews((prev) => ({ ...prev, [gameId]: timeline }))
      } else {
        setReviews((prev) => { const next = { ...prev }; delete next[gameId]; return next })
        setOpenReviewId(null)
      }
    } catch {
      setReviews((prev) => { const next = { ...prev }; delete next[gameId]; return next })
      setOpenReviewId(null)
    }
  }

  // Import manuel depuis le client LoL
  async function handleImport() {
    setImporting(true)
    try {
      await window.electronAPI.invoke(IPC.RANKED_HISTORY_IMPORT)
      setRefreshKey((k) => k + 1)
    } finally {
      setImporting(false)
    }
  }

  // Lance le replay via le client LoL
  async function handleLaunchReplay(gameId: number) {
    setLaunchingReplay(gameId)
    await window.electronAPI.invoke(IPC.LAUNCH_REPLAY, gameId)
    setTimeout(() => setLaunchingReplay(null), 3000)
  }

  const wins = games.filter((g) => g.result === 'win').length
  const losses = games.filter((g) => g.result === 'loss').length
  const winrate = games.length > 0 ? Math.round((wins / games.length) * 100) : 0

  return (
    <div className="flex flex-col h-full">

      {/* ─── Header ─── */}
      <div className="px-5 pt-5 pb-0 flex-shrink-0">
        <div className="flex items-end justify-between mb-4">
          <div>
            <h1 className="text-base font-black text-white tracking-tight">Parties classées</h1>
            <p className="text-[10px] mt-0.5" style={{ color: c.text, opacity: 0.3 }}>
              {games.length} partie{games.length !== 1 ? 's' : ''}
              {games.length > 0 && (
                <span>
                  {' — '}
                  <span style={{ color: '#22c55e' }}>{wins}W</span>
                  {' / '}
                  <span style={{ color: '#ef4444' }}>{losses}L</span>
                  {' '}
                  <span style={{ color: winrate >= 50 ? '#22c55e' : '#ef4444' }}>
                    ({winrate}%)
                  </span>
                </span>
              )}
            </p>
          </div>
          <button
            onClick={handleImport}
            disabled={importing}
            className="text-[10px] font-bold px-3 py-1 rounded-full transition-all duration-150 disabled:opacity-40"
            style={{ backgroundColor: `${c.accent}20`, color: c.accent, border: `1px solid ${c.accent}40` }}
            title="Importer depuis le client LoL"
          >
            {importing ? '...' : 'Actualiser'}
          </button>
        </div>

        {/* Sub-tabs Solo/Duo — Flex */}
        <div className="flex gap-2 pb-4">
          {([
            { id: 'RANKED_SOLO' as QueueTab, label: 'Solo / Duo' },
            { id: 'RANKED_FLEX' as QueueTab, label: 'Flex' },
          ]).map(({ id, label }) => {
            const active = tab === id
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-150"
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
        </div>

        {/* Séparateur */}
        <div className="h-px -mx-5" style={{ backgroundColor: c.border }} />
      </div>

      {/* ─── Liste des parties ─── */}
      <div className="flex-1 overflow-auto px-5 py-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl h-[100px] animate-pulse"
                style={{ backgroundColor: c.border, opacity: 0.4 }}
              />
            ))}
          </div>

        ) : games.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center select-none">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 mb-3"
              style={{ color: c.text, opacity: 0.15 }}>
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="font-semibold text-sm" style={{ color: c.text, opacity: 0.3 }}>
              Aucune partie {tab === 'RANKED_SOLO' ? 'Solo/Duo' : 'Flex'} enregistrée
            </p>
            <p className="text-xs mt-1" style={{ color: c.text, opacity: 0.2 }}>
              Les parties classées seront sauvegardées automatiquement.
            </p>
          </div>

        ) : (
          <div className="space-y-2.5">
            {games.map((game) => {
              const isWin = game.result === 'win'
              const kda = game.deaths === 0
                ? (game.kills + game.assists).toFixed(1)
                : ((game.kills + game.assists) / game.deaths).toFixed(1)
              const csPerMin = game.gameTime > 0
                ? (game.cs / (game.gameTime / 60)).toFixed(1)
                : '0'
              const kp = game.teamKills > 0
                ? Math.round(((game.kills + game.assists) / game.teamKills) * 100)
                : 0

              const isReviewOpen = openReviewId === game.id
              const review = reviews[game.id]
              const reviewLoading = review === 'loading'
              const reviewData = review && review !== 'loading' ? review : null

              return (
                <div
                  key={game.id}
                  className="rounded-xl overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${c.bg} 0%, ${c.border}30 100%)`,
                    border: `1px solid ${c.border}`,
                    borderLeftWidth: 4,
                    borderLeftColor: isWin ? '#22c55e' : '#ef4444',
                  }}
                >
                <div className="p-3.5 relative">
                  {/* Ligne 1 : Champion + Résultat + KDA + Meta */}
                  <div className="flex items-center gap-3">
                    {/* Champion icon */}
                    <div className="relative flex-shrink-0">
                      <img
                        src={getChampionIconUrl(game.champion)}
                        alt={game.champion}
                        className="w-10 h-10 rounded-lg"
                        style={{ border: `2px solid ${isWin ? '#22c55e' : '#ef4444'}40` }}
                      />
                      <span
                        className="absolute -bottom-1 -right-1 text-[8px] font-black px-1 rounded"
                        style={{
                          backgroundColor: isWin ? '#22c55e' : '#ef4444',
                          color: '#fff',
                        }}
                      >
                        {isWin ? 'W' : 'L'}
                      </span>
                    </div>

                    {/* Champion name + level */}
                    <div className="min-w-0 flex-shrink-0" style={{ width: 80 }}>
                      <p className="text-xs font-bold text-white truncate">{game.champion}</p>
                      <p className="text-[9px]" style={{ color: c.text, opacity: 0.4 }}>
                        Niv. {game.level}
                      </p>
                    </div>

                    {/* KDA */}
                    <div className="text-center flex-shrink-0" style={{ width: 70 }}>
                      <p className="text-xs font-bold text-white">
                        <span style={{ color: '#22c55e' }}>{game.kills}</span>
                        <span style={{ color: c.text, opacity: 0.3 }}> / </span>
                        <span style={{ color: '#ef4444' }}>{game.deaths}</span>
                        <span style={{ color: c.text, opacity: 0.3 }}> / </span>
                        <span style={{ color: '#60a5fa' }}>{game.assists}</span>
                      </p>
                      <p className="text-[9px] font-mono" style={{ color: c.text, opacity: 0.4 }}>
                        {kda} KDA
                      </p>
                    </div>

                    {/* Stats compactes */}
                    <div className="flex gap-3 text-[9px] flex-shrink-0" style={{ color: c.text, opacity: 0.5 }}>
                      <div className="text-center">
                        <p className="font-bold text-white text-opacity-80">{game.cs}</p>
                        <p>{csPerMin}/m</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-white text-opacity-80">{kp}%</p>
                        <p>KP</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-white text-opacity-80">{game.wardScore}</p>
                        <p>Vision</p>
                      </div>
                    </div>

                    {/* Time + date */}
                    <div className="ml-auto text-right flex-shrink-0">
                      <p className="text-[9px] font-mono" style={{ color: c.text, opacity: 0.3 }}>
                        {fmtGameTime(game.gameTime)}
                      </p>
                      <p className="text-[8px]" style={{ color: c.text, opacity: 0.2 }}>
                        {timeAgo(game.timestamp)}
                      </p>
                    </div>
                  </div>

                  {/* Ligne 2 : Roast / Tacle */}
                  <div
                    className="mt-2.5 pt-2 text-[10px] italic leading-relaxed"
                    style={{
                      color: isWin ? '#86efac' : '#fca5a5',
                      borderTop: `1px solid ${c.border}50`,
                      opacity: 0.85,
                    }}
                  >
                    "{game.roast}"
                  </div>

                  {/* Ligne 3 : Equipes + bouton Analyser */}
                  <div className="mt-2 flex items-center gap-1 flex-wrap">
                    <div className="flex items-center gap-1 flex-wrap" style={{ opacity: 0.4 }}>
                      <span className="text-[8px] font-bold" style={{ color: '#22c55e' }}>Allies:</span>
                      {game.allies.map((a, i) => (
                        <img key={i} src={getChampionIconUrl(a)} alt={a} title={a} className="w-4 h-4 rounded-sm" />
                      ))}
                      <span className="text-[8px] font-bold ml-2" style={{ color: '#ef4444' }}>vs</span>
                      {game.enemies.map((e, i) => (
                        <img key={i} src={getChampionIconUrl(e)} alt={e} title={e} className="w-4 h-4 rounded-sm" />
                      ))}
                    </div>

                    {/* Bouton Analyser */}
                    <button
                      onClick={() => handleAnalyse(game.id)}
                      className="ml-auto text-[9px] font-bold px-2.5 py-1 rounded-full transition-all duration-150"
                      style={isReviewOpen ? {
                        backgroundColor: c.accent,
                        color: c.bg,
                      } : {
                        backgroundColor: `${c.border}60`,
                        color: c.text,
                        opacity: 0.7,
                      }}
                    >
                      {reviewLoading ? '...' : isReviewOpen ? '▲ Review' : '▼ Analyser'}
                    </button>
                  </div>
                </div>

                {/* ── Panneau review inline ── */}
                {isReviewOpen && reviewData && (
                  <ReviewPanel
                    timeline={reviewData}
                    gameId={game.id}
                    launchingReplay={launchingReplay}
                    onLaunchReplay={handleLaunchReplay}
                    colors={c}
                  />
                )}
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}

// ─── Composant panneau review inline ────────────────────────────────────────

const GRADE_COLOR: Record<string, string> = {
  S: '#facc15', A: '#22c55e', B: '#60a5fa', C: '#f59e0b', D: '#ef4444',
}

const EVENT_COLOR: Record<string, string> = {
  error: '#ef4444', strength: '#22c55e', tip: '#f59e0b',
}

const EVENT_ICON: Record<string, string> = {
  error: '✕', strength: '✓', tip: '◆',
}

interface ReviewPanelProps {
  timeline: ReviewTimeline
  gameId: number
  launchingReplay: number | null
  onLaunchReplay: (id: number) => void
  colors: { bg: string; text: string; accent: string; border: string }
}

function ReviewPanel({ timeline, gameId, launchingReplay, onLaunchReplay, colors }: ReviewPanelProps) {
  const { summary } = timeline
  const gradeColor = GRADE_COLOR[summary.grade] ?? '#fff'
  const isLaunching = launchingReplay === gameId

  return (
    <div
      className="px-4 pt-3 pb-4"
      style={{ borderTop: `1px solid ${colors.border}40` }}
    >
      {/* ── En-tête grade + résumé + bouton replay ── */}
      <div className="flex items-start gap-3 mb-3">
        {/* Grade */}
        <div
          className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-xl font-black"
          style={{
            backgroundColor: `${gradeColor}18`,
            border: `2px solid ${gradeColor}50`,
            color: gradeColor,
          }}
        >
          {summary.grade}
        </div>

        {/* Résumé texte */}
        <p className="flex-1 text-[11px] leading-relaxed" style={{ color: colors.text, opacity: 0.8 }}>
          {summary.summary}
        </p>

        {/* Bouton Rejouer */}
        <button
          onClick={() => onLaunchReplay(gameId)}
          disabled={isLaunching}
          className="flex-shrink-0 text-[9px] font-bold px-2.5 py-1.5 rounded-lg transition-all duration-150"
          style={{
            backgroundColor: isLaunching ? `${colors.accent}30` : `${colors.accent}20`,
            color: isLaunching ? colors.accent : colors.accent,
            border: `1px solid ${colors.accent}40`,
            opacity: isLaunching ? 0.6 : 1,
          }}
        >
          {isLaunching ? 'Lancement...' : '▶ Rejouer'}
        </button>
      </div>

      {/* ── Stats chiffrées ── */}
      <div
        className="grid grid-cols-3 gap-2 mb-3 rounded-lg p-2.5"
        style={{ backgroundColor: `${colors.border}30` }}
      >
        {([
          { label: 'KDA',      value: summary.stats.kda },
          { label: 'CS/min',   value: summary.stats.csPerMin },
          { label: 'KP',       value: `${summary.stats.kp}%` },
          { label: 'Gold/min', value: summary.stats.goldPerMin },
          { label: 'Vision',   value: summary.stats.wardScore },
          { label: 'Morts',    value: `${summary.stats.deathsEarly}/${summary.stats.deathsMid}/${summary.stats.deathsLate}` },
        ] as { label: string; value: string | number }[]).map(({ label, value }) => (
          <div key={label} className="text-center">
            <p className="text-xs font-bold text-white">{value}</p>
            <p className="text-[9px]" style={{ color: colors.text, opacity: 0.4 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* ── Événements par catégorie ── */}
      <div className="space-y-1.5">
        {[...summary.errors, ...summary.strengths, ...summary.tips].map((ev: ReviewEvent, i: number) => (
          <div
            key={i}
            className="flex items-start gap-2 rounded-lg px-2.5 py-2"
            style={{ backgroundColor: `${EVENT_COLOR[ev.category]}10` }}
          >
            <span
              className="flex-shrink-0 text-[10px] font-black mt-0.5"
              style={{ color: EVENT_COLOR[ev.category] }}
            >
              {EVENT_ICON[ev.category]}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold" style={{ color: EVENT_COLOR[ev.category] }}>
                {ev.title}
              </p>
              <p className="text-[10px] leading-relaxed" style={{ color: colors.text, opacity: 0.7 }}>
                {ev.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
