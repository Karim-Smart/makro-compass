import { IPC } from '../../shared/ipc-channels'
import type { ObjectiveTimers } from '../../shared/types'
import { broadcastToWindows } from '../main/ipcHandlers'

// Durées de respawn (en secondes)
const DRAGON_RESPAWN = 5 * 60      // 5 minutes
const BARON_RESPAWN = 6 * 60       // 6 minutes
const HERALD_RESPAWN = 6 * 60      // Herald respawn = 6 minutes
const HERALD_DISAPPEARS = 20 * 60  // Herald disparaît à 20 min (Baron prend sa place)

// Durée de rétention des événements passés (10 min > max respawn de 6 min)
const EVENT_MAX_AGE_MS = 10 * 60 * 1000

interface ObjectiveEvent {
  type: 'dragon' | 'baron' | 'herald'
  killedAt: number  // timestamp Unix (ms)
  gameTime: number  // temps de jeu en secondes au moment du kill
}

// ─── État interne ─────────────────────────────────────────────────────────────

let broadcastTimer: ReturnType<typeof setInterval> | null = null
let gameStartTime: number | null = null
let dragonStacks = 0
let lastObjectiveEvents: ObjectiveEvent[] = []
let lastTimerSig = ''

function timerSig(t: ObjectiveTimers): string {
  return [
    `${+t.dragon.isDead}:${t.dragon.nextSpawn}`,
    `${+t.baron.isDead}:${t.baron.nextSpawn}:${+t.baron.available}`,
    `${+t.herald.isDead}:${t.herald.nextSpawn}:${+t.herald.available}`,
  ].join('|')
}

// ─── API publique (appelée par riotAgent) ─────────────────────────────────────

export function registerObjectiveKill(
  type: 'dragon' | 'baron' | 'herald',
  gameTime: number
): void {
  lastObjectiveEvents.push({
    type,
    killedAt: Date.now(),
    gameTime
  })

  if (type === 'dragon') {
    dragonStacks = Math.min(dragonStacks + 1, 4)
  }
}

export function setGameStartTime(timestamp: number): void {
  gameStartTime = timestamp
}

export function resetTimers(): void {
  dragonStacks = 0
  lastObjectiveEvents = []
  gameStartTime = null
  lastTimerSig = ''
}

// ─── Calcul des timers ────────────────────────────────────────────────────────

function computeTimers(currentGameTime: number): ObjectiveTimers {
  const now = Date.now()

  // Purge des événements trop anciens (ne peuvent plus impacter les timers)
  lastObjectiveEvents = lastObjectiveEvents.filter((e) => now - e.killedAt < EVENT_MAX_AGE_MS)

  // Trouver les derniers événements par type
  const lastDragon = lastObjectiveEvents.filter((e) => e.type === 'dragon').at(-1)
  const lastBaron = lastObjectiveEvents.filter((e) => e.type === 'baron').at(-1)
  const lastHerald = lastObjectiveEvents.filter((e) => e.type === 'herald').at(-1)

  // Dragon
  const dragonNextSpawn = lastDragon
    ? lastDragon.killedAt + DRAGON_RESPAWN * 1000
    : null
  const dragonIsDead = dragonNextSpawn !== null && now < dragonNextSpawn

  // Baron (spawn à 20 min, disparaît jamais)
  const baronAvailable = currentGameTime >= HERALD_DISAPPEARS
  const baronNextSpawn = lastBaron
    ? lastBaron.killedAt + BARON_RESPAWN * 1000
    : null
  const baronIsDead = baronNextSpawn !== null && now < baronNextSpawn

  // Herald (disponible jusqu'à 20 min de jeu)
  const heraldAvailable = currentGameTime < HERALD_DISAPPEARS
  // Herald ne respawn pas si le spawn aurait lieu après 20 min de jeu
  let heraldNextSpawn: number | null = null
  if (lastHerald) {
    const respawnGameTime = lastHerald.gameTime + HERALD_RESPAWN
    if (respawnGameTime < HERALD_DISAPPEARS) {
      heraldNextSpawn = lastHerald.killedAt + HERALD_RESPAWN * 1000
    }
  }
  const heraldIsDead = heraldNextSpawn !== null && now < heraldNextSpawn

  return {
    dragon: {
      nextSpawn: dragonNextSpawn,
      isDead: dragonIsDead
    },
    baron: {
      nextSpawn: baronNextSpawn,
      isDead: baronIsDead,
      available: baronAvailable
    },
    herald: {
      nextSpawn: heraldNextSpawn,
      isDead: heraldIsDead,
      available: heraldAvailable
    }
  }
}

// ─── Démarrage / Arrêt ────────────────────────────────────────────────────────

export async function startTimerAgent(): Promise<void> {
  console.log('[TimerAgent] Démarrage.')

  // Mise à jour des timers toutes les secondes — broadcaster seulement si l'état change
  // (TimerOverlay a son propre useNow(500) pour le décompte, pas besoin de spam IPC)
  broadcastTimer = setInterval(() => {
    if (!gameStartTime) return

    const currentGameTime = (Date.now() - gameStartTime) / 1000
    const timers = computeTimers(currentGameTime)
    const sig = timerSig(timers)
    if (sig !== lastTimerSig) {
      lastTimerSig = sig
      broadcastToWindows(IPC.OVERLAY_TIMERS, timers)
    }
  }, 1000)
}

export function stopTimerAgent(): void {
  if (broadcastTimer) {
    clearInterval(broadcastTimer)
    broadcastTimer = null
  }
  resetTimers()
  console.log('[TimerAgent] Arrêté.')
}
