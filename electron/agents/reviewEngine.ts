/**
 * Moteur d'analyse de replay — génère une timeline de coaching
 * à partir des stats d'une partie classée enregistrée (RankedGame).
 */

import type { RankedGame, ReviewEvent, ReviewSummary, ReviewTimeline, ReviewStats, ReviewGrade } from '../../shared/types'

// ─── Benchmarks moyens par elo (Silver-Gold approximatif) ─────────────────────

const BENCH = {
  kda: 2.5,
  csPerMin: 6.5,
  kp: 55,
  wardScorePerMin: 0.6,
  goldPerMin: 380,
  deathsPerGame: 5,
}

// ─── Calcul de la note globale ────────────────────────────────────────────────

function computeGrade(stats: ReviewStats, game: RankedGame): ReviewGrade {
  let score = 0

  // KDA (max 25 pts)
  if (stats.kda >= 5) score += 25
  else if (stats.kda >= 3.5) score += 20
  else if (stats.kda >= 2.5) score += 15
  else if (stats.kda >= 1.5) score += 8
  else score += 3

  // CS/min (max 25 pts)
  if (stats.csPerMin >= 8) score += 25
  else if (stats.csPerMin >= 7) score += 20
  else if (stats.csPerMin >= 6) score += 15
  else if (stats.csPerMin >= 5) score += 8
  else score += 3

  // KP (max 20 pts)
  if (stats.kp >= 70) score += 20
  else if (stats.kp >= 60) score += 16
  else if (stats.kp >= 50) score += 12
  else if (stats.kp >= 40) score += 6
  else score += 2

  // Vision (max 15 pts)
  const gameMins = game.gameTime / 60
  const wardPerMin = gameMins > 0 ? stats.wardScore / gameMins : 0
  if (wardPerMin >= 1.0) score += 15
  else if (wardPerMin >= 0.7) score += 12
  else if (wardPerMin >= 0.5) score += 8
  else score += 3

  // Victoire bonus (15 pts)
  if (game.result === 'win') score += 15

  if (score >= 85) return 'S'
  if (score >= 70) return 'A'
  if (score >= 50) return 'B'
  if (score >= 30) return 'C'
  return 'D'
}

// ─── Calcul des stats interprétées ────────────────────────────────────────────

function computeStats(game: RankedGame): ReviewStats {
  const gameMins = game.gameTime / 60
  const kda = game.deaths === 0
    ? game.kills + game.assists
    : (game.kills + game.assists) / game.deaths
  const csPerMin = gameMins > 0 ? game.cs / gameMins : 0
  const kp = game.teamKills > 0
    ? Math.round(((game.kills + game.assists) / game.teamKills) * 100)
    : 0
  const goldPerMin = gameMins > 0 ? Math.round(game.gold / gameMins) : 0

  // Estimation de la répartition des morts par phase (on n'a pas le détail exact)
  // On distribue proportionnellement : 30% early, 40% mid, 30% late
  const totalDeaths = game.deaths
  const deathsEarly = Math.round(totalDeaths * 0.3)
  const deathsMid = Math.round(totalDeaths * 0.4)
  const deathsLate = totalDeaths - deathsEarly - deathsMid

  return {
    kda: Math.round(kda * 10) / 10,
    csPerMin: Math.round(csPerMin * 10) / 10,
    kp,
    wardScore: game.wardScore,
    goldPerMin,
    deathsEarly,
    deathsMid,
    deathsLate,
  }
}

// ─── Génération des erreurs ──────────────────────────────────────────────────

function generateErrors(game: RankedGame, stats: ReviewStats): ReviewEvent[] {
  const errors: ReviewEvent[] = []
  const gameMins = game.gameTime / 60
  const wardPerMin = gameMins > 0 ? stats.wardScore / gameMins : 0

  // Trop de morts
  if (game.deaths >= 7) {
    errors.push({
      gameTimeStart: 300,
      gameTimeDuration: 15,
      category: 'error',
      title: 'Trop de morts',
      description: `${game.deaths} morts en ${Math.round(gameMins)} min. Travaille ton positionnement et joue autour de ta vision.`,
      priority: 3,
    })
  } else if (game.deaths >= 5) {
    errors.push({
      gameTimeStart: 300,
      gameTimeDuration: 15,
      category: 'error',
      title: 'Morts évitables',
      description: `${game.deaths} morts — identifie les 2-3 morts les plus impactantes et réfléchis à comment les éviter.`,
      priority: 2,
    })
  }

  // CS faible
  if (stats.csPerMin < 5.5) {
    errors.push({
      gameTimeStart: 600,
      gameTimeDuration: 15,
      category: 'error',
      title: 'Farm insuffisant',
      description: `${stats.csPerMin} CS/min — vise au moins 6.5 CS/min. Focus les vagues de side lane entre les objectifs.`,
      priority: 2,
    })
  }

  // Vision faible
  if (wardPerMin < 0.4) {
    errors.push({
      gameTimeStart: 900,
      gameTimeDuration: 15,
      category: 'error',
      title: 'Vision trop faible',
      description: `Ward score de ${stats.wardScore} en ${Math.round(gameMins)} min. Place des pinks en rivière et utilise tes trinkets.`,
      priority: 2,
    })
  }

  // KP trop faible
  if (stats.kp < 40 && game.teamKills >= 10) {
    errors.push({
      gameTimeStart: 1200,
      gameTimeDuration: 15,
      category: 'error',
      title: 'Absent des teamfights',
      description: `${stats.kp}% KP — ton équipe se bat sans toi. Améliore tes rotations et ta lecture de la map.`,
      priority: 2,
    })
  }

  // Défaite serrée
  if (game.result === 'loss' && game.teamKills > game.enemyKills * 0.8) {
    errors.push({
      gameTimeStart: Math.max(0, game.gameTime - 120),
      gameTimeDuration: 15,
      category: 'error',
      title: 'Défaite serrée',
      description: `La game était gagnante (${game.teamKills} vs ${game.enemyKills} kills) mais perdue — une mauvaise décision macro en fin de game a coûté cher.`,
      priority: 3,
    })
  }

  return errors.sort((a, b) => b.priority - a.priority).slice(0, 3)
}

// ─── Génération des forces ──────────────────────────────────────────────────

function generateStrengths(game: RankedGame, stats: ReviewStats): ReviewEvent[] {
  const strengths: ReviewEvent[] = []

  // Bon KDA
  if (stats.kda >= 4) {
    strengths.push({
      gameTimeStart: 180,
      gameTimeDuration: 15,
      category: 'strength',
      title: 'KDA exceptionnel',
      description: `${stats.kda} KDA — excellente gestion des trades et du positionnement.`,
      priority: 3,
    })
  } else if (stats.kda >= 3) {
    strengths.push({
      gameTimeStart: 180,
      gameTimeDuration: 15,
      category: 'strength',
      title: 'Bon KDA',
      description: `${stats.kda} KDA — tu restes en vie tout en contribuant aux kills.`,
      priority: 2,
    })
  }

  // Bon CS
  if (stats.csPerMin >= 7.5) {
    strengths.push({
      gameTimeStart: 600,
      gameTimeDuration: 15,
      category: 'strength',
      title: 'Farm solide',
      description: `${stats.csPerMin} CS/min — très au-dessus de la moyenne. Tu maximises bien tes revenus.`,
      priority: 3,
    })
  } else if (stats.csPerMin >= 6.5) {
    strengths.push({
      gameTimeStart: 600,
      gameTimeDuration: 15,
      category: 'strength',
      title: 'Farm correct',
      description: `${stats.csPerMin} CS/min — au-dessus du benchmark de ${BENCH.csPerMin}. Bon contrôle des vagues.`,
      priority: 2,
    })
  }

  // Bonne KP
  if (stats.kp >= 65) {
    strengths.push({
      gameTimeStart: 900,
      gameTimeDuration: 15,
      category: 'strength',
      title: 'Participation aux kills élevée',
      description: `${stats.kp}% KP — tu étais présent sur la majorité des fights importants.`,
      priority: 2,
    })
  }

  // Peu de morts
  if (game.deaths <= 2 && game.gameTime >= 1200) {
    strengths.push({
      gameTimeStart: 300,
      gameTimeDuration: 15,
      category: 'strength',
      title: 'Survie exemplaire',
      description: `Seulement ${game.deaths} mort${game.deaths > 1 ? 's' : ''} — excellente gestion du risque.`,
      priority: 3,
    })
  }

  // Victoire dominante
  if (game.result === 'win' && game.teamKills > game.enemyKills * 1.5) {
    strengths.push({
      gameTimeStart: Math.max(0, game.gameTime - 60),
      gameTimeDuration: 15,
      category: 'strength',
      title: 'Victoire dominante',
      description: `${game.teamKills} vs ${game.enemyKills} kills — game très bien contrôlée du début à la fin.`,
      priority: 2,
    })
  }

  return strengths.sort((a, b) => b.priority - a.priority).slice(0, 3)
}

// ─── Génération des conseils ────────────────────────────────────────────────

function generateTips(game: RankedGame, stats: ReviewStats): ReviewEvent[] {
  const tips: ReviewEvent[] = []
  const gameMins = game.gameTime / 60
  const wardPerMin = gameMins > 0 ? stats.wardScore / gameMins : 0

  // Conseil vision
  if (wardPerMin < BENCH.wardScorePerMin) {
    tips.push({
      gameTimeStart: 420,
      gameTimeDuration: 15,
      category: 'tip',
      title: 'Améliore ta vision',
      description: `Ward score de ${stats.wardScore} en ${Math.round(gameMins)} min — vise ${Math.round(BENCH.wardScorePerMin * gameMins)}+. Place des wards de contrôle en rivière.`,
      priority: 2,
    })
  }

  // Conseil CS mid-game (estimation via csPerMin global)
  if (stats.csPerMin < 6) {
    tips.push({
      gameTimeStart: 900,
      gameTimeDuration: 15,
      category: 'tip',
      title: 'Gère mieux les vagues mid-game',
      description: `${stats.csPerMin} CS/min — catch les side waves entre les objectifs pour maintenir ton avance.`,
      priority: 2,
    })
  }

  // Conseil macro si défaite avec plus de kills
  if (game.result === 'loss' && game.teamKills >= game.enemyKills) {
    tips.push({
      gameTimeStart: 1500,
      gameTimeDuration: 15,
      category: 'tip',
      title: 'Convertis tes avantages',
      description: `Tu avais l'avantage de kills (${game.teamKills} vs ${game.enemyKills}) mais tu as perdu. Prends des tours et objectifs après les kills.`,
      priority: 3,
    })
  }

  // Conseil gold efficiency
  if (stats.goldPerMin < BENCH.goldPerMin) {
    tips.push({
      gameTimeStart: 1200,
      gameTimeDuration: 15,
      category: 'tip',
      title: 'Optimise tes revenus',
      description: `${stats.goldPerMin} gold/min — en dessous de la moyenne (${BENCH.goldPerMin}). Farm plus entre les fights.`,
      priority: 1,
    })
  }

  // Conseil sur les morts
  if (game.deaths >= 4) {
    tips.push({
      gameTimeStart: 600,
      gameTimeDuration: 15,
      category: 'tip',
      title: 'Réduis tes morts inutiles',
      description: `Avant chaque fight, demande-toi : "Est-ce que je gagne ce trade ?" Si la réponse est non, recule et farm.`,
      priority: 2,
    })
  }

  return tips.sort((a, b) => b.priority - a.priority).slice(0, 3)
}

// ─── Génération du résumé ───────────────────────────────────────────────────

function generateSummaryText(game: RankedGame, stats: ReviewStats, grade: ReviewGrade): string {
  const isWin = game.result === 'win'
  const gameMins = Math.round(game.gameTime / 60)

  if (grade === 'S') {
    return `Performance exceptionnelle en ${gameMins} min. ${stats.kda} KDA avec ${stats.csPerMin} CS/min — tu domines ton elo.`
  }
  if (grade === 'A') {
    return `${isWin ? 'Belle victoire' : 'Défaite honorable'} en ${gameMins} min. Bons fondamentaux, quelques ajustements macro te feront monter.`
  }
  if (grade === 'B') {
    return `${isWin ? 'Victoire correcte' : 'Game serrée'} en ${gameMins} min. Des bases solides mais de la marge en CS (${stats.csPerMin}/min) et vision.`
  }
  if (grade === 'C') {
    return `Game difficile en ${gameMins} min. Focus sur la réduction des morts (${game.deaths}) et l'amélioration du CS.`
  }
  return `Beaucoup à améliorer. Concentre-toi sur 1 seul objectif : ne pas mourir plus de 3 fois en laning phase.`
}

// ─── API publique ───────────────────────────────────────────────────────────

/**
 * Génère une timeline de coaching complète à partir d'une partie classée.
 */
export function generateReviewTimeline(game: RankedGame): ReviewTimeline {
  const stats = computeStats(game)
  const grade = computeGrade(stats, game)
  const errors = generateErrors(game, stats)
  const strengths = generateStrengths(game, stats)
  const tips = generateTips(game, stats)

  // Timeline : intercaler erreurs, forces et tips sur la durée de la game
  const allEvents = [...errors, ...strengths, ...tips]
    .sort((a, b) => a.gameTimeStart - b.gameTimeStart)

  // Espacer les événements pour qu'ils ne se chevauchent pas
  for (let i = 1; i < allEvents.length; i++) {
    const prev = allEvents[i - 1]
    const minStart = prev.gameTimeStart + prev.gameTimeDuration + 5
    if (allEvents[i].gameTimeStart < minStart) {
      allEvents[i].gameTimeStart = minStart
    }
  }

  const summary: ReviewSummary = {
    grade,
    summary: generateSummaryText(game, stats, grade),
    errors,
    strengths,
    tips,
    stats,
  }

  return {
    events: allEvents,
    summary,
    gameId: game.id,
  }
}

// ─── Données exemple pour la démo ───────────────────────────────────────────

export const EXAMPLE_REVIEW: ReviewSummary = {
  grade: 'B',
  summary: 'Game serrée perdue sur un throw baron. Bon laning phase mais macro faible en mid-game.',
  errors: [
    {
      gameTimeStart: 420, gameTimeDuration: 15, category: 'error', priority: 3,
      title: 'Mort évitable en lane',
      description: 'Trade pris sans vision du jungler ennemi. Ward le pixel brush avant de jouer agressif.',
    },
    {
      gameTimeStart: 1200, gameTimeDuration: 15, category: 'error', priority: 2,
      title: 'Rotation tardive au dragon',
      description: 'Dragon contesté 4v5 car arrivée 15s en retard. Push la vague AVANT de rotate.',
    },
    {
      gameTimeStart: 1800, gameTimeDuration: 15, category: 'error', priority: 3,
      title: 'Throw baron',
      description: 'Baron entamé sans vision des 5 ennemis. 3 morts = fin de game. Toujours ward avant baron.',
    },
  ],
  strengths: [
    {
      gameTimeStart: 180, gameTimeDuration: 15, category: 'strength', priority: 2,
      title: 'Farm solide en early',
      description: '8.2 CS/min sur les 10 premières minutes — très bon pour ton elo.',
    },
    {
      gameTimeStart: 600, gameTimeDuration: 15, category: 'strength', priority: 2,
      title: 'Solo kill en lane',
      description: 'Trade gagnant bien exécuté avec advantage de niveau. Bon timing.',
    },
    {
      gameTimeStart: 900, gameTimeDuration: 15, category: 'strength', priority: 2,
      title: 'Participation aux kills élevée',
      description: '72% KP — tu étais présent sur la majorité des fights importants.',
    },
  ],
  tips: [
    {
      gameTimeStart: 420, gameTimeDuration: 15, category: 'tip', priority: 2,
      title: 'Améliore ta vision',
      description: 'Ward score de 12 en 30min — vise 20+. Place des wards de contrôle en rivière.',
    },
    {
      gameTimeStart: 900, gameTimeDuration: 15, category: 'tip', priority: 2,
      title: 'Gère mieux les vagues mid-game',
      description: 'CS/min chute à 5.1 après 15min. Catch les side waves entre les objectifs.',
    },
    {
      gameTimeStart: 1500, gameTimeDuration: 15, category: 'tip', priority: 3,
      title: 'Décision baron plus propre',
      description: 'Ne start baron que si 2+ ennemis sont visibles loin. Sinon, push et prends des tours.',
    },
  ],
  stats: { kda: 2.8, csPerMin: 7.1, kp: 72, wardScore: 12, goldPerMin: 420, deathsEarly: 1, deathsMid: 2, deathsLate: 1 },
}

export const EXAMPLE_TIMELINE: ReviewTimeline = {
  events: [
    ...EXAMPLE_REVIEW.errors,
    ...EXAMPLE_REVIEW.strengths,
    ...EXAMPLE_REVIEW.tips,
  ].sort((a, b) => a.gameTimeStart - b.gameTimeStart),
  summary: EXAMPLE_REVIEW,
  gameId: -1,
}
