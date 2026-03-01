/**
 * AI Tilt Detector — Détecte les patterns de tilt et envoie des conseils mental reset.
 * Tier requis : Elite
 * Purement algorithmique pour la détection, IA pour le message de reset.
 */
import Anthropic from '@anthropic-ai/sdk'
import { DEV_MOCK_AI } from '../../shared/constants'
import { IPC } from '../../shared/ipc-channels'
import { guardFeature } from './subscriptionAgent'
import { broadcastToWindows } from '../main/ipcHandlers'
import type { GameData, TiltStatus, CoachAdvice } from '../../shared/types'

let anthropic: Anthropic | null = null

export function setTiltDetectorClient(client: Anthropic): void {
  anthropic = client
}

// ── Tracking interne ─────────────────────────────────────────────────────────

interface TiltSnapshot {
  gameTime: number
  deaths: number
  cs: number
  gold: number
}

let snapshots: TiltSnapshot[] = []
let lastTiltLevel: TiltStatus['tiltLevel'] = 'none'
let lastResetSentTime = 0
let isActive = false

const TILT_COOLDOWN_MS = 120_000 // 2 min entre deux messages de reset

// ── Détection algorithmique (pas d'appel API) ───────────────────────────────

function detectTilt(current: GameData): TiltStatus {
  const now = current.gameTime

  // Ajouter le snapshot actuel
  snapshots.push({
    gameTime: now,
    deaths: current.kda.deaths,
    cs: current.cs,
    gold: current.gold,
  })

  // Garder les 5 dernières minutes de snapshots
  snapshots = snapshots.filter(s => now - s.gameTime < 300)

  if (snapshots.length < 3) {
    return { tiltLevel: 'none', tiltScore: 0, triggers: [], resetAdvice: '' }
  }

  const oldest = snapshots[0]
  const triggers: string[] = []
  let tiltScore = 0

  // 1. Fréquence de morts (morts récentes dans un court laps)
  const recentDeaths = current.kda.deaths - oldest.deaths
  const timeWindow = (now - oldest.gameTime) / 60 // en minutes
  if (timeWindow > 0) {
    const deathsPerMin = recentDeaths / timeWindow
    if (deathsPerMin >= 1.5) {
      tiltScore += 40
      triggers.push(`${recentDeaths} morts en ${Math.round(timeWindow)} min`)
    } else if (deathsPerMin >= 0.8) {
      tiltScore += 20
      triggers.push('Morts fréquentes')
    }
  }

  // 2. Chute de CS (farming en baisse)
  if (snapshots.length >= 4) {
    const mid = snapshots[Math.floor(snapshots.length / 2)]
    const earlyWindow = (mid.gameTime - oldest.gameTime) / 60
    const lateWindow = (now - mid.gameTime) / 60
    // Fenêtres d'au moins 1 minute pour un taux fiable
    if (earlyWindow >= 1 && lateWindow >= 1) {
      const csRateEarly = (mid.cs - oldest.cs) / earlyWindow
      const csRateNow = (current.cs - mid.cs) / lateWindow
      if (csRateEarly > 2 && csRateNow < csRateEarly * 0.6) {
        tiltScore += 20
        triggers.push('CS/min en chute libre')
      }
    }
  }

  // 3. Score négatif global (beaucoup plus de morts que de kills)
  if (current.kda.deaths >= 5 && current.kda.deaths > current.kda.kills * 2) {
    tiltScore += 15
    triggers.push(`Score ${current.kda.kills}/${current.kda.deaths}/${current.kda.assists}`)
  }

  // 4. Équipe en retard de kills (pas juste toi)
  const killDiff = current.teamKills - current.enemyKills
  if (killDiff < -8) {
    tiltScore += 15
    triggers.push(`Équipe en retard de ${Math.abs(killDiff)} kills`)
  }

  // 5. Gold diff défavorable
  if (current.enemyGold > 0 && current.teamGold > 0) {
    const goldRatio = current.teamGold / current.enemyGold
    if (goldRatio < 0.75) {
      tiltScore += 10
      triggers.push('Retard d\'or significatif')
    }
  }

  tiltScore = Math.min(100, tiltScore)

  const tiltLevel: TiltStatus['tiltLevel'] =
    tiltScore >= 60 ? 'severe'
    : tiltScore >= 40 ? 'moderate'
    : tiltScore >= 20 ? 'mild'
    : 'none'

  return { tiltLevel, tiltScore, triggers, resetAdvice: '' }
}

// ── Messages de reset mental ─────────────────────────────────────────────────

const MOCK_RESET_ADVICE: Record<TiltStatus['tiltLevel'], string[]> = {
  none: [],
  mild: [
    'Respire profondément. Focus sur les 3 prochaines vagues de CS, pas sur le score.',
    'Petit coup dur, mais le game n\'est pas fini. Concentre-toi sur ta farm et les objectifs.',
    'Tu peux renverser ça. Joue safe 2 minutes, farm, et attends une ouverture.',
  ],
  moderate: [
    'PAUSE MENTALE : Respire 3 secondes. Tu vaux mieux que ce score. Focus farm + vision, les kills viendront.',
    'Tes morts récentes ne définissent pas la game. Achète des wards, farm les lanes latérales, et laisse l\'ennemi faire des erreurs.',
    'Le tilt te pousse à forcer. STOP. Farm 2 minutes, pose des wards, et attends que ton équipe engage.',
  ],
  severe: [
    'RESET TOTAL : Tu es en tilt. Ce n\'est PAS la fin. Joue ultra-safe, farm sous tour, et concentre-toi sur les assists en teamfight.',
    'ALERTE TILT : Arrête de forcer les plays. Chaque mort nourrit l\'ennemi. Colle-toi à un allié et farm. Le late game peut tout changer.',
    'STOP. Mute le chat si nécessaire. Concentre-toi sur 1 seul objectif : ne pas mourir pendant 3 minutes. Le reste suivra.',
  ],
}

function getMockResetAdvice(level: TiltStatus['tiltLevel']): string {
  const pool = MOCK_RESET_ADVICE[level]
  if (pool.length === 0) return ''
  return pool[Math.floor(Math.random() * pool.length)]
}

async function generateResetAdvice(tiltStatus: TiltStatus, gameData: GameData): Promise<string> {
  if (DEV_MOCK_AI) {
    return getMockResetAdvice(tiltStatus.tiltLevel)
  }

  if (!anthropic) return getMockResetAdvice(tiltStatus.tiltLevel)

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      system: `Tu es un coach mental LoL. Le joueur est en tilt (niveau: ${tiltStatus.tiltLevel}, triggers: ${tiltStatus.triggers.join(', ')}). Donne UN conseil de reset mental en français, 2 phrases max. Sois empathique mais directif.`,
      messages: [{ role: 'user', content: `Score: ${gameData.kda.kills}/${gameData.kda.deaths}/${gameData.kda.assists}, ${Math.floor(gameData.gameTime / 60)} min. Conseil de reset mental.` }],
    })
    const text = message.content.find(c => c.type === 'text')
    return text && text.type === 'text' ? text.text.trim() : getMockResetAdvice(tiltStatus.tiltLevel)
  } catch {
    return getMockResetAdvice(tiltStatus.tiltLevel)
  }
}

// ── Interface publique ───────────────────────────────────────────────────────

export async function analyzeTilt(gameData: GameData): Promise<void> {
  if (!isActive) return

  const hasAccess = await guardFeature('tilt_detector')
  if (!hasAccess) return

  const status = detectTilt(gameData)

  // Broadcast le status tilt (pour un éventuel indicateur UI)
  if (status.tiltLevel !== 'none') {
    broadcastToWindows(IPC.TILT_STATUS, status)
  }

  // Si le tilt a augmenté et on n'a pas envoyé de reset récemment
  const now = Date.now()
  const TILT_RANK = { none: 0, mild: 1, moderate: 2, severe: 3 } as const
  const tiltIncreased = TILT_RANK[status.tiltLevel] > TILT_RANK[lastTiltLevel]

  if (tiltIncreased && status.tiltLevel !== 'none' && now - lastResetSentTime > TILT_COOLDOWN_MS) {
    const resetAdvice = await generateResetAdvice(status, gameData)
    if (resetAdvice) {
      // Severe → alerte courte (plus visible, 3s). Mild/Moderate → conseil overlay (plus détaillé).
      if (status.tiltLevel === 'severe') {
        broadcastToWindows(IPC.OVERLAY_SHOW_ALERT, {
          text: 'TILT DÉTECTÉ — Respire et joue safe',
          type: 'danger',
        })
      }
      // Toujours envoyer le conseil détaillé en advice
      const advice: CoachAdvice = {
        text: resetAdvice,
        style: 'LCK',
        priority: status.tiltLevel === 'severe' ? 'high' : 'medium',
        timestamp: now,
        gameTime: gameData.gameTime,
        category: 'tilt-reset',
      }
      broadcastToWindows(IPC.OVERLAY_SHOW_ADVICE, advice)

      lastResetSentTime = now
      console.log(`[TiltDetector] Reset envoyé (niveau: ${status.tiltLevel}, score: ${status.tiltScore})`)
    }
  }

  lastTiltLevel = status.tiltLevel
}

export function onTiltGameStart(): void {
  isActive = true
  snapshots = []
  lastTiltLevel = 'none'
  lastResetSentTime = 0
  console.log('[TiltDetector] Activé')
}

export function onTiltGameEnd(): void {
  isActive = false
  snapshots = []
  lastTiltLevel = 'none'
  console.log('[TiltDetector] Désactivé')
}
