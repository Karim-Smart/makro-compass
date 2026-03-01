import { useEffect, useState } from 'react'
import { useCoachingStore } from '../stores/coachingStore'
import { COACHING_STYLES } from '../../../shared/constants'
import { IPC } from '../../../shared/ipc-channels'
import { getChampionIconUrl } from '../../../shared/champion-images'
import { computeGameGrade, computeRecentForm } from '../../../shared/game-analysis'
import type { RankedGame, RankedQueueType, ReviewTimeline, ReviewEvent, PostGameDebriefResponse, SmartRecap } from '../../../shared/types'
import FeatureLock from '../components/FeatureLock'

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
  // AI Debrief : stocke la réponse par gameId
  const [debriefs, setDebriefs] = useState<Record<number, PostGameDebriefResponse | 'loading'>>({})
  const [openDebriefId, setOpenDebriefId] = useState<number | null>(null)
  // AI Smart Recap : headline + grade IA par gameId
  const [recaps, setRecaps] = useState<Record<number, SmartRecap | 'loading'>>({})
  const [openRecapId, setOpenRecapId] = useState<number | null>(null)

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

  // AI Debrief IA
  async function handleDebrief(gameId: number) {
    if (openDebriefId === gameId) {
      setOpenDebriefId(null)
      return
    }
    setOpenDebriefId(gameId)
    if (debriefs[gameId]) return
    setDebriefs((prev) => ({ ...prev, [gameId]: 'loading' }))
    try {
      const result = await window.electronAPI.invoke(IPC.POSTGAME_DEBRIEF, gameId) as PostGameDebriefResponse | null
      if (result) {
        setDebriefs((prev) => ({ ...prev, [gameId]: result }))
      } else {
        setDebriefs((prev) => { const next = { ...prev }; delete next[gameId]; return next })
        setOpenDebriefId(null)
      }
    } catch {
      setDebriefs((prev) => { const next = { ...prev }; delete next[gameId]; return next })
      setOpenDebriefId(null)
    }
  }

  // AI Smart Recap
  async function handleRecap(gameId: number) {
    if (openRecapId === gameId) {
      setOpenRecapId(null)
      return
    }
    setOpenRecapId(gameId)
    if (recaps[gameId]) return
    setRecaps((prev) => ({ ...prev, [gameId]: 'loading' }))
    try {
      const result = await window.electronAPI.invoke(IPC.SMART_RECAP, gameId) as SmartRecap | null
      if (result) {
        setRecaps((prev) => ({ ...prev, [gameId]: result }))
      } else {
        setRecaps((prev) => { const next = { ...prev }; delete next[gameId]; return next })
        setOpenRecapId(null)
      }
    } catch {
      setRecaps((prev) => { const next = { ...prev }; delete next[gameId]; return next })
      setOpenRecapId(null)
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
  const recentForm = computeRecentForm(games, 10).reverse()  // ancien → récent (gauche → droite)

  // Métriques moyennes sur toutes les parties chargées
  const avgKda = games.length > 0
    ? (games.reduce((s, g) => s + (g.deaths === 0 ? 5 : (g.kills + g.assists) / g.deaths), 0) / games.length).toFixed(2)
    : null
  const avgCs = games.length > 0
    ? (games.reduce((s, g) => s + (g.gameTime > 0 ? g.cs / (g.gameTime / 60) : 0), 0) / games.length).toFixed(1)
    : null
  const avgVision = games.length > 0
    ? (games.reduce((s, g) => s + (g.gameTime > 0 ? g.wardScore / (g.gameTime / 60) : 0), 0) / games.length).toFixed(1)
    : null

  return (
    <div className="flex flex-col h-full">

      {/* ─── Header ─── */}
      <div className="px-5 pt-5 pb-0 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-base font-black text-white tracking-tight">Parties classées</h1>
          <FeatureLock feature="ranked_import">
            <button
              onClick={handleImport}
              disabled={importing}
              className="text-[10px] font-bold px-3 py-1 clip-bevel-sm transition-all duration-150 disabled:opacity-40"
              style={{ backgroundColor: `${c.accent}20`, color: c.accent, border: `1px solid ${c.accent}40` }}
              title="Importer depuis le client LoL"
            >
              {importing ? '...' : 'Actualiser'}
            </button>
          </FeatureLock>
        </div>

        {/* Bandeau métriques globales */}
        {games.length > 0 && (
          <div
            className="clip-bevel-lg p-3 mb-3 grid grid-cols-5 gap-0"
            style={{
              background: `linear-gradient(135deg, ${c.bg} 0%, ${c.border}50 100%)`,
              border: `1px solid ${c.border}`,
            }}
          >
            {[
              { label: 'Winrate', value: `${winrate}%`, color: winrate >= 50 ? '#22c55e' : '#ef4444' },
              { label: 'Parties', value: `${wins}W ${losses}L`, color: c.text },
              { label: 'KDA moyen', value: avgKda ?? '—', color: parseFloat(avgKda ?? '0') >= 3 ? '#22c55e' : c.accent },
              { label: 'CS/min', value: avgCs ?? '—', color: c.text },
              { label: 'Vision/min', value: avgVision ?? '—', color: c.text },
            ].map(({ label, value, color }, i) => (
              <div
                key={label}
                className="text-center px-2"
                style={i > 0 ? { borderLeft: `1px solid ${c.border}50` } : {}}
              >
                <div className="text-[8px] font-black uppercase tracking-[0.15em] mb-0.5" style={{ color: c.text, opacity: 0.35 }}>
                  {label}
                </div>
                <div className="font-mono font-black text-sm leading-none" style={{ color }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Forme récente — dots W/L des 10 dernières parties */}
        {games.length >= 3 && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[8px] font-black uppercase tracking-[0.15em] flex-shrink-0" style={{ color: c.text, opacity: 0.28 }}>
              Forme
            </span>
            <div className="flex items-center gap-0.5">
              {recentForm.map((result, i) => (
                <div
                  key={i}
                  title={result === 1 ? 'Victoire' : 'Défaite'}
                  className="rounded-sm transition-transform hover:scale-125"
                  style={{
                    width: 13,
                    height: 13,
                    backgroundColor: result === 1 ? '#22c55e20' : '#ef444420',
                    border: `1px solid ${result === 1 ? '#22c55e55' : '#ef444455'}`,
                  }}
                />
              ))}
            </div>
            {recentForm.length >= 5 && (() => {
              const last5 = recentForm.slice(-5)
              const wr5 = Math.round((last5.filter(r => r === 1).length / 5) * 100)
              const prev5 = recentForm.slice(-10, -5)
              const wr5prev = prev5.length > 0
                ? Math.round((prev5.filter(r => r === 1).length / prev5.length) * 100)
                : wr5
              const diff = wr5 - wr5prev
              return (
                <span
                  className="text-[9px] font-mono font-black ml-1"
                  style={{ color: diff > 0 ? '#22c55e' : diff < 0 ? '#ef4444' : c.text, opacity: diff === 0 ? 0.3 : 1 }}
                >
                  {diff > 0 ? `+${diff}%` : diff < 0 ? `${diff}%` : '—'}
                </span>
              )
            })()}
          </div>
        )}

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
                className="px-4 py-1.5 clip-bevel-sm text-xs font-bold transition-all duration-150"
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
                className="clip-bevel-lg h-[100px] animate-pulse"
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
              const grade = computeGameGrade(game)

              const isReviewOpen = openReviewId === game.id
              const review = reviews[game.id]
              const reviewLoading = review === 'loading'
              const reviewData = review && review !== 'loading' ? review : null

              return (
                <div
                  key={game.id}
                  className="clip-bevel-lg overflow-hidden"
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
                        className="w-10 h-10 clip-bevel"
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

                    {/* Champion name + level + grade */}
                    <div className="min-w-0 flex-shrink-0" style={{ width: 96 }}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p className="text-xs font-bold text-white truncate">{game.champion}</p>
                        <span
                          className="flex-shrink-0 font-black rounded text-[9px] px-1 py-0.5 leading-none"
                          style={{ backgroundColor: `${grade.color}25`, color: grade.color }}
                        >
                          {grade.grade}
                        </span>
                      </div>
                      <p className="text-[9px]" style={{ color: c.text, opacity: 0.4 }}>
                        Niv. {game.level} · {grade.score}pts
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

                    {/* Boutons Recap + Debrief IA + Analyser */}
                    <div className="ml-auto flex items-center gap-1.5">
                      <FeatureLock feature="smart_recap">
                        <button
                          onClick={() => handleRecap(game.id)}
                          className="text-[9px] font-bold px-2.5 py-1 clip-bevel-sm transition-all duration-150"
                          style={openRecapId === game.id ? {
                            backgroundColor: '#f59e0b',
                            color: '#000',
                          } : {
                            backgroundColor: '#f59e0b20',
                            color: '#f59e0b',
                          }}
                        >
                          {recaps[game.id] === 'loading' ? '...' : openRecapId === game.id ? '▲ Recap' : 'Recap IA'}
                        </button>
                      </FeatureLock>
                      <FeatureLock feature="postgame_debrief">
                        <button
                          onClick={() => handleDebrief(game.id)}
                          className="text-[9px] font-bold px-2.5 py-1 clip-bevel-sm transition-all duration-150"
                          style={openDebriefId === game.id ? {
                            backgroundColor: '#9B6EF3',
                            color: '#fff',
                          } : {
                            backgroundColor: '#9B6EF320',
                            color: '#9B6EF3',
                          }}
                        >
                          {debriefs[game.id] === 'loading' ? '...' : openDebriefId === game.id ? '▲ Debrief' : 'Debrief IA'}
                        </button>
                      </FeatureLock>
                      <button
                        onClick={() => handleAnalyse(game.id)}
                        className="text-[9px] font-bold px-2.5 py-1 clip-bevel-sm transition-all duration-150"
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
                </div>

                {/* ── Panneau Smart Recap inline ── */}
                {openRecapId === game.id && recaps[game.id] && recaps[game.id] !== 'loading' && (() => {
                  const r = recaps[game.id] as SmartRecap
                  const recapGradeColor = GRADE_COLOR[r.grade] ?? '#fff'
                  return (
                    <div
                      className="mt-2 clip-bevel px-4 py-3"
                      style={{ backgroundColor: `${c.border}25`, border: `1px solid #f59e0b30` }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#f59e0b' }}>
                          Smart Recap
                        </span>
                        <span
                          className="text-[10px] font-black px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: `${recapGradeColor}20`, color: recapGradeColor }}
                        >
                          {r.grade}
                        </span>
                      </div>
                      <p className="text-xs font-semibold leading-relaxed mb-1.5" style={{ color: c.text }}>
                        {r.headline}
                      </p>
                      <div className="flex items-start gap-1.5">
                        <span className="text-[10px] mt-0.5" style={{ color: '#f59e0b' }}>★</span>
                        <p className="text-[10px] leading-relaxed" style={{ color: c.text, opacity: 0.7 }}>
                          {r.mvpMoment}
                        </p>
                      </div>
                    </div>
                  )
                })()}

                {/* ── Panneau debrief IA inline ── */}
                {openDebriefId === game.id && debriefs[game.id] && debriefs[game.id] !== 'loading' && (() => {
                  const d = debriefs[game.id] as PostGameDebriefResponse
                  return (
                    <div
                      className="mt-2 clip-bevel px-4 py-3"
                      style={{ backgroundColor: `${c.border}25`, border: `1px solid #9B6EF330` }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#9B6EF3' }}>
                          AI Debrief
                        </span>
                        <span className="text-[8px] px-1.5 py-0.5 rounded font-black" style={{ backgroundColor: '#9B6EF320', color: '#9B6EF3' }}>
                          PRO
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        <div>
                          <span className="text-[9px] font-bold block mb-1" style={{ color: '#22c55e' }}>Forces</span>
                          {d.strengths.map((s, i) => (
                            <div key={i} className="flex items-start gap-1 mb-0.5">
                              <span className="mt-1 w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: '#22c55e' }} />
                              <span className="text-[10px] leading-relaxed" style={{ color: c.text, opacity: 0.7 }}>{s}</span>
                            </div>
                          ))}
                        </div>
                        <div>
                          <span className="text-[9px] font-bold block mb-1" style={{ color: '#f59e0b' }}>Améliorations</span>
                          {d.improvements.map((s, i) => (
                            <div key={i} className="flex items-start gap-1 mb-0.5">
                              <span className="mt-1 w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: '#f59e0b' }} />
                              <span className="text-[10px] leading-relaxed" style={{ color: c.text, opacity: 0.7 }}>{s}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="px-3 py-2 clip-bevel" style={{ backgroundColor: `${c.accent}10`, border: `1px solid ${c.accent}30` }}>
                        <span className="text-[9px] font-black uppercase tracking-widest block mb-1" style={{ color: c.accent, opacity: 0.6 }}>
                          Conseil principal
                        </span>
                        <span className="text-xs" style={{ color: c.text }}>{d.keyTakeaway}</span>
                      </div>
                    </div>
                  )
                })()}

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
          className="flex-shrink-0 w-10 h-10 clip-bevel flex items-center justify-center text-xl font-black"
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
          className="flex-shrink-0 text-[9px] font-bold px-2.5 py-1.5 clip-bevel transition-all duration-150"
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
        className="grid grid-cols-3 gap-2 mb-3 clip-bevel p-2.5"
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
            className="flex items-start gap-2 clip-bevel px-2.5 py-2"
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
