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
let prevItemCount      = -1
let prevTeamKills      = -1
let prevEnemyKills     = -1
let prevDragonStacks   = -1
let prevBaronActive    = false
let prevGold           = 0

// ─── API publique ────────────────────────────────────────────────────────────

export function resetAlertEngine(): void {
  prevPlayerLevel  = -1
  prevMatchupLevel = -1
  prevMatchupDead  = false
  prevWardScore    = -1
  lastWardReminder = 0
  prevItemCount    = -1
  prevTeamKills    = -1
  prevEnemyKills   = -1
  prevDragonStacks = -1
  prevBaronActive  = false
  prevGold         = 0
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
    const expectedMin = minutesPlayed * 0.4
    if (wardScore < expectedMin && gameTime - lastWardReminder >= 180) {
      alerts.push({ text: `👁 Ward score bas (${wardScore}) — place des wards !`, type: 'warning' })
      lastWardReminder = gameTime
    }
  }
  prevWardScore = wardScore

  // ─── ITEM COMPLETION ────────────────────────────────────────────

  const itemCount = gameData.items.length
  if (prevItemCount >= 0 && itemCount > prevItemCount) {
    const newItem = gameData.items[itemCount - 1]
    if (itemCount === 1) {
      alerts.push({ text: `⚔️ Premier item complété${newItem ? ` (${newItem})` : ''} — power spike !`, type: 'success' })
    } else if (itemCount === 2) {
      alerts.push({ text: `⚔️ 2 items — spike de puissance, cherche un fight avantageux`, type: 'success' })
    } else if (itemCount === 3) {
      alerts.push({ text: `⚔️ 3 items — spike majeur, tu es au pic de puissance`, type: 'success' })
    }
  }
  prevItemCount = itemCount

  // ─── TEAM KILL STREAKS ──────────────────────────────────────────

  const { teamKills, enemyKills } = gameData
  if (prevTeamKills >= 0) {
    const teamDelta = teamKills - prevTeamKills
    const enemyDelta = enemyKills - prevEnemyKills
    // Ace ou multi-kill d'équipe
    if (teamDelta >= 3 && enemyDelta === 0) {
      alerts.push({ text: `🔥 +${teamDelta} kills en chaîne — convertis en objectif MAINTENANT`, type: 'success' })
    }
    // Ennemi ace / multi
    if (enemyDelta >= 3 && teamDelta === 0) {
      alerts.push({ text: `⚠️ L'ennemi a ${enemyDelta} kills — joue défensivement, attends les respawns`, type: 'danger' })
    }
  }
  prevTeamKills = teamKills
  prevEnemyKills = enemyKills

  // ─── DRAGON STACKS ─────────────────────────────────────────────

  const dragonStacks = gameData.objectives.dragonStacks
  if (prevDragonStacks >= 0 && dragonStacks > prevDragonStacks) {
    if (dragonStacks === 4) {
      const soul = gameData.objectives.dragonSoul
      alerts.push({ text: `🐉 DRAGON SOUL${soul ? ` ${soul}` : ''} obtenu — avantage permanent !`, type: 'success' })
    } else {
      alerts.push({ text: `🐉 Drake ${dragonStacks}/4 — ${4 - dragonStacks} restant(s) avant le Soul`, type: 'info' })
    }
  }
  prevDragonStacks = dragonStacks

  // ─── BARON BUFF ──────────────────────────────────────────────────

  if (!prevBaronActive && gameData.objectives.baronActive) {
    alerts.push({ text: `👁 BARON NASHOR obtenu — push 2 lanes, siège la base !`, type: 'success' })
  }
  prevBaronActive = gameData.objectives.baronActive

  // ─── GOLD MILESTONE ──────────────────────────────────────────────

  const currentGold = gameData.gold
  const goldThresholds = [1300, 2600, 3400]
  for (const threshold of goldThresholds) {
    if (prevGold < threshold && currentGold >= threshold && currentGold < threshold + 200) {
      alerts.push({ text: `💰 ${currentGold}g — assez pour un back efficace`, type: 'info' })
      break
    }
  }
  prevGold = currentGold

  return alerts
}
