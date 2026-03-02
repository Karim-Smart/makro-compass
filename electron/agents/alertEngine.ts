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
let prevGoldDiff       = 0
let goldDiffTrend      = 0    // positif = on gagne du terrain, négatif = on perd
let prevCs             = 0
let prevGameTime       = 0
let lastGoldTrendAlert = 0    // gameTime du dernier rappel tendance
let csPmHistory: number[] = [] // CS/min snapshots pour détecter les drops
let lastCsDropAlert    = 0    // gameTime du dernier rappel CS drop
let prevDeathCount     = -1
let lastDeathAlert     = 0    // gameTime de la dernière alerte mort
let deathTimestamps: number[] = []  // timestamps des morts pour tilt detection
let lastTiltAlert      = 0    // gameTime du dernier rappel tilt
let prevOppCs          = 0    // CS de l'adversaire pour détecter le farm gap
let lastFarmGapAlert   = 0    // gameTime du dernier rappel farm gap
let prevKills          = 0    // kills du joueur pour détecter les streaks
let lastKillStreakAlert = 0
let prevObjVisionAlert = 0    // gameTime du dernier rappel vision objectif

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
  prevGoldDiff     = 0
  goldDiffTrend    = 0
  prevCs           = 0
  prevGameTime     = 0
  lastGoldTrendAlert = 0
  csPmHistory.length = 0
  lastCsDropAlert  = 0
  prevDeathCount   = -1
  lastDeathAlert   = 0
  deathTimestamps.length = 0
  lastTiltAlert    = 0
  prevOppCs        = 0
  lastFarmGapAlert = 0
  prevKills        = 0
  lastKillStreakAlert = 0
  prevObjVisionAlert = 0
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

  // ─── GOLD VELOCITY (tendance du gold diff) ─────────────────────

  const currentGoldDiff = gameData.teamGold - gameData.enemyGold
  if (prevGameTime > 0 && gameTime > prevGameTime) {
    const deltaGoldDiff = currentGoldDiff - prevGoldDiff
    // Moyenne glissante pour lisser
    goldDiffTrend = goldDiffTrend * 0.6 + deltaGoldDiff * 0.4

    if (gameTime >= 600 && gameTime - lastGoldTrendAlert >= 120) {
      // On est derrière mais on rattrape fortement
      if (currentGoldDiff < -1000 && goldDiffTrend > 500) {
        alerts.push({ text: `📈 On rattrape le retard gold — continue le tempo !`, type: 'success' })
        lastGoldTrendAlert = gameTime
      }
      // On est ahead mais on perd du terrain rapidement
      if (currentGoldDiff > 2000 && goldDiffTrend < -800) {
        alerts.push({ text: `📉 L'avance gold diminue — convertis en objectif MAINTENANT`, type: 'warning' })
        lastGoldTrendAlert = gameTime
      }
    }
  }
  prevGoldDiff = currentGoldDiff
  prevGameTime = gameTime

  // ─── MULTI-OBJECTIF (baron + drake simultanés) ──────────────────

  if (gameTime >= 1200) {
    const { baronActive, elderActive } = gameData.objectives
    if (baronActive && elderActive) {
      alerts.push({ text: `🏆 BARON + ELDER actifs — siège leur base, fin de game !`, type: 'success' })
    }
  }

  // ─── CS/MIN DROP DETECTION ──────────────────────────────────────

  if (gameTime >= 300 && gameData.cs > 0) {
    const currentCspm = (gameData.cs / gameTime) * 60
    // Snapshot toutes les ~30s (6 polls à 5s)
    if (csPmHistory.length === 0 || gameTime - prevGameTime >= 25) {
      csPmHistory.push(currentCspm)
      if (csPmHistory.length > 12) csPmHistory.shift() // ~6 min de données
    }
    // Si on a assez de données et que le CS/min a chuté de 30%+
    if (csPmHistory.length >= 4 && gameTime - lastCsDropAlert >= 180) {
      const peakCspm = Math.max(...csPmHistory.slice(0, -2))
      if (peakCspm > 4 && currentCspm < peakCspm * 0.7) {
        alerts.push({ text: `📉 CS/min en chute (${currentCspm.toFixed(1)} vs ${peakCspm.toFixed(1)}) — farm les vagues !`, type: 'warning' })
        lastCsDropAlert = gameTime
      }
    }
  }
  prevCs = gameData.cs

  // ─── PLAYER DEATH (respawn awareness) ────────────────────────

  const deaths = gameData.kda.deaths
  if (prevDeathCount >= 0 && deaths > prevDeathCount && gameTime - lastDeathAlert >= 30) {
    // Respawn timer estimé : 12 + 2 * level secondes (approximation LoL)
    const estRespawn = Math.round(12 + 2 * gameData.level)
    if (gameTime >= 1500) {
      alerts.push({ text: `💀 Mort en late (~${estRespawn}s respawn) — chaque mort coûte cher ici`, type: 'danger' })
    } else if (deaths >= 3 && gameTime < 900) {
      alerts.push({ text: `💀 ${deaths} morts en early — joue plus safe, chaque mort nourrit l'ennemi`, type: 'danger' })
    }
    lastDeathAlert = gameTime
  }
  prevDeathCount = deaths

  // ─── TILT DETECTION (morts rapprochées) ───────────────────────

  if (deaths > 0 && prevDeathCount >= 0 && deaths > prevDeathCount) {
    deathTimestamps.push(gameTime)
    // Garder seulement les 2 dernières minutes
    while (deathTimestamps.length > 0 && gameTime - deathTimestamps[0] > 120) {
      deathTimestamps.shift()
    }
  }

  if (deathTimestamps.length >= 3 && gameTime - lastTiltAlert >= 180) {
    // 3+ morts en 2 minutes = potentiel tilt
    const recentDeaths = deathTimestamps.filter(t => gameTime - t <= 120).length
    if (recentDeaths >= 3) {
      alerts.push({ text: `🧊 ${recentDeaths} morts en 2 min — RESPIRE. Farm safe, ne force rien`, type: 'danger' })
      lastTiltAlert = gameTime
    }
  }

  // ─── KILL STREAK DETECTION ────────────────────────────────────

  const myKills = gameData.kda.kills
  if (prevKills >= 0 && myKills > prevKills) {
    const killsGained = myKills - prevKills
    if (myKills >= 5 && killsGained >= 1 && gameTime - lastKillStreakAlert >= 60) {
      if (myKills >= 8) {
        alerts.push({ text: `🔥 GODLIKE — ${myKills} kills ! Convertis en objectifs, ne greed pas`, type: 'success' })
      } else {
        alerts.push({ text: `🔥 On fire (${myKills} kills) — attention à ta bounty, joue smart`, type: 'success' })
      }
      lastKillStreakAlert = gameTime
    }
  }
  prevKills = myKills

  // ─── FARM GAP WIDENING ───────────────────────────────────────

  if (matchup && gameTime >= 300 && gameTime - lastFarmGapAlert >= 120) {
    const csDiff = gameData.cs - matchup.oppCs
    const prevDiff = prevCs - prevOppCs

    // Le gap se creuse en notre défaveur (on perd 15+ CS en 30s)
    if (prevOppCs > 0 && prevDiff > csDiff + 15 && csDiff < -20) {
      alerts.push({ text: `📉 Farm gap qui se creuse (-${Math.abs(csDiff)} CS) — priorise les last hits`, type: 'warning' })
      lastFarmGapAlert = gameTime
    }
    // L'ennemi nous rattrape alors qu'on était ahead
    if (prevDiff >= 20 && csDiff < 10 && prevOppCs > 0) {
      alerts.push({ text: `⚠️ L'ennemi rattrape ton avance CS — ne laisse pas les vagues crash`, type: 'warning' })
      lastFarmGapAlert = gameTime
    }
    prevOppCs = matchup.oppCs
  } else if (matchup) {
    prevOppCs = matchup.oppCs
  }

  // ─── VISION WARNING BEFORE OBJECTIVES ─────────────────────────

  if (gameTime >= 240 && gameTime - prevObjVisionAlert >= 120) {
    const wardPerMin = gameTime > 0 ? (wardScore / (gameTime / 60)) : 0
    const isLowVision = wardPerMin < 0.35

    // Drake spawn dans ~60s et vision basse
    const drakeSpawnsSoon = (gameTime >= 240 && gameTime < 300 && (300 - gameTime) <= 60)
    // Baron spawn dans ~90s et vision basse
    const baronSpawnsSoon = (gameTime >= 1110 && gameTime < 1200 && (1200 - gameTime) <= 90)

    if (isLowVision && (drakeSpawnsSoon || baronSpawnsSoon)) {
      const obj = baronSpawnsSoon ? 'Baron' : 'Drake'
      alerts.push({ text: `👁 ${obj} bientôt — ta vision est trop basse ! Place des wards maintenant`, type: 'warning' })
      prevObjVisionAlert = gameTime
    }
  }

  return alerts
}
