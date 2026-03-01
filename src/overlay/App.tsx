import { useEffect, useRef, useState, useCallback } from 'react'
import { IPC } from '../../shared/ipc-channels'
import { COACHING_STYLES } from '../../shared/constants'
import type { CoachAdvice, CoachingStyle, GameAlert, GameData, GameStatus, ObjectiveTimers, RunePageSet, BuildRecommendations, ReviewEvent } from '../../shared/types'
import { AdviceOverlay } from './components/AdviceOverlay'
import { AdviceMinBar } from './components/AdviceMinBar'
import { TimerOverlay } from './components/TimerOverlay'
import { StatsOverlay } from './components/StatsOverlay'
import { ObjectivesOverlay } from './components/ObjectivesOverlay'
import { ItemsOverlay } from './components/ItemsOverlay'
import { LevelAlert } from './components/LevelAlert'
import { AlertOverlay } from './components/AlertOverlay'
import { StyleSwitcher } from './components/StyleSwitcher'
import { RunesOverlay } from './components/RunesOverlay'
import { BuildStrip } from './components/BuildStrip'
import { ReviewEventOverlay } from './components/ReviewEventOverlay'

// Lire le panel à afficher depuis l'URL (?panel=stats|timers|advice)
const params = new URLSearchParams(window.location.search)
const panel = params.get('panel') ?? 'stats'

const ADVICE_QUEUE_MAX = 10
const ADVICE_DISPLAY_MS = 30_000  // 30s par message (2x plus lent)

export default function OverlayApp() {
  const [selectedStyle, setSelectedStyle] = useState<CoachingStyle>('LCK')
  const [gameData, setGameData] = useState<GameData | null>(null)
  const [timers, setTimers] = useState<ObjectiveTimers | null>(null)
  const [alert, setAlert] = useState<GameAlert | null>(null)
  const alertTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Runes et Build
  const [runePages, setRunePages] = useState<RunePageSet | null>(null)
  const [buildData, setBuildData] = useState<BuildRecommendations | null>(null)

  // Review mode (replay coaching)
  const [isReplayMode, setIsReplayMode] = useState(false)
  const [reviewEvent, setReviewEvent] = useState<ReviewEvent | null>(null)
  const [reviewEventIndex, setReviewEventIndex] = useState(0)
  const [reviewTotalEvents, setReviewTotalEvents] = useState(0)
  const reviewEventTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Minimize/expand du panneau advice
  const [adviceMinimized, setAdviceMinimized] = useState(false)

  // File de 10 messages qui défilent
  const [adviceQueue, setAdviceQueue] = useState<CoachAdvice[]>([])
  const [adviceIdx, setAdviceIdx] = useState(0)
  const rotateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Compteur unique pour forcer le re-render de l'animation de barre
  const [rotateKey, setRotateKey] = useState(0)

  // Rotation automatique toutes les 30s
  const startRotation = useCallback(() => {
    if (rotateTimerRef.current) clearInterval(rotateTimerRef.current)
    rotateTimerRef.current = setInterval(() => {
      setAdviceQueue((q) => {
        if (q.length <= 1) return q
        setAdviceIdx((prev) => (prev + 1) % q.length)
        setRotateKey((k) => k + 1)
        return q
      })
    }, ADVICE_DISPLAY_MS)
  }, [])

  useEffect(() => {
    const api = window.overlayAPI

    const onStyleChange = (style: unknown) => {
      setSelectedStyle(style as CoachingStyle)
      setAdviceQueue([])
      setAdviceIdx(0)
      setRunePages(null)
    }

    const onAdvice = (newAdvice: unknown) => {
      const a = newAdvice as CoachAdvice
      setAdviceQueue((prev) => {
        if (prev.length > 0 && prev[prev.length - 1].text === a.text) return prev
        const next = [...prev, a]
        if (next.length > ADVICE_QUEUE_MAX) {
          // Supprimer le plus ancien de priorité la plus basse
          const lowestIdx = next.reduce((minI, item, i, arr) => {
            const pri = { high: 3, medium: 2, low: 1 }
            return (pri[item.priority] ?? 0) < (pri[arr[minI].priority] ?? 0) ? i : minI
          }, 0)
          next.splice(lowestIdx, 1)
        }
        return next
      })
    }

    const onAlert = (newAlert: unknown) => {
      if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current)
      setAlert(newAlert as GameAlert)
      alertTimeoutRef.current = setTimeout(() => setAlert(null), 3_000)
    }

    const onGameData = (data: unknown) => {
      setGameData(data as GameData)
    }

    const onGameStatus = (status: unknown) => {
      const gameStatus = status as GameStatus
      if (!gameStatus.isInGame) {
        setGameData(null)
        setTimers(null)
        setAdviceQueue([])
        setAdviceIdx(0)
        setAlert(null)
        setRunePages(null)
        setBuildData(null)
        if (rotateTimerRef.current) clearInterval(rotateTimerRef.current)
        if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current)
      }
    }

    const onTimers = (t: unknown) => {
      setTimers(t as ObjectiveTimers)
    }

    const onRunes = (pages: unknown) => {
      setRunePages(pages as RunePageSet)
    }

    const onBuild = (data: unknown) => {
      setBuildData(data as BuildRecommendations)
    }

    const onReplayDetected = (payload: unknown) => {
      const { isReplay } = payload as { isReplay: boolean }
      setIsReplayMode(isReplay)
      if (!isReplay) {
        // Fin du replay → nettoyer l'état review
        setReviewEvent(null)
        setReviewEventIndex(0)
        setReviewTotalEvents(0)
        if (reviewEventTimerRef.current) clearTimeout(reviewEventTimerRef.current)
      }
    }

    const onOverlayReview = (payload: unknown) => {
      const p = payload as {
        type: 'event' | 'summary'
        event?: ReviewEvent
        eventIndex?: number
        totalEvents?: number
      }
      if (p.type === 'event' && p.event) {
        if (reviewEventTimerRef.current) clearTimeout(reviewEventTimerRef.current)
        setReviewEvent(p.event)
        setReviewEventIndex(p.eventIndex ?? 0)
        setReviewTotalEvents(p.totalEvents ?? 1)
        // Masquer après la durée de l'événement
        reviewEventTimerRef.current = setTimeout(() => {
          setReviewEvent(null)
        }, p.event.gameTimeDuration * 1000)
      }
    }

    api.on(IPC.STYLE_CHANGE, onStyleChange)
    api.on(IPC.OVERLAY_SHOW_ADVICE, onAdvice)
    api.on(IPC.OVERLAY_SHOW_ALERT, onAlert)
    api.on(IPC.GAME_DATA, onGameData)
    api.on(IPC.GAME_STATUS, onGameStatus)
    api.on(IPC.OVERLAY_TIMERS, onTimers)
    api.on(IPC.OVERLAY_RUNES, onRunes)
    api.on(IPC.OVERLAY_BUILD, onBuild)
    api.on(IPC.REPLAY_DETECTED, onReplayDetected)
    api.on(IPC.OVERLAY_REVIEW, onOverlayReview)

    return () => {
      if (rotateTimerRef.current) clearInterval(rotateTimerRef.current)
      if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current)
      if (reviewEventTimerRef.current) clearTimeout(reviewEventTimerRef.current)
      // Nettoyer les listeners IPC pour éviter les fuites mémoire
      api.removeListener(IPC.STYLE_CHANGE, onStyleChange)
      api.removeListener(IPC.OVERLAY_SHOW_ADVICE, onAdvice)
      api.removeListener(IPC.OVERLAY_SHOW_ALERT, onAlert)
      api.removeListener(IPC.GAME_DATA, onGameData)
      api.removeListener(IPC.GAME_STATUS, onGameStatus)
      api.removeListener(IPC.OVERLAY_TIMERS, onTimers)
      api.removeListener(IPC.OVERLAY_RUNES, onRunes)
      api.removeListener(IPC.OVERLAY_BUILD, onBuild)
      api.removeListener(IPC.REPLAY_DETECTED, onReplayDetected)
      api.removeListener(IPC.OVERLAY_REVIEW, onOverlayReview)
    }
  }, [])

  // Démarrer/redémarrer la rotation quand la queue change
  useEffect(() => {
    if (adviceQueue.length > 0) {
      startRotation()
    } else {
      if (rotateTimerRef.current) clearInterval(rotateTimerRef.current)
    }
  }, [adviceQueue.length, startRotation])

  // Garantir que l'index reste dans les bornes
  const safeIdx = adviceQueue.length > 0 ? adviceIdx % adviceQueue.length : 0
  const currentAdvice = adviceQueue.length > 0 ? adviceQueue[safeIdx] : null

  const colors = COACHING_STYLES[selectedStyle].colors
  const inGame = !!gameData?.isInGame

  return (
    <div
      className="w-full h-full"
      style={{
        background: '#080A12',
        // Toute la fenêtre est draggable
        // @ts-expect-error: propriété CSS Electron pour le drag
        WebkitAppRegion: 'drag',
        userSelect: 'none',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      {panel === 'stats' && inGame && (
        <StatsOverlay gameData={gameData!} colors={colors} />
      )}

      {panel === 'timers' && inGame && (
        <div className="space-y-1">
          {timers && <TimerOverlay timers={timers} colors={colors} />}
          <ObjectivesOverlay gameData={gameData!} colors={colors} />
          <ItemsOverlay gameData={gameData!} colors={colors} />
        </div>
      )}

      {panel === 'advice' && (
        <div className="flex flex-col gap-1">
          {/* ── Mode Replay : afficher les événements de review ── */}
          {isReplayMode && reviewEvent && (
            <ReviewEventOverlay
              event={reviewEvent}
              eventIndex={reviewEventIndex}
              totalEvents={reviewTotalEvents}
              colors={colors}
            />
          )}

          {/* ── Mode Live : conseil IA normal ── */}
          {!isReplayMode && (
            <>
              {/* Alerte courte (3s) — priorité visuelle (toujours visible) */}
              {alert && <AlertOverlay alert={alert} />}

              {/* Minimized → barre compacte */}
              {!alert && adviceMinimized && (
                <AdviceMinBar
                  advice={currentAdvice}
                  colors={colors}
                  queueTotal={adviceQueue.length}
                  onExpand={() => setAdviceMinimized(false)}
                />
              )}

              {/* Expanded → panneau conseil complet */}
              {!alert && !adviceMinimized && currentAdvice && (
                <AdviceOverlay
                  advice={currentAdvice}
                  colors={colors}
                  queuePos={safeIdx + 1}
                  queueTotal={adviceQueue.length}
                  rotateKey={rotateKey}
                  onMinimize={() => setAdviceMinimized(true)}
                />
              )}

              {/* Alerte niveau matchup */}
              {!currentAdvice && !alert && !adviceMinimized && inGame && gameData!.matchup && gameData!.matchup.levelDiff !== 0 && (
                <LevelAlert gameData={gameData!} colors={colors} />
              )}
            </>
          )}
        </div>
      )}

      {panel === 'build' && buildData && (
        <BuildStrip build={buildData.myBuild} colors={colors} />
      )}

      {panel === 'style' && (
        <StyleSwitcher selectedStyle={selectedStyle} />
      )}

      {/* Message d'attente si pas encore en jeu */}
      {!inGame && panel !== 'advice' && panel !== 'style' && (
        <div className="flex items-center justify-center h-full px-3">
          <span className="text-[10px] font-mono" style={{ color: `${colors.accent}50` }}>
            En attente de partie...
          </span>
        </div>
      )}
      {panel === 'advice' && !currentAdvice && !alert && !(inGame && gameData?.matchup && gameData.matchup.levelDiff !== 0) && (
        <div className="flex flex-col items-center justify-center h-full px-3 gap-1">
          <span className="text-[10px] font-mono" style={{ color: `${colors.accent}50` }}>
            {inGame ? 'Analyse en cours...' : 'En attente de partie...'}
          </span>
          <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: `${colors.accent}30` }}>
            {selectedStyle}
          </span>
        </div>
      )}
    </div>
  )
}
