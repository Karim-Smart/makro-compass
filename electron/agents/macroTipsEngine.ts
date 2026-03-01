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
    plates: 'Plaques bientôt — slow push et crash pour maximiser le gold',
    itemSpike: 'Spike de puissance — cherche un trade avantageux, pas un all-in risqué',
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
    plates: 'Plaques avant 14 min ! Push agressif, chaque plaque = 160g de snowball',
    itemSpike: 'Item complété = spike ! Force un play agressif, convertis en objectif',
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
    plates: 'Plaques bientôt — groupe pour push et partager le gold d\'équipe',
    itemSpike: 'Item spike — cherche un teamfight d\'équipe autour d\'un objectif',
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
    plates: 'Plaques = gold massif ! Dive si nécessaire, chaque plaque compte',
    itemSpike: 'Item complété = ALL-IN. Force le fight immédiat, écrasse-les',
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
}

interface Tip {
  text: string
  priority: 'low' | 'medium' | 'high'
  weight: number
}

export function generateMacroTip(gameData: GameData, style: CoachingStyle = 'LCK'): { text: string; priority: 'low' | 'medium' | 'high' } {
  const tips: Tip[] = []
  const styleTips = STYLE_TIPS[style]
  const {
    gameTime, matchup, objectives, towers, teamKills, enemyKills,
    champion, items, gameMode, cs, level, allies, enemies,
  } = gameData
  const killDiff = teamKills - enemyKills
  const csPerMin = gameTime > 60 ? cs / (gameTime / 60) : 0

  // ─── CRITICAL (weight 100+) ────────────────────────────────────────

  if (objectives.elderActive) {
    tips.push({ text: '🐲 ELDER ACTIF — force le teamfight MAINTENANT, exécute sous 20% HP', priority: 'high', weight: 150 })
  }

  if (objectives.baronActive) {
    tips.push({ text: '👁 BARON BUFF — split 1-3-1, push 2 lanes en même temps, ne fight pas', priority: 'high', weight: 140 })
  }

  if (objectives.dragonStacks === 3) {
    tips.push({ text: '🐉 SOUL POINT — prochain drake = Dragon Soul ! Setup vision bot 1 min avant', priority: 'high', weight: 130 })
  }

  if (objectives.enemyDragonStacks === 3) {
    tips.push({ text: '⚠️ SOUL POINT ennemi — conteste le prochain drake ABSOLUMENT', priority: 'high', weight: 135 })
  }

  if (objectives.dragonStacks >= 4 && objectives.dragonSoul) {
    tips.push({ text: `🏆 Dragon Soul ${objectives.dragonSoul} obtenu — avantage permanent, force la pression`, priority: 'high', weight: 110 })
  }

  // ─── OBJECTIVE COUNTDOWNS (weight 80-99) ───────────────────────────

  // Drake countdown
  if (lastDragonKillAt > 0) {
    const next = lastDragonKillAt + DRAGON_RESPAWN
    const cd = Math.floor(next - gameTime)
    const drakeTip = styleTips.drake[rotationIdx % styleTips.drake.length]
    if (cd > 0 && cd <= 30) {
      tips.push({ text: `🐉 Drake dans ${cd}s ! ${drakeTip}`, priority: 'high', weight: 95 })
    } else if (cd > 30 && cd <= 60) {
      tips.push({ text: `🐉 Drake dans ${cd}s — ${drakeTip}`, priority: 'medium', weight: 85 })
    } else if (cd > 60 && cd <= 90) {
      tips.push({ text: `🐉 Drake respawn dans ~${Math.floor(cd / 60)} min — commence à préparer`, priority: 'low', weight: 45 })
    }
  } else if (gameTime > 0 && gameTime < FIRST_DRAGON) {
    const cd = Math.floor(FIRST_DRAGON - gameTime)
    const drakeTip = styleTips.drake[rotationIdx % styleTips.drake.length]
    if (cd <= 30) {
      tips.push({ text: `🐉 Premier drake dans ${cd}s ! ${drakeTip}`, priority: 'high', weight: 90 })
    } else if (cd <= 60) {
      tips.push({ text: `🐉 Premier drake dans ${cd}s — ${drakeTip}`, priority: 'medium', weight: 80 })
    }
  }

  // Baron countdown
  if (gameTime >= BARON_SPAWN && lastBaronKillAt > 0) {
    const next = lastBaronKillAt + BARON_RESPAWN
    const cd = Math.floor(next - gameTime)
    if (cd > 0 && cd <= 30) {
      tips.push({ text: `👁 Baron dans ${cd}s ! Groupe top et contrôle le pit`, priority: 'high', weight: 95 })
    } else if (cd > 30 && cd <= 60) {
      tips.push({ text: `👁 Baron respawn dans ${cd}s — prépare la vision`, priority: 'medium', weight: 85 })
    }
  }

  // Baron approaching 20 min
  if (gameTime >= 1080 && gameTime < BARON_SPAWN) {
    const cd = Math.floor(BARON_SPAWN - gameTime)
    if (cd <= 30) {
      tips.push({ text: `👁 Baron spawn dans ${cd}s ! Ward le pit maintenant`, priority: 'high', weight: 90 })
    } else if (cd <= 60) {
      tips.push({ text: `👁 Baron spawn dans ${cd}s — prépare la vision top side`, priority: 'medium', weight: 80 })
    }
  }

  // Herald countdown
  if (lastHeraldKillAt > 0 && gameTime < BARON_SPAWN) {
    const next = lastHeraldKillAt + HERALD_RESPAWN
    const cd = Math.floor(next - gameTime)
    if (cd > 0 && cd <= 60 && next < BARON_SPAWN) {
      tips.push({ text: `🟡 Héraut respawn dans ${cd}s — utilise-le pour crash une tour`, priority: 'medium', weight: 75 })
    }
  }

  // ─── LEVEL MATCHUP (weight 60-79) ──────────────────────────────────

  if (matchup && matchup.levelDiff !== 0) {
    const opp = matchup.champion
    const diff = matchup.levelDiff
    if (diff <= -2) {
      tips.push({ text: `⬇ ${Math.abs(diff)} niveaux de retard sur ${opp} — joue sous tour, farm safe`, priority: 'high', weight: 78 })
    } else if (diff === -1) {
      tips.push({ text: `⬇ 1 niveau de retard vs ${opp} — évite les all-in, farm pour rattraper`, priority: 'medium', weight: 65 })
    } else if (diff === 1) {
      tips.push({ text: `⬆ +1 niveau sur ${opp} — trade avantageux, profite de la fenêtre`, priority: 'medium', weight: 60 })
    } else if (diff >= 2) {
      tips.push({ text: `⬆ +${diff} niveaux sur ${opp} — zone-le du CS, cherche le dive`, priority: 'high', weight: 70 })
    }
  }

  // ─── CHAMPION MATCHUP (weight 55-75) ──────────────────────────────
  // Conseil spécifique quand tu affrontes un champion en lane
  if (matchup) {
    const matchupTip = getMatchupTip(matchup.champion)
    if (matchupTip) {
      const danger = getChampion(matchup.champion)?.dangerLevel ?? 1
      // Plus le champion est dangereux, plus le tip est prioritaire
      const w = danger === 3 ? 75 : danger === 2 ? 65 : 55
      tips.push({ text: `⚔️ vs ${matchup.champion} — ${matchupTip}`, priority: danger >= 3 ? 'high' : 'medium', weight: w })
    }

    // Conseil class vs class (ton champion vs le champion ennemi)
    const classRule = getClassMatchup(champion, matchup.champion)
    if (classRule) {
      tips.push({ text: `🎯 ${classRule.text}`, priority: classRule.priority, weight: 48 })
    }
  }

  // ─── POWER CURVE WARNINGS (weight 50-68) ──────────────────────────
  // Prévenir quand l'ennemi est dans sa phase forte ou faible
  if (matchup) {
    const enemyInfo = getChampion(matchup.champion)
    if (enemyInfo) {
      const phase = gameTime < 840 ? 'early' : gameTime < 1500 ? 'mid' : 'late'
      if (enemyInfo.power === phase) {
        tips.push({ text: `⚠️ ${matchup.champion} est dans sa phase FORTE (${phase}) — joue prudemment`, priority: 'medium', weight: 58 })
      } else if (
        (enemyInfo.power === 'late' && phase === 'early') ||
        (enemyInfo.power === 'early' && phase === 'late')
      ) {
        tips.push({ text: `💡 ${matchup.champion} est FAIBLE en ${phase} — profite de ta fenêtre`, priority: 'medium', weight: 52 })
      }
    }
  }

  // ─── ENEMY COMPOSITION (weight 42-55) ─────────────────────────────
  if (enemies.length >= 3) {
    const compTips = analyzeEnemyComp(enemies)
    for (const compTip of compTips) {
      tips.push({ text: compTip, priority: 'medium', weight: 50 })
    }
  }

  // ─── ALLY TIPS (weight 25-38) ─────────────────────────────────────
  // Un conseil sur un allié (rotation entre les alliés)
  if (allies.length > 0) {
    const allyIdx = rotationIdx % allies.length
    const allyName = allies[allyIdx]
    const atp = getAllyTip(allyName)
    if (atp) {
      tips.push({ text: `🤝 ${allyName} — ${atp}`, priority: 'low', weight: 28 })
    }
  }

  // ─── KILL DIFF (weight 50-69) ──────────────────────────────────────

  if (killDiff >= 5) {
    const msg = styleTips.killAhead[rotationIdx % styleTips.killAhead.length]
    tips.push({ text: `💀 +${killDiff} kills — ${msg}`, priority: killDiff >= 10 ? 'high' : 'medium', weight: killDiff >= 10 ? 65 : 55 })
  } else if (killDiff >= 3) {
    const msg = styleTips.killAhead[rotationIdx % styleTips.killAhead.length]
    tips.push({ text: `📈 +${killDiff} kills — ${msg}`, priority: 'medium', weight: 50 })
  } else if (killDiff <= -5) {
    const msg = styleTips.killBehind[rotationIdx % styleTips.killBehind.length]
    tips.push({ text: `⚠️ ${Math.abs(killDiff)} kills de retard — ${msg}`, priority: killDiff <= -10 ? 'high' : 'medium', weight: killDiff <= -10 ? 65 : 55 })
  } else if (killDiff <= -3) {
    const msg = styleTips.killBehind[rotationIdx % styleTips.killBehind.length]
    tips.push({ text: `📉 ${Math.abs(killDiff)} kills de retard — ${msg}`, priority: 'medium', weight: 50 })
  }

  // ─── TOWER STATE (weight 40-59) ────────────────────────────────────

  const towerDiff = towers.enemyDestroyed - towers.allyDestroyed
  if (towerDiff >= 3) {
    const msg = styleTips.towerAhead[rotationIdx % styleTips.towerAhead.length]
    tips.push({ text: `🏰 +${towers.enemyDestroyed} tours — ${msg}`, priority: 'medium', weight: 55 })
  } else if (towerDiff <= -3) {
    const msg = styleTips.towerBehind[rotationIdx % styleTips.towerBehind.length]
    tips.push({ text: `🏰 ${towers.allyDestroyed} tours perdues — ${msg}`, priority: 'medium', weight: 55 })
  }

  // ─── PLATES REMINDER (weight 40-42) ────────────────────────────────

  if (gameTime >= 720 && gameTime < PLATES_FALL) {
    const cd = Math.floor(PLATES_FALL - gameTime)
    tips.push({ text: `💰 Plaques dans ${cd}s — ${styleTips.plates}`, priority: 'medium', weight: 42 })
  }

  // ─── ITEMS POWER SPIKE (weight 35-40) ──────────────────────────────

  const completedItems = items.length
  if (completedItems === 1 && gameTime >= 480 && gameTime < 900) {
    tips.push({ text: `⚔️ Premier item complété — ${styleTips.itemSpike}`, priority: 'low', weight: 40 })
  } else if (completedItems === 2 && gameTime >= 900) {
    tips.push({ text: `⚔️ 2 items — ${styleTips.itemSpike}`, priority: 'low', weight: 38 })
  } else if (completedItems >= 3) {
    tips.push({ text: `⚔️ ${completedItems} items — ${styleTips.itemSpike}`, priority: 'low', weight: 35 })
  }

  // ─── CS FEEDBACK (weight 30-38) ────────────────────────────────────

  if (gameTime >= 300 && csPerMin > 0) {
    if (csPerMin < 4) {
      tips.push({ text: `📊 ${csPerMin.toFixed(1)} CS/min — c'est très bas, focus les last hits, chaque 15 CS = 1 kill`, priority: 'medium', weight: 38 })
    } else if (csPerMin < 6) {
      tips.push({ text: `📊 ${csPerMin.toFixed(1)} CS/min — essaie d'atteindre 7+, ne rate pas les canons`, priority: 'low', weight: 32 })
    } else if (csPerMin >= 9) {
      tips.push({ text: `📊 ${csPerMin.toFixed(1)} CS/min — excellent farming, garde ce rythme`, priority: 'low', weight: 30 })
    }
  }

  // ─── GENERAL PHASE TIPS (weight 10-25, rotation) ───────────────────

  const phaseTips = getPhaseGeneralTips(gameData, style)
  if (phaseTips.length > 0) {
    const pick = phaseTips[rotationIdx % phaseTips.length]
    tips.push({ ...pick, weight: 15 })
  }

  // ─── SÉLECTION DU MEILLEUR TIP ─────────────────────────────────────

  if (tips.length === 0) {
    return { text: `🎯 ${champion} — analyse de la situation en cours...`, priority: 'low' }
  }

  tips.sort((a, b) => b.weight - a.weight)

  // Prendre le tip le plus important, éviter la répétition sauf si critique
  let pick = tips[0]
  if (pick.text === lastTipText && tips.length > 1 && pick.weight < 80) {
    pick = tips[1]
  }

  lastTipText = pick.text
  rotationIdx++

  return { text: pick.text, priority: pick.priority }
}

// ─── Tips généraux par phase de jeu ────────────────────────────────────────

// ─── Tips de phase par style ─────────────────────────────────────────────────

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
