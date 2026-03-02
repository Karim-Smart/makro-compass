/**
 * Moteur de conseils macro — 100% code, zéro IA.
 * Génère des tips contextuels basés sur le game state Riot API.
 * Toujours un message à afficher, jamais vide.
 */

import type { CoachingStyle, GameData } from '../../shared/types'
import {
  getChampion,
  getMatchupTip,
  getAllyTip,
  getClassMatchup,
  analyzeEnemyComp,
} from '../../shared/champion-data'

// ─── Constantes de timing LoL ──────────────────────────────────────────────

const DRAGON_RESPAWN  = 300   // 5 min
const BARON_RESPAWN   = 360   // 6 min
const HERALD_RESPAWN  = 360   // 6 min
const FIRST_DRAGON    = 300   // 5:00
const BARON_SPAWN     = 1200  // 20:00
const PLATES_FALL     = 840   // 14:00

// ─── État interne ──────────────────────────────────────────────────────────

let lastDragonKillAt  = -1  // gameTime en secondes
let lastBaronKillAt   = -1
let lastHeraldKillAt  = -1
let lastTipText       = ''
let rotationIdx       = 0

// Tracker les 5 derniers tips pour éviter la répétition
const recentTips: string[] = []

// Cooldowns par catégorie : category → gameTime du dernier broadcast
const categoryCooldowns: Record<string, number> = {}

// Durées des cooldowns par catégorie (secondes de gameTime)
const CATEGORY_CD: Record<string, number> = {
  'cs':              120,   // CS feedback max 1 fois / 2 min
  'ally':             90,   // ally tip max 1 fois / 1.5 min
  'class-rule':       60,   // class matchup max 1 fois / 1 min
  'phase':            45,   // tips de phase max 1 fois / 45s
  'comp':             90,   // enemy comp max 1 fois / 1.5 min
  'power-curve':      90,   // power curve max 1 fois / 1.5 min
  'gold-diff':       120,   // gold diff max 1 fois / 2 min
  'structural':      180,   // avance structurelle max 1 fois / 3 min
  'back-timing':     120,   // back timing max 1 fois / 2 min
  'bounty':          180,   // bounty awareness max 1 fois / 3 min
  'death-analysis':  180,   // death analysis max 1 fois / 3 min
  'kp':              180,   // kill participation max 1 fois / 3 min
  'vision':          180,   // vision reminder max 1 fois / 3 min
  'wave':            120,   // wave management max 1 fois / 2 min
  'herald-timer':    120,   // herald timer max 1 fois / 2 min
  'map-trade':       120,   // map trade awareness max 1 fois / 2 min
  'grub-timer':      180,   // void grubs reminder max 1 fois / 3 min
  'rotation':        120,   // cross-map rotation max 1 fois / 2 min
}

// ─── Helpers anti-répétition ──────────────────────────────────────────────

function isRecentTip(text: string): boolean {
  const prefix = text.slice(0, 25)
  return recentTips.some(t => t.startsWith(prefix))
}

function addRecentTip(text: string): void {
  recentTips.push(text)
  if (recentTips.length > 5) recentTips.shift()
}

function isCategoryOnCooldown(category: string | undefined, gameTime: number): boolean {
  if (!category) return false
  const cd = CATEGORY_CD[category]
  if (cd === undefined) return false
  const last = categoryCooldowns[category] ?? -Infinity
  return gameTime - last < cd
}

function markCategoryUsed(category: string | undefined, gameTime: number): void {
  if (category) categoryCooldowns[category] = gameTime
}

// ─── Variantes de tips par style de coaching ─────────────────────────────────

const STYLE_TIPS: Record<CoachingStyle, {
  killAhead: string[]
  killBehind: string[]
  drake: string[]
  towerAhead: string[]
  towerBehind: string[]
  plates: string
  itemSpike: string
}> = {
  LCK: {
    killAhead: [
      'Convertis en objectifs — contrôle la vision, force des rotations',
      'Avantage solide. Push les lanes, setup vision, prends les objectifs',
      'Ne force pas les fights inutiles — convertis ce lead en tours et drakes',
    ],
    killBehind: [
      'Farm safe, vision défensive, attends une erreur ennemie',
      'Joue patient — ward les flancs, farm sous tour, scale',
      'Ne cherche pas le hero play. Farm, vision, et attends ton spike',
    ],
    drake: [
      'Setup vision 1 min avant, contrôle les bushes autour du pit',
      'Slow push bot → crash → rotation drake avec la prio',
      'Place 2 wards min dans la rivière 45s avant le spawn',
    ],
    towerAhead: [
      'Contrôle de map acquis — vision deep dans leur jungle, deny les camps',
      'Tours d\'avance = vision gratuite. Place des wards offensives',
    ],
    towerBehind: [
      'Ward défensivement, ne face-check jamais. Farm les vagues qui arrivent',
      'Tours perdues = danger. Joue groupé, évite les rotations solo',
    ],
    plates: 'Slow push et crash pour maximiser le gold',
    itemSpike: 'Cherche un trade avantageux, pas un all-in risqué',
  },
  LEC: {
    killAhead: [
      'Snowball ! Push → tower → drake en chaîne, 0 répit',
      'Gold lead = tempo. Force les objectifs en chaîne maintenant',
      'Ahead = agressif. Envahis la jungle, prends tout, étouffe la map',
    ],
    killBehind: [
      'Cherche un roam créatif pour comeback — un pick change tout',
      'Find the play ! Catch un carry isolé en rotation, ça relance',
      'Behind mais pas fini — cherche l\'angle créatif pour revenir',
    ],
    drake: [
      'Push bot lane, crash + rotation drake immédiate = snowball',
      'Drake = accélérateur. Force le fight, c\'est TON moment',
      'Prio bot → drake. Si ils contest, c\'est fight avantageux',
    ],
    towerAhead: [
      'Tours tombées = map ouverte. Envahis leur jungle, prends tout',
      'Avantage de tours = pression constante. Ne laisse pas respirer',
    ],
    towerBehind: [
      'Perdu des tours mais le comeback EU c\'est ça — cherche le pick',
      'Map rétrécie, mais un bon roam peut tout renverser',
    ],
    plates: 'Push agressif, chaque plaque = 160g de snowball',
    itemSpike: 'Force un play agressif, convertis en objectif',
  },
  LCS: {
    killAhead: [
      'Groupe pour objectifs en équipe — convertis ce lead ensemble',
      'Avantage kills = force des teamfights autour des objectifs',
      'Ahead en équipe → regroupe et force les objectifs groupés',
    ],
    killBehind: [
      'Groupe, un bon teamfight renverse tout — cherche le bon moment',
      'Behind mais en équipe on est forts. Groupe et fight smart',
      'Attends le bon engage — un teamfight gagné = retour dans la game',
    ],
    drake: [
      'Groupe 4-5 pour drake, peel le carry, vision pit',
      'Drake = objectif d\'équipe. Regroupe 30s avant le spawn',
      'Tout le monde bot pour drake — pas de solo plays maintenant',
    ],
    towerAhead: [
      'Tours d\'avance — groupe pour dive ou siège, joue en équipe',
      'Bonne structure de tours. Continue de grouper pour les objectifs',
    ],
    towerBehind: [
      'Tours perdues — regroupe défensivement, ne splitte pas seul',
      'Défends en groupe, un bon teamfight sous tour peut tout changer',
    ],
    plates: 'Groupe pour push et partager le gold d\'équipe',
    itemSpike: 'Cherche un teamfight d\'équipe autour d\'un objectif',
  },
  LPL: {
    killAhead: [
      'Envahis leur jungle, étouffe-les, 0 répit, 0 respiration',
      'Ahead = HUNT. Chasse les isolés, deny tous leurs camps',
      'Pression maximale ! Dive, invade, force le fight partout',
    ],
    killBehind: [
      'Cherche le pick ! 1 kill = tempo, ça suffit pour relancer',
      'Behind ? Force le fight anyway — un coin-flip peut payer',
      'Joue agressif même en retard. Un pick aggressif = retour au jeu',
    ],
    drake: [
      'Force le fight au drake — pas de concession, jamais',
      'Drake = fight. Arrive en avance, force le combat, pas de gratuit',
      'Contest CHAQUE drake. Un smite steal peut retourner la game',
    ],
    towerAhead: [
      'Tours détruites = jungle ouverte. Envahis TOUT, hunt les isolés',
      'Avantage structurel → pression constante, dive les tours restantes',
    ],
    towerBehind: [
      'Tours perdues mais l\'agression paie. Force les fights à tes conditions',
      'Map compressée = density. Catch les ennemis qui greed trop loin',
    ],
    plates: 'Dive si nécessaire, chaque plaque compte',
    itemSpike: 'Force le fight immédiat, écrasse-les',
  },
}

// ─── API publique ──────────────────────────────────────────────────────────

export function trackObjectiveKill(type: 'dragon' | 'baron' | 'herald', eventTime: number): void {
  switch (type) {
    case 'dragon': lastDragonKillAt = eventTime; break
    case 'baron':  lastBaronKillAt  = eventTime; break
    case 'herald': lastHeraldKillAt = eventTime; break
  }
}

export function resetMacroEngine(): void {
  lastDragonKillAt = -1
  lastBaronKillAt  = -1
  lastHeraldKillAt = -1
  lastTipText      = ''
  rotationIdx      = 0
  recentTips.length = 0
  for (const k in categoryCooldowns) delete categoryCooldowns[k]
}

interface Tip {
  text: string
  priority: 'low' | 'medium' | 'high'
  weight: number
  category?: string
}

export function generateMacroTip(
  gameData: GameData,
  style: CoachingStyle = 'LCK',
): { text: string; priority: 'low' | 'medium' | 'high'; category?: string } {
  const tips: Tip[] = []
  const styleTips = STYLE_TIPS[style]
  const {
    gameTime, matchup, objectives, towers, teamKills, enemyKills,
    champion, items, gameMode, cs, allies, enemies,
    teamGold, enemyGold,
  } = gameData
  const killDiff = teamKills - enemyKills
  const csPerMin = gameTime > 60 ? cs / (gameTime / 60) : 0
  const goldDiff = teamGold - enemyGold

  // ─── CRITICAL (weight 100+) ────────────────────────────────────────

  if (objectives.elderActive) {
    tips.push({ text: '🐲 ELDER ACTIF — force le teamfight MAINTENANT, exécute sous 20% HP', priority: 'high', weight: 150, category: 'elder-active' })
  }

  if (objectives.baronActive) {
    tips.push({ text: '👁 BARON BUFF — split 1-3-1, push 2 lanes en même temps, ne fight pas', priority: 'high', weight: 140, category: 'baron-buff' })
  }

  if (objectives.dragonStacks === 3) {
    tips.push({ text: '🐉 SOUL POINT — prochain drake = Dragon Soul ! Setup vision bot 1 min avant', priority: 'high', weight: 130, category: 'soul-point' })
  }

  if (objectives.enemyDragonStacks === 3) {
    tips.push({ text: '⚠️ SOUL POINT ennemi — conteste le prochain drake ABSOLUMENT', priority: 'high', weight: 135, category: 'soul-point' })
  }

  // Dragon soul type-specific tips
  if (objectives.dragonStacks >= 4 && objectives.dragonSoul) {
    const soulType = objectives.dragonSoul
    const soulTips: Record<string, string> = {
      'Infernal':  '🐉 Soul Infernal — teamfight explosif, cherche l\'engage direct',
      'Ocean':     '🐉 Soul Océan — tu régénères en combat, flanque et engage long',
      'Mountain':  '🐉 Soul Montagne — tank les tours, dive les carrys',
      'Cloud':     '🐉 Soul Nuage — kite les ennemis, joue mobile et espacé',
      'Chemtech':  '🐉 Soul Chémtech — utilise la fenêtre de revie pour dive sans risque',
      'Hextech':   '🐉 Soul Hextech — CC chain, engage sur leur carry en premier',
    }
    const soulText = soulTips[soulType] ?? `🏆 Dragon Soul ${soulType} — avantage permanent, force la pression`
    tips.push({ text: soulText, priority: 'high', weight: 110, category: 'dragon-soul' })
  }

  // ─── OBJECTIVE COUNTDOWNS (weight 80-99) ───────────────────────────

  // Drake countdown
  if (lastDragonKillAt > 0) {
    const next = lastDragonKillAt + DRAGON_RESPAWN
    const cd = Math.floor(next - gameTime)
    const drakeTip = styleTips.drake[rotationIdx % styleTips.drake.length]
    if (cd > 0 && cd <= 30) {
      tips.push({ text: `🐉 Drake dans ${cd}s ! ${drakeTip}`, priority: 'high', weight: 95, category: 'drake-timer' })
    } else if (cd > 30 && cd <= 60) {
      tips.push({ text: `🐉 Drake dans ${cd}s — ${drakeTip}`, priority: 'medium', weight: 85, category: 'drake-timer' })
    } else if (cd > 60 && cd <= 90) {
      tips.push({ text: `🐉 Drake respawn dans ~${Math.floor(cd / 60)} min — commence à préparer`, priority: 'low', weight: 45, category: 'drake-timer' })
    }
  } else if (gameTime > 0 && gameTime < FIRST_DRAGON) {
    const cd = Math.floor(FIRST_DRAGON - gameTime)
    const drakeTip = styleTips.drake[rotationIdx % styleTips.drake.length]
    if (cd <= 30) {
      tips.push({ text: `🐉 Premier drake dans ${cd}s ! ${drakeTip}`, priority: 'high', weight: 90, category: 'drake-timer' })
    } else if (cd <= 60) {
      tips.push({ text: `🐉 Premier drake dans ${cd}s — ${drakeTip}`, priority: 'medium', weight: 80, category: 'drake-timer' })
    }
  }

  // Baron countdown
  if (gameTime >= BARON_SPAWN && lastBaronKillAt > 0) {
    const next = lastBaronKillAt + BARON_RESPAWN
    const cd = Math.floor(next - gameTime)
    if (cd > 0 && cd <= 30) {
      tips.push({ text: `👁 Baron dans ${cd}s ! Groupe top et contrôle le pit`, priority: 'high', weight: 95, category: 'baron-timer' })
    } else if (cd > 30 && cd <= 60) {
      tips.push({ text: `👁 Baron respawn dans ${cd}s — prépare la vision`, priority: 'medium', weight: 85, category: 'baron-timer' })
    }
  }

  // Baron approaching 20 min
  if (gameTime >= 1080 && gameTime < BARON_SPAWN) {
    const cd = Math.floor(BARON_SPAWN - gameTime)
    if (cd <= 30) {
      tips.push({ text: `👁 Baron spawn dans ${cd}s ! Ward le pit maintenant`, priority: 'high', weight: 90, category: 'baron-timer' })
    } else if (cd <= 60) {
      tips.push({ text: `👁 Baron spawn dans ${cd}s — prépare la vision top side`, priority: 'medium', weight: 80, category: 'baron-timer' })
    }
  }

  // Herald countdown
  if (lastHeraldKillAt > 0 && gameTime < BARON_SPAWN) {
    const next = lastHeraldKillAt + HERALD_RESPAWN
    const cd = Math.floor(next - gameTime)
    if (cd > 0 && cd <= 60 && next < BARON_SPAWN) {
      tips.push({ text: `🟡 Héraut respawn dans ${cd}s — utilise-le pour crash une tour`, priority: 'medium', weight: 75, category: 'herald-timer' })
    }
  }

  // ─── MAP TRADE AWARENESS (weight 55-72) ────────────────────────────
  // Quand un objectif est pris d'un côté, suggérer un trade de l'autre

  if (gameTime >= 300 && gameTime < 1200) {
    // Si drake vient d'être pris récemment (< 30s) et Héraut est up
    if (lastDragonKillAt > 0 && gameTime - lastDragonKillAt < 30 && gameTime < BARON_SPAWN) {
      const heraldUp = lastHeraldKillAt < 0 || (gameTime > lastHeraldKillAt + HERALD_RESPAWN)
      if (heraldUp) {
        tips.push({ text: '🔄 Ennemi a pris le Drake ? Trade Héraut de l\'autre côté !', priority: 'medium', weight: 65, category: 'map-trade' })
      }
    }
    // Si herald vient d'être pris et drake est up
    if (lastHeraldKillAt > 0 && gameTime - lastHeraldKillAt < 30) {
      const drakeUp = lastDragonKillAt < 0 || (gameTime > lastDragonKillAt + DRAGON_RESPAWN)
      if (drakeUp) {
        tips.push({ text: '🔄 Héraut pris — trade Drake si possible !', priority: 'medium', weight: 65, category: 'map-trade' })
      }
    }
  }

  // Void Grubs (spawn à 5:00, respawn 5 min, disparaissent à 14:00)
  if (gameTime >= 270 && gameTime < 840) {
    const grubSpawn = 300
    if (gameTime < grubSpawn) {
      const cd = Math.floor(grubSpawn - gameTime)
      if (cd <= 30) {
        tips.push({ text: `🪲 Void Grubs spawn dans ${cd}s — prio top si ton jungler est top side`, priority: 'low', weight: 42, category: 'grub-timer' })
      }
    } else {
      // Grubs existent, rappeler leur importance
      tips.push({ text: '🪲 Void Grubs = push gratuit. Aide ton jungler à les prendre', priority: 'low', weight: 25, category: 'grub-timer' })
    }
  }

  // Cross-map rotation awareness
  if (gameTime >= 600 && gameTime < 1500 && killDiff >= 2) {
    const pos = matchup?.position ?? ''
    if (pos === 'TOP' || pos === 'MIDDLE') {
      tips.push({ text: '🔄 Ahead — push ta lane et roam bot/drake pour convertir l\'avance', priority: 'low', weight: 30, category: 'rotation' })
    } else if (pos === 'BOTTOM' || pos === 'UTILITY') {
      tips.push({ text: '🔄 Ahead — push ta lane et roam mid/herald pour convertir', priority: 'low', weight: 30, category: 'rotation' })
    }
  }

  // ─── RESPAWN WINDOW (weight 88) ─────────────────────────────────────
  // Fenêtre de push quand l'adversaire est mort avec timer connu

  if (matchup && matchup.isDead && matchup.respawnTimer > 10) {
    const respawnSec = Math.round(matchup.respawnTimer)
    tips.push({
      text: `💀 ${matchup.champion} mort (${respawnSec}s) — push jusqu'à la tour !`,
      priority: 'high',
      weight: 88,
      category: 'respawn-window',
    })
  }

  // ─── LEVEL MATCHUP (weight 60-78) ──────────────────────────────────

  if (matchup && matchup.levelDiff !== 0) {
    const opp = matchup.champion
    const diff = matchup.levelDiff
    if (diff <= -2) {
      tips.push({ text: `⬇ ${Math.abs(diff)} niveaux de retard sur ${opp} — joue sous tour, farm safe`, priority: 'high', weight: 78, category: 'level-diff' })
    } else if (diff === -1) {
      tips.push({ text: `⬇ 1 niveau de retard vs ${opp} — évite les all-in, farm pour rattraper`, priority: 'medium', weight: 65, category: 'level-diff' })
    } else if (diff === 1) {
      tips.push({ text: `⬆ +1 niveau sur ${opp} — trade avantageux, profite de la fenêtre`, priority: 'medium', weight: 60, category: 'level-diff' })
    } else if (diff >= 2) {
      tips.push({ text: `⬆ +${diff} niveaux sur ${opp} — zone-le du CS, cherche le dive`, priority: 'high', weight: 70, category: 'level-diff' })
    }
  }

  // ─── CHAMPION MATCHUP (weight 55-75) ──────────────────────────────

  if (matchup) {
    const matchupTip = getMatchupTip(matchup.champion)
    if (matchupTip) {
      const danger = getChampion(matchup.champion)?.dangerLevel ?? 1
      const w = danger === 3 ? 75 : danger === 2 ? 65 : 55
      tips.push({ text: `⚔️ vs ${matchup.champion} — ${matchupTip}`, priority: danger >= 3 ? 'high' : 'medium', weight: w, category: 'matchup' })
    }

    // Conseil class vs class
    const classRule = getClassMatchup(champion, matchup.champion)
    if (classRule) {
      tips.push({ text: `🎯 ${classRule.text}`, priority: classRule.priority, weight: 40, category: 'class-rule' })
    }
  }

  // ─── POWER CURVE WARNINGS (weight 50-58) ──────────────────────────

  if (matchup) {
    const enemyInfo = getChampion(matchup.champion)
    if (enemyInfo) {
      const phase = gameTime < 840 ? 'early' : gameTime < 1500 ? 'mid' : 'late'
      if (enemyInfo.power === phase) {
        tips.push({ text: `⚠️ ${matchup.champion} est dans sa phase FORTE (${phase}) — joue prudemment`, priority: 'medium', weight: 58, category: 'power-curve' })
      } else if (
        (enemyInfo.power === 'late' && phase === 'early') ||
        (enemyInfo.power === 'early' && phase === 'late')
      ) {
        tips.push({ text: `💡 ${matchup.champion} est FAIBLE en ${phase} — profite de ta fenêtre`, priority: 'medium', weight: 52, category: 'power-curve' })
      }
    }
  }

  // ─── GOLD DIFF (weight 52-55) ──────────────────────────────────────

  if (goldDiff > 3000) {
    const kStr = (goldDiff / 1000).toFixed(1)
    tips.push({ text: `💰 Avantage or +${kStr}k — force les objectifs maintenant`, priority: 'medium', weight: 55, category: 'gold-diff' })
  } else if (goldDiff < -3000) {
    const kStr = (Math.abs(goldDiff) / 1000).toFixed(1)
    tips.push({ text: `💸 Retard or -${kStr}k — joue patient, cherche les picks`, priority: 'medium', weight: 52, category: 'gold-diff' })
  }

  // ─── ENEMY COMPOSITION (weight 50) ────────────────────────────────

  if (enemies.length >= 3) {
    const compTips = analyzeEnemyComp(enemies)
    for (const compTip of compTips) {
      tips.push({ text: compTip, priority: 'medium', weight: 50, category: 'comp' })
    }
  }

  // ─── STRUCTURAL ADVANTAGE (composite kills + towers) ───────────────

  const towerDiff = towers.enemyDestroyed - towers.allyDestroyed
  if (killDiff >= 3 && towerDiff >= 2) {
    tips.push({
      text: `🏆 Avance structurelle (+${killDiff} kills, +${towers.enemyDestroyed} tours) — siège leur base`,
      priority: 'high',
      weight: 68,
      category: 'structural',
    })
  }

  // ─── KILL DIFF (weight 48-65) ──────────────────────────────────────

  if (killDiff >= 5) {
    const msg = styleTips.killAhead[rotationIdx % styleTips.killAhead.length]
    tips.push({ text: `💀 +${killDiff} kills — ${msg}`, priority: killDiff >= 10 ? 'high' : 'medium', weight: killDiff >= 10 ? 65 : 55, category: 'kill-diff' })
  } else if (killDiff >= 3) {
    const msg = styleTips.killAhead[rotationIdx % styleTips.killAhead.length]
    tips.push({ text: `📈 +${killDiff} kills — ${msg}`, priority: 'medium', weight: 48, category: 'kill-diff' })
  } else if (killDiff <= -5) {
    const msg = styleTips.killBehind[rotationIdx % styleTips.killBehind.length]
    tips.push({ text: `⚠️ ${Math.abs(killDiff)} kills de retard — ${msg}`, priority: killDiff <= -10 ? 'high' : 'medium', weight: killDiff <= -10 ? 65 : 55, category: 'kill-diff' })
  } else if (killDiff <= -3) {
    const msg = styleTips.killBehind[rotationIdx % styleTips.killBehind.length]
    tips.push({ text: `📉 ${Math.abs(killDiff)} kills de retard — ${msg}`, priority: 'medium', weight: 48, category: 'kill-diff' })
  }

  // ─── TOWER STATE (weight 40-55) ────────────────────────────────────

  if (towerDiff >= 3) {
    const msg = styleTips.towerAhead[rotationIdx % styleTips.towerAhead.length]
    tips.push({ text: `🏰 +${towers.enemyDestroyed} tours — ${msg}`, priority: 'medium', weight: 55, category: 'tower-state' })
  } else if (towerDiff <= -3) {
    const msg = styleTips.towerBehind[rotationIdx % styleTips.towerBehind.length]
    tips.push({ text: `🏰 ${towers.allyDestroyed} tours perdues — ${msg}`, priority: 'medium', weight: 55, category: 'tower-state' })
  }

  // ─── ALLY TIPS (weight 28) ─────────────────────────────────────────

  if (allies.length > 0) {
    const allyIdx = rotationIdx % allies.length
    const allyName = allies[allyIdx]
    const atp = getAllyTip(allyName)
    if (atp) {
      tips.push({ text: `🤝 ${allyName} — ${atp}`, priority: 'low', weight: 28, category: 'ally' })
    }
  }

  // ─── PLATES REMINDER (weight 42) ────────────────────────────────────

  if (gameTime >= 720 && gameTime < PLATES_FALL) {
    const cd = Math.floor(PLATES_FALL - gameTime)
    tips.push({ text: `💰 Plaques dans ${cd}s — ${styleTips.plates}`, priority: 'medium', weight: 42, category: 'plates' })
  }

  // ─── ITEMS POWER SPIKE (weight 33-38) ──────────────────────────────

  const completedItems = items.length
  if (completedItems === 1 && gameTime >= 480 && gameTime < 900) {
    tips.push({ text: `⚔️ Premier item complété — ${styleTips.itemSpike}`, priority: 'low', weight: 38, category: 'item-spike' })
  } else if (completedItems === 2 && gameTime >= 900) {
    tips.push({ text: `⚔️ 2 items — ${styleTips.itemSpike}`, priority: 'low', weight: 35, category: 'item-spike' })
  } else if (completedItems >= 3) {
    tips.push({ text: `⚔️ ${completedItems} items — ${styleTips.itemSpike}`, priority: 'low', weight: 33, category: 'item-spike' })
  }

  // ─── BACK TIMING (weight 30-35) ────────────────────────────────────

  const goldForItem = gameData.gold
  if (goldForItem >= 1250 && goldForItem < 1350 && completedItems === 0 && gameTime < 900) {
    tips.push({ text: `💰 ${goldForItem}g — assez pour un composant clé, cherche un back timing`, priority: 'low', weight: 32, category: 'back-timing' })
  } else if (goldForItem >= 3000 && completedItems <= 1 && gameTime < 1200) {
    tips.push({ text: `💰 ${goldForItem}g en poche — back MAINTENANT pour spike d'item`, priority: 'medium', weight: 35, category: 'back-timing' })
  }

  // ─── WAVE MANAGEMENT (weight 25-38) ──────────────────────────

  if (matchup && gameTime >= 180) {
    const pos = matchup.position
    const isLaner = pos === 'TOP' || pos === 'MIDDLE' || pos === 'BOTTOM'

    if (isLaner && gameTime < 840) {
      // Early laning : wave management basique
      const csDiff = cs - matchup.oppCs
      if (csDiff >= 20 && matchup.levelDiff >= 0) {
        tips.push({ text: '🌊 Avance CS — freeze devant ta tour pour zoner l\'ennemi du farm', priority: 'low', weight: 30, category: 'wave' })
      } else if (csDiff <= -15 && matchup.levelDiff <= 0) {
        tips.push({ text: '🌊 CS retard — laisse la vague pousser vers toi, farm sous tour', priority: 'low', weight: 28, category: 'wave' })
      }
    }

    if (isLaner && gameTime >= 840 && gameTime < 1500) {
      // Mid game : side lane management
      if (killDiff >= 3) {
        tips.push({ text: '🌊 Ahead — slow push side lane puis regroupe pour objectif', priority: 'low', weight: 32, category: 'wave' })
      } else if (killDiff <= -3) {
        tips.push({ text: '🌊 Behind — catch les vagues sous tour, ne farm pas dans la rivière', priority: 'medium', weight: 35, category: 'wave' })
      }
    }

    if (pos === 'JUNGLE' && gameTime >= 600 && gameTime < 1200) {
      // Jungler mid game : rappel de farm camps
      if (csPerMin < 5) {
        tips.push({ text: '🌿 Clear tes camps entre les ganks — un jungler sans farm est inutile en mid game', priority: 'low', weight: 25, category: 'wave' })
      }
    }
  }

  // ─── BOUNTY AWARENESS (weight 40-48) ─────────────────────────────

  const myKills = gameData.kda.kills
  const myDeaths = gameData.kda.deaths
  if (myKills >= 3 && myDeaths === 0) {
    const bountyGold = 150 + (myKills - 2) * 100  // approximation
    tips.push({ text: `⚠️ Tu as une bounty ~${bountyGold}g — ne prends pas de risques inutiles`, priority: 'medium', weight: 44, category: 'bounty' })
  }
  if (matchup && matchup.oppKda.kills >= 4 && matchup.oppKda.deaths <= 1) {
    tips.push({ text: `💰 ${matchup.champion} a une grosse bounty — un shutdown = retour dans la game`, priority: 'medium', weight: 46, category: 'bounty' })
  }

  // ─── DEATH ANALYSIS (weight 32-45) ───────────────────────────────

  if (myDeaths >= 3 && gameTime < 900) {
    tips.push({ text: `💀 ${myDeaths} morts avant 15 min — joue plus safe, farm sous tour, attends le mid game`, priority: 'high', weight: 45, category: 'death-analysis' })
  } else if (myDeaths >= 5) {
    tips.push({ text: `💀 ${myDeaths} morts — chaque mort donne 300g+ et du tempo. Joue groupé`, priority: 'medium', weight: 38, category: 'death-analysis' })
  }

  // ─── KP AWARENESS (weight 20-30) ─────────────────────────────────

  const kp = teamKills > 0 ? ((gameData.kda.kills + gameData.kda.assists) / teamKills) * 100 : 0
  if (gameTime >= 600 && kp < 30 && teamKills >= 5) {
    tips.push({ text: `🤝 ${kp.toFixed(0)}% KP — tu n'es pas assez impliqué. Roam ou groupe plus`, priority: 'medium', weight: 28, category: 'kp' })
  } else if (kp >= 80 && teamKills >= 8) {
    tips.push({ text: `🤝 ${kp.toFixed(0)}% KP — tu es partout ! Continue d'impacter la map`, priority: 'low', weight: 18, category: 'kp' })
  }

  // ─── VISION PROACTIVE (weight 25-35) ─────────────────────────────

  const visionPerMin = gameTime > 60 ? gameData.wardScore / (gameTime / 60) : 0
  if (gameTime >= 600 && visionPerMin < 0.3) {
    tips.push({ text: `👁 Vision score très bas — achète des wards de contrôle, place-les avant les objectifs`, priority: 'medium', weight: 30, category: 'vision' })
  }

  // ─── CS FEEDBACK PAR RÔLE (weight 20-30) ───────────────────────────

  if (gameTime >= 300 && csPerMin > 0) {
    const role = matchup?.position ?? ''
    const isJungle = role === 'JUNGLE'
    const isSupport = role === 'UTILITY'
    // Benchmarks réalistes par rôle (Diamond+)
    const csBench = isJungle ? { bad: 5, ok: 6, good: 7.5 }
      : isSupport ? { bad: 0.8, ok: 1.5, good: 2.5 }
      : { bad: 5.5, ok: 7, good: 8.5 }

    if (!isSupport && csPerMin < csBench.bad) {
      tips.push({ text: `📊 ${csPerMin.toFixed(1)} CS/min — c'est très bas, focus les last hits, chaque 15 CS = 1 kill`, priority: 'medium', weight: 28, category: 'cs' })
    } else if (!isSupport && csPerMin < csBench.ok) {
      tips.push({ text: `📊 ${csPerMin.toFixed(1)} CS/min — essaie d'atteindre ${csBench.good}+, ne rate pas les canons`, priority: 'low', weight: 22, category: 'cs' })
    } else if (csPerMin >= csBench.good * 1.1) {
      tips.push({ text: `📊 ${csPerMin.toFixed(1)} CS/min — excellent farming, garde ce rythme`, priority: 'low', weight: 20, category: 'cs' })
    }

    // CS diff vs adversaire
    if (matchup && !isJungle && !isSupport) {
      const csDiff = cs - matchup.oppCs
      if (csDiff >= 30) {
        tips.push({ text: `📈 +${csDiff} CS d'avance sur ${matchup.champion} — ton lead farm paye`, priority: 'low', weight: 18, category: 'cs' })
      } else if (csDiff <= -30) {
        tips.push({ text: `📉 -${Math.abs(csDiff)} CS de retard sur ${matchup.champion} — focus CS, chaque vague compte`, priority: 'medium', weight: 26, category: 'cs' })
      }
    }
  }

  // ─── TEMPO AWARENESS (weight 42-55) ─────────────────────────────
  // Détection de stagnation ou d'accélération de jeu

  if (gameTime >= 900) {
    const goldPerMin = (teamGold > 0 && gameTime > 0) ? (teamGold / (gameTime / 60)) : 0
    const enemyGoldPerMin = (enemyGold > 0 && gameTime > 0) ? (enemyGold / (gameTime / 60)) : 0

    // On a du gold lead mais l'ennemi farm mieux → on stagne
    if (goldDiff > 2000 && enemyGoldPerMin > goldPerMin * 0.95 && teamKills > enemyKills + 2) {
      tips.push({
        text: `⏳ Tu as +${(goldDiff / 1000).toFixed(1)}k mais l'ennemi rattrape — force un objectif MAINTENANT`,
        priority: 'medium',
        weight: 50,
        category: 'gold-diff',
      })
    }

    // Late game + même gold = coin flip imminent
    if (gameTime >= 1500 && Math.abs(goldDiff) < 2000) {
      tips.push({
        text: `⚖️ Gold similaire en late — le prochain teamfight décide. Position + ults up avant de fight`,
        priority: 'medium',
        weight: 48,
        category: 'gold-diff',
      })
    }
  }

  // ─── TOWER MAP CONTROL (weight 45-58) ──────────────────────────

  if (gameTime >= 840) {
    const towerAdvance = towers.enemyDestroyed - towers.allyDestroyed
    // Très gros retard de tours mais pas de kills retard → split problem
    if (towerAdvance <= -2 && killDiff >= 0) {
      tips.push({
        text: `🏰 ${towers.allyDestroyed} tours perdues malgré les kills — convertis les kills en push, pas juste des fights`,
        priority: 'medium',
        weight: 52,
        category: 'tower-state',
      })
    }
    // Avantage de tours + Baron upcoming → setup pour end game
    if (towerAdvance >= 3 && gameTime >= 1200 && !objectives.baronActive) {
      tips.push({
        text: `🏆 +${towers.enemyDestroyed} tours + Baron dispo — start Nash pour forcer le end`,
        priority: 'high',
        weight: 58,
        category: 'structural',
      })
    }
    // Inhibitor pressure (approx: si 7+ tours ennemies détruites)
    if (towers.enemyDestroyed >= 7) {
      tips.push({
        text: `🏰 Inhib exposé — un seul bon fight et c'est fini. Force Baron ou Elder pour closer`,
        priority: 'high',
        weight: 62,
        category: 'structural',
      })
    }
  }

  // ─── ENEMY POWER SPIKE ITEMIZATION (weight 30-45) ────────────

  if (enemies.length >= 3) {
    let assCount = 0
    let tankCount = 0
    for (const enemy of enemies) {
      const info = getChampion(enemy)
      if (info?.class === 'assassin') assCount++
      if (info?.class === 'tank' || info?.class === 'engage') tankCount++
    }
    // Face à 2+ assassins en mid/late game
    if (assCount >= 2 && gameTime >= 900) {
      tips.push({
        text: `⚔️ ${assCount} assassins ennemis — joue groupé, JAMAIS isolé en side lane`,
        priority: 'medium',
        weight: 42,
        category: 'comp',
      })
    }
    // Face à 3+ tanks/engage
    if (tankCount >= 3 && gameTime >= 900) {
      tips.push({
        text: `🛡️ Comp tanky/engage — évite les long fights, kite et poke avant d'engager`,
        priority: 'medium',
        weight: 40,
        category: 'comp',
      })
    }
  }

  // ─── GENERAL PHASE TIPS (weight 10, rotation) ───────────────────

  const phaseTips = getPhaseGeneralTips(gameData, style)
  if (phaseTips.length > 0) {
    const pick = phaseTips[rotationIdx % phaseTips.length]
    tips.push({ ...pick, weight: 10, category: 'phase' })
  }

  // ─── SÉLECTION DU MEILLEUR TIP ─────────────────────────────────────

  if (tips.length === 0) {
    return { text: `🎯 ${champion} — analyse de la situation en cours...`, priority: 'low' }
  }

  // Filtrer les tips en cooldown de catégorie (seulement pour les tips légers)
  const availableTips = tips.filter(t => t.weight >= 60 || !isCategoryOnCooldown(t.category, gameTime))
  const tipsToSort = availableTips.length > 0 ? availableTips : tips
  tipsToSort.sort((a, b) => b.weight - a.weight)

  // Éviter la répétition des derniers tips (sauf si critique weight >= 80)
  let pick = tipsToSort[0]
  if (pick.weight < 80) {
    const nonRecent = tipsToSort.find(t => !isRecentTip(t.text))
    if (nonRecent) {
      pick = nonRecent
    } else if (pick.text === lastTipText && tipsToSort.length > 1) {
      pick = tipsToSort[1]
    }
  } else if (pick.text === lastTipText && tipsToSort.length > 1) {
    pick = tipsToSort[1]
  }

  lastTipText = pick.text
  addRecentTip(pick.text)
  markCategoryUsed(pick.category, gameTime)
  rotationIdx++

  return { text: pick.text, priority: pick.priority, category: pick.category }
}

// ─── Tips généraux par phase de jeu ────────────────────────────────────────

type PhaseTip = { text: string; priority: 'low' | 'medium' | 'high' }

const PHASE_STYLE_TIPS: Record<CoachingStyle, {
  early: PhaseTip[]
  mid: PhaseTip[]
  baron: PhaseTip[]
  late: PhaseTip[]
}> = {
  LCK: {
    early: [
      { text: '👁 Ward la rivière à 2:30, track le jungler ennemi', priority: 'low' },
      { text: '🌊 Slow push 3 vagues → crash → back/roam en sécurité', priority: 'low' },
      { text: '👁 Vision rivière avant chaque objectif — 2 wards minimum', priority: 'low' },
      { text: '🌊 Contrôle ta vague — ne push pas sans raison en early', priority: 'low' },
    ],
    mid: [
      { text: '👁 Setup vision 1 min avant chaque objectif — pas de face-check', priority: 'low' },
      { text: '🔄 Push une side lane AVANT de grouper pour un objectif', priority: 'low' },
      { text: '💡 Ne groupe pas 5 mid — c\'est du temps perdu. Push les sides', priority: 'low' },
    ],
    baron: [
      { text: '👁 Baron dispo — setup vision pit, contrôle les deux côtés', priority: 'low' },
      { text: '🔄 Push les side lanes avant de contester Baron', priority: 'low' },
      { text: '⚠️ Ne face-check pas Baron — un steal = catastrophe', priority: 'low' },
    ],
    late: [
      { text: '⚠️ LATE — chaque mort = 50s+ de respawn. Ne meurs pas pour rien', priority: 'medium' },
      { text: '🔄 Gère les vagues latérales avant de grouper — 2 lanes push mini', priority: 'low' },
      { text: '👁 JAMAIS de face-check sans vision en late. Un bush = la mort', priority: 'low' },
    ],
  },
  LEC: {
    early: [
      { text: '🔥 Cherche un roam mid→bot après un push — crée le snowball', priority: 'low' },
      { text: '💡 Après un kill → push → tour/scuttle/roam. Convertis tout !', priority: 'low' },
      { text: '🎯 Prio mid = contrôle jungle + objectifs. Domine le tempo', priority: 'low' },
      { text: '🗼 Héraut = snowball garanti. Force la prio top/mid', priority: 'low' },
    ],
    mid: [
      { text: '🔥 Kill → tour → drake en chaîne. Ne reset pas sans rien prendre', priority: 'low' },
      { text: '💡 Si ahead, force les objectifs en chaîne — étouffe la map', priority: 'low' },
      { text: '🗼 Héraut disparaît à 20:00 — utilise-le pour crash une tour maintenant', priority: 'low' },
    ],
    baron: [
      { text: '🎭 Appât de baron = meilleur outil. Start → stop → fight → reprise', priority: 'low' },
      { text: '💡 Si l\'ennemi fait Drake → trade Baron de l\'autre côté', priority: 'low' },
      { text: '🔥 Cherche un pick pour forcer Baron — un mort = Nash free', priority: 'low' },
    ],
    late: [
      { text: '⚠️ LATE — un pick = Baron/Elder immédiat. Cherche l\'angle', priority: 'medium' },
      { text: '🔥 Le comeback EU c\'est maintenant — une action créative change tout', priority: 'low' },
      { text: '🏆 Elder > tout. Force le fight autour, c\'est TA chance', priority: 'medium' },
    ],
  },
  LCS: {
    early: [
      { text: '🛡 Farm safe, pas de solo plays risqués en early', priority: 'low' },
      { text: '👁 Track le jungler — s\'il gank top, drake est libre pour l\'équipe', priority: 'low' },
      { text: '🤝 Aide le jungler pour les scuttle contests — jeu d\'équipe early', priority: 'low' },
      { text: '🐉 Premier drake à 5:00 — groupe bot pour la prio', priority: 'low' },
    ],
    mid: [
      { text: '🤝 Grouper 4-5 pour objectifs — ne splitte pas seul sans vision', priority: 'low' },
      { text: '🗼 Baron setup dès le spawn si avantage numérique — jouez ensemble', priority: 'low' },
      { text: '👁 Vision de groupe avant chaque objectif — communiquez', priority: 'low' },
    ],
    baron: [
      { text: '🤝 Baron = engagement de toute l\'équipe. Toutes les ults up ?', priority: 'low' },
      { text: '⚠️ Un allié mort = pas de Baron. Attends le regroupe', priority: 'low' },
      { text: '👁 Vision des deux côtés du pit avant de start', priority: 'low' },
    ],
    late: [
      { text: '⚠️ LATE — le teamfight décide tout. Position d\'équipe avant les objectifs', priority: 'medium' },
      { text: '🤝 Attends les cooldowns clés (ults, flash) avant de fight', priority: 'low' },
      { text: '🏆 Elder > tout. Groupe 5, fight ensemble, peel le carry', priority: 'medium' },
    ],
  },
  LPL: {
    early: [
      { text: '🔥 Force les 2v2 dans la jungle — tempo agressif dès le level 1', priority: 'low' },
      { text: '💀 Dive sous tour dès que la cible est low — pas de pitié', priority: 'low' },
      { text: '🎯 Gank répétés sur la lane faible — pression maximale', priority: 'low' },
      { text: '🔥 Invade jungle si ta comp le permet — chaque camp volé = tempo', priority: 'low' },
    ],
    mid: [
      { text: '💀 Kill → push → drake en chaîne SANS RESET. Tempo rapide !', priority: 'low' },
      { text: '🔥 Si +3 kills, envahis leur jungle constamment — suffoque-les', priority: 'low' },
      { text: '💀 Force des fights dans la jungle ennemie — c\'est ton territoire', priority: 'low' },
    ],
    baron: [
      { text: '🔥 Start Baron même si risqué — ça force l\'ennemi dans TA zone', priority: 'low' },
      { text: '💀 50/50 Baron > laisser l\'ennemi scaler. Force le call', priority: 'low' },
      { text: '🔥 1 kill d\'avance = Nashor call immédiat. Pas d\'hésitation', priority: 'low' },
    ],
    late: [
      { text: '💀 LATE — force Elder/Baron MAINTENANT. Pas d\'attente', priority: 'medium' },
      { text: '🔥 Catch un ennemi qui farm seul = Baron instant', priority: 'low' },
      { text: '💀 Même gold ? Coin-flip le fight, l\'agression paie !', priority: 'medium' },
    ],
  },
}

function getPhaseGeneralTips(gameData: GameData, style: CoachingStyle = 'LCK'): Array<{ text: string; priority: 'low' | 'medium' | 'high' }> {
  const { gameTime, champion, matchup, gameMode } = gameData
  const pos = matchup?.position ?? ''
  const posFr = pos === 'TOP' ? 'top' : pos === 'MIDDLE' ? 'mid' : pos === 'BOTTOM' ? 'bot' : pos === 'JUNGLE' ? 'jungle' : pos === 'UTILITY' ? 'support' : ''
  const phaseTips = PHASE_STYLE_TIPS[style]

  if (gameMode === 'ARAM') {
    return [
      { text: '🏔️ ARAM — reste groupé, poke avant d\'engager', priority: 'low' },
      { text: '🏔️ ARAM — les reliques de soin sont cruciales, ne les gaspille pas', priority: 'low' },
      { text: '🏔️ ARAM — si ahead, pousse la tour. Si behind, clear les vagues sous tour', priority: 'low' },
    ]
  }

  // Spawn / très early (0-90s)
  if (gameTime < 90) {
    return [
      { text: `🎯 ${champion}${posFr ? ` ${posFr}` : ''} — focus le CS, chaque 15 CS ≈ 1 kill en gold`, priority: 'low' },
      ...phaseTips.early.slice(0, 2),
    ]
  }

  // Early laning (90s - 5 min)
  if (gameTime < 300) {
    return phaseTips.early
  }

  // First objectives (5-14 min) — mix early + mid
  if (gameTime < 840) {
    return [...phaseTips.early.slice(2), ...phaseTips.mid.slice(0, 2)]
  }

  // Mid game (14-20 min)
  if (gameTime < 1200) {
    return phaseTips.mid
  }

  // Baron era (20-25 min)
  if (gameTime < 1500) {
    return phaseTips.baron
  }

  // Late game (25+ min)
  return phaseTips.late
}
