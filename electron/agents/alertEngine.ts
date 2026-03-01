/**
 * Moteur d'alertes courtes (3s) — détecte les changements d'état en temps réel.
 * Compare l'état précédent au nouveau pour émettre des alertes ponctuelles.
 */

import type { GameAlert, GameData } from '../../shared/types'
import { getChampion } from '../../shared/champion-data'

// ─── État précédent ──────────────────────────────────────────────────────────

let prevPlayerLevel    = -1
let prevMatchupLevel   = -1
let prevMatchupDead    = false
let prevWardScore      = -1
let lastWardReminder   = 0   // gameTime du dernier rappel ward

// ─── API publique ────────────────────────────────────────────────────────────

export function resetAlertEngine(): void {
  prevPlayerLevel  = -1
  prevMatchupLevel = -1
  prevMatchupDead  = false
  prevWardScore    = -1
  lastWardReminder = 0
}

/**
 * Compare le state actuel au précédent et retourne les alertes à afficher.
 * Appelé à chaque poll (~5s).
 */
export function detectAlerts(gameData: GameData): GameAlert[] {
  const alerts: GameAlert[] = []
  const { level, matchup, wardScore, gameTime } = gameData

  // ─── PLAYER LEVEL SPIKES ───────────────────────────────────────────

  if (prevPlayerLevel > 0 && level > prevPlayerLevel) {
    if (level === 6) {
      alerts.push({ text: '✦ Niveau 6 — ton ult est disponible !', type: 'success' })
    } else if (level === 11) {
      alerts.push({ text: '✦ Niveau 11 — power spike, ult amélioré', type: 'success' })
    } else if (level === 16) {
      alerts.push({ text: '✦ Niveau 16 — ult rang max, spike massif', type: 'success' })
    }
  }
  prevPlayerLevel = level

  // ─── MATCHUP LEVEL CHANGES ────────────────────────────────────────

  if (matchup) {
    const oppLevel = matchup.level
    const oppName = matchup.champion

    if (prevMatchupLevel > 0 && oppLevel > prevMatchupLevel) {
      // Niveaux clés de l'ennemi
      if (oppLevel === 6) {
        const info = getChampion(oppName)
        const danger = info?.dangerLevel ?? 1
        const urgency = danger >= 3 ? 'danger' : 'warning'
        alerts.push({ text: `⚠️ ${oppName} niv 6 — ULT DISPONIBLE${danger >= 3 ? ', DANGER' : ''}`, type: urgency })
      } else if (oppLevel === 11) {
        alerts.push({ text: `⚠️ ${oppName} niv 11 — ult amélioré, prudence`, type: 'warning' })
      } else if (oppLevel === 16) {
        alerts.push({ text: `⚠️ ${oppName} niv 16 — ult rang max`, type: 'warning' })
      } else {
        // Level up normal
        alerts.push({ text: `⬆ ${oppName} passe niv ${oppLevel}`, type: 'info' })
      }
    }
    prevMatchupLevel = oppLevel

    // ─── MATCHUP DEATH / RESPAWN ──────────────────────────────────────

    if (!prevMatchupDead && matchup.isDead) {
      // L'ennemi vient de mourir
      const respawnStr = matchup.respawnTimer > 0 ? ` (${Math.round(matchup.respawnTimer)}s)` : ''
      alerts.push({ text: `💀 ${oppName} mort${respawnStr} — pousse ta vague !`, type: 'success' })
    } else if (prevMatchupDead && !matchup.isDead) {
      // L'ennemi vient de respawn
      alerts.push({ text: `⚠️ ${oppName} revient en jeu — attention`, type: 'warning' })
    }
    prevMatchupDead = matchup.isDead
  }

  // ─── WARD SCORE REMINDER ──────────────────────────────────────────

  if (gameTime >= 600 && wardScore >= 0) {
    const minutesPlayed = gameTime / 60
    // Ward score attendu ≈ 0.5-1 par minute en average
    const expectedMin = minutesPlayed * 0.4
    if (wardScore < expectedMin && gameTime - lastWardReminder >= 180) {
      alerts.push({ text: `👁 Ward score bas (${wardScore}) — place des wards !`, type: 'warning' })
      lastWardReminder = gameTime
    }
  }
  prevWardScore = wardScore

  return alerts
}
