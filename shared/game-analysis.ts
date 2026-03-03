/**
 * Analyse des performances par partie.
 * Fournit : grade S/A/B/C/D, détection de streak, insights comportementaux.
 */

import type { RankedGame } from './types'

// ─── Grade par partie ─────────────────────────────────────────────────────────

export interface GameGrade {
  grade: 'S+' | 'S' | 'A' | 'B' | 'C' | 'D'
  score: number   // 0-100
  color: string
}

const GRADE_COLOR: Record<string, string> = {
  'S+': '#facc15',
  'S':  '#22c55e',
  'A':  '#60a5fa',
  'B':  '#a78bfa',
  'C':  '#f59e0b',
  'D':  '#ef4444',
}

/**
 * Calcule une note globale pour une partie basée sur KDA, CS/min, KP%, vision.
 * Compare chaque métrique à des seuils qualitatifs, pas relatifs à la moyenne.
 */
export function computeGameGrade(game: RankedGame): GameGrade {
  const kda = game.deaths === 0 ? Math.min(10, game.kills + game.assists) : (game.kills + game.assists) / game.deaths
  const csMin = game.gameTime > 60 ? game.cs / (game.gameTime / 60) : 0
  const kp = game.teamKills > 0 ? ((game.kills + game.assists) / game.teamKills) * 100 : 0
  const visionMin = game.gameTime > 60 ? game.wardScore / (game.gameTime / 60) : 0

  // Normalisation : chaque métrique → 0-100
  const kdaScore    = Math.min(100, Math.round((kda / 5) * 100))    // 5 KDA = 100
  const csScore     = Math.min(100, Math.round((csMin / 8) * 100))  // 8 CS/min = 100
  const kpScore     = Math.min(100, Math.round(kp))                 // 100% KP = 100
  const visionScore = Math.min(100, Math.round((visionMin / 2) * 100)) // 2/min = 100

  // Score composite pondéré
  const raw = kdaScore * 0.35 + csScore * 0.25 + kpScore * 0.25 + visionScore * 0.15
  // Bonus victoire +5, pénalité défaite -5
  const score = Math.max(0, Math.min(100, Math.round(game.result === 'win' ? raw + 5 : raw - 5)))

  const grade = score >= 93 ? 'S+' : score >= 80 ? 'S' : score >= 65 ? 'A' : score >= 50 ? 'B' : score >= 35 ? 'C' : 'D'

  return { grade, score, color: GRADE_COLOR[grade] }
}

// ─── Streak actuel ────────────────────────────────────────────────────────────

export interface Streak {
  type: 'win' | 'loss' | 'none'
  count: number
}

/**
 * Retourne le streak actuel (W ou L consécutifs depuis la partie la plus récente).
 * Les parties sont supposées ordonnées du plus récent au plus ancien.
 */
export function computeStreak(games: RankedGame[]): Streak {
  if (!games.length) return { type: 'none', count: 0 }
  const first = games[0].result
  let count = 1
  for (let i = 1; i < games.length; i++) {
    if (games[i].result === first) count++
    else break
  }
  return { type: first, count }
}

// ─── Tendance winrate ─────────────────────────────────────────────────────────

/**
 * Retourne un tableau de 0/1 (victoire/défaite) pour les N dernières parties.
 * Utilisé pour les sparklines.
 */
export function computeRecentForm(games: RankedGame[], n = 10): (0 | 1)[] {
  return games.slice(0, n).map(g => g.result === 'win' ? 1 : 0)
}

/**
 * Winrate glissant (moyenne mobile) sur une fenêtre de N parties.
 * Retourne un tableau de pourcentages (0-100) du plus ancien au plus récent.
 */
export function computeRollingWinrate(games: RankedGame[], window = 5): number[] {
  if (games.length < window) return []
  const reversed = [...games].reverse()
  const result: number[] = []
  for (let i = window - 1; i < reversed.length; i++) {
    const slice = reversed.slice(i - window + 1, i + 1)
    const wr = Math.round((slice.filter(g => g.result === 'win').length / window) * 100)
    result.push(wr)
  }
  return result
}

// ─── Stats par rôle ───────────────────────────────────────────────────────────

export interface RoleStat {
  role: string
  games: number
  wins: number
  winrate: number
  avgKda: number
  avgCsMin: number
  avgVisionMin: number
}

/**
 * Calcule les statistiques agrégées par rôle.
 */
export function computeRoleStats(games: RankedGame[]): RoleStat[] {
  const map: Record<string, { games: number; wins: number; kdaSum: number; csSum: number; timeSum: number; visionSum: number }> = {}

  for (const g of games) {
    const role = g.role ?? 'UNKNOWN'
    if (!map[role]) map[role] = { games: 0, wins: 0, kdaSum: 0, csSum: 0, timeSum: 0, visionSum: 0 }
    const e = map[role]
    e.games++
    if (g.result === 'win') e.wins++
    e.kdaSum += g.deaths === 0 ? 5 : (g.kills + g.assists) / g.deaths
    e.csSum += g.cs
    e.timeSum += g.gameTime
    e.visionSum += g.wardScore
  }

  return Object.entries(map)
    .filter(([role]) => role !== 'UNKNOWN')
    .map(([role, s]) => ({
      role,
      games: s.games,
      wins: s.wins,
      winrate: Math.round((s.wins / s.games) * 100),
      avgKda: Math.round((s.kdaSum / s.games) * 100) / 100,
      avgCsMin: s.timeSum > 0 ? Math.round((s.csSum / (s.timeSum / 60)) * 10) / 10 : 0,
      avgVisionMin: s.timeSum > 0 ? Math.round((s.visionSum / (s.timeSum / 60)) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.games - a.games)
}

// ─── Insights comportementaux ────────────────────────────────────────────────

export interface Insight {
  type: 'warning' | 'success' | 'tip'
  icon: string
  title: string
  description: string
  priority: number  // Plus haut = affiché en premier
}

/**
 * Analyse les parties récentes et génère des insights actionnables.
 * Inspiré des recommandations de Mobalytics / Blitz.
 */
export function computeInsights(games: RankedGame[]): Insight[] {
  if (games.length < 3) return []

  const insights: Insight[] = []
  const recent = games.slice(0, 20)

  // ── Métriques moyennes ──────────────────────────────────────────────────────
  const avgKda = recent.map(g => g.deaths === 0 ? 5 : (g.kills + g.assists) / g.deaths)
  const meanKda = avgKda.reduce((a, b) => a + b, 0) / avgKda.length

  const avgCsMin = recent.map(g => g.gameTime > 60 ? g.cs / (g.gameTime / 60) : 0)
  const meanCsMin = avgCsMin.reduce((a, b) => a + b, 0) / avgCsMin.length

  const avgKp = recent.map(g => g.teamKills > 0 ? ((g.kills + g.assists) / g.teamKills) * 100 : 0)
  const meanKp = avgKp.reduce((a, b) => a + b, 0) / avgKp.length

  const avgVision = recent.map(g => g.gameTime > 60 ? g.wardScore / (g.gameTime / 60) : 0)
  const meanVision = avgVision.reduce((a, b) => a + b, 0) / avgVision.length

  const winrate = Math.round((recent.filter(g => g.result === 'win').length / recent.length) * 100)

  // ── Détection de tilt ───────────────────────────────────────────────────────
  const last5 = games.slice(0, 5)
  const last5Losses = last5.filter(g => g.result === 'loss').length
  if (last5Losses >= 4) {
    insights.push({
      type: 'warning', icon: '🔥', priority: 10,
      title: 'Risque de tilt détecté',
      description: `${last5Losses} défaites sur tes 5 dernières parties. Prends une pause de 20 min avant la prochaine.`,
    })
  }

  // ── CS faible ───────────────────────────────────────────────────────────────
  if (meanCsMin < 5) {
    insights.push({
      type: 'warning', icon: '⚠️', priority: 8,
      title: 'CS en dessous de la moyenne',
      description: `${meanCsMin.toFixed(1)} CS/min (objectif : 7+). Focus sur les waves entre les fights.`,
    })
  } else if (meanCsMin >= 7.5) {
    insights.push({
      type: 'success', icon: '✓', priority: 3,
      title: 'Excellent farming',
      description: `${meanCsMin.toFixed(1)} CS/min — tu es dans le top des joueurs. Continue.`,
    })
  }

  // ── KDA ─────────────────────────────────────────────────────────────────────
  if (meanKda < 1.5) {
    insights.push({
      type: 'warning', icon: '⚠️', priority: 7,
      title: 'Trop de morts',
      description: `KDA moyen ${meanKda.toFixed(2)}. Joue plus prudemment — chaque mort cède 300g+ à l'ennemi.`,
    })
  } else if (meanKda >= 4) {
    insights.push({
      type: 'success', icon: '✓', priority: 4,
      title: 'KDA excellent',
      description: `Ratio ${meanKda.toFixed(2)} — tu joues safe et impactant. Continue sur cette lancée.`,
    })
  }

  // ── Kill participation ───────────────────────────────────────────────────────
  if (meanKp < 45) {
    insights.push({
      type: 'tip', icon: '💡', priority: 6,
      title: 'Participation aux kills faible',
      description: `${meanKp.toFixed(0)}% KP en moyenne. Roam plus pour aider tes lanes et snowball.`,
    })
  }

  // ── Vision ──────────────────────────────────────────────────────────────────
  if (meanVision < 0.5) {
    insights.push({
      type: 'tip', icon: '👁️', priority: 5,
      title: 'Vision insuffisante',
      description: `${meanVision.toFixed(2)} wards/min. Place 1 ward à chaque retour base — ça peut éviter des morts évitables.`,
    })
  }

  // ── Champion pool trop large ─────────────────────────────────────────────────
  const champCounts: Record<string, number> = {}
  for (const g of recent) {
    champCounts[g.champion] = (champCounts[g.champion] ?? 0) + 1
  }
  const uniqueChamps = Object.keys(champCounts).length
  const champValues = Object.values(champCounts)
  const topChampGames = champValues.length > 0 ? Math.max(...champValues) : 0
  if (uniqueChamps > 8 && topChampGames < 3) {
    insights.push({
      type: 'tip', icon: '🎯', priority: 4,
      title: 'Pool trop large',
      description: `${uniqueChamps} champions différents — les pros recommandent 2-3 max. Maîtrise mieux tes principaux champs.`,
    })
  }

  // ── Spécialiste ─────────────────────────────────────────────────────────────
  const topChamp = Object.entries(champCounts).sort(([, a], [, b]) => b - a)[0]
  if (topChamp && topChamp[1] >= 5) {
    const champGames = recent.filter(g => g.champion === topChamp[0])
    const champWr = Math.round((champGames.filter(g => g.result === 'win').length / champGames.length) * 100)
    if (champWr >= 60) {
      insights.push({
        type: 'success', icon: '⭐', priority: 3,
        title: `Spécialiste ${topChamp[0]}`,
        description: `${champWr}% winrate sur ${topChamp[1]} parties — ton meilleur champion. Priorise-le en ranked.`,
      })
    } else if (champWr < 40 && topChamp[1] >= 5) {
      insights.push({
        type: 'warning', icon: '⚠️', priority: 6,
        title: `${topChamp[0]} ne te réussit pas`,
        description: `${champWr}% winrate sur ${topChamp[1]} parties. Essaie un autre champion ou travaille ce matchup.`,
      })
    }
  }

  // ── Tendance récente vs ancienne ─────────────────────────────────────────────
  if (games.length >= 10) {
    const last5wr = Math.round((games.slice(0, 5).filter(g => g.result === 'win').length / 5) * 100)
    const prev5wr = Math.round((games.slice(5, 10).filter(g => g.result === 'win').length / 5) * 100)
    const diff = last5wr - prev5wr
    if (diff >= 20) {
      insights.push({
        type: 'success', icon: '📈', priority: 5,
        title: 'Tendance positive',
        description: `+${diff}% winrate sur tes 5 dernières vs les 5 précédentes. Tu es en forme !`,
      })
    } else if (diff <= -20) {
      insights.push({
        type: 'warning', icon: '📉', priority: 7,
        title: 'Baisse de performance',
        description: `${diff}% winrate ces dernières parties. Analyse tes défaites ou change de stratégie.`,
      })
    }
  }

  // Winrate global
  if (winrate >= 55 && games.length >= 10) {
    insights.push({
      type: 'success', icon: '🏆', priority: 2,
      title: `Winrate positif : ${winrate}%`,
      description: `Sur ${recent.length} parties, tu gagnes plus souvent que la moyenne. Continue.`,
    })
  }

  // ── Durée moyenne des parties ───────────────────────────────────────────────
  const avgGameTime = recent.reduce((a, g) => a + g.gameTime, 0) / recent.length
  const avgMin = Math.floor(avgGameTime / 60)
  if (avgMin > 32) {
    insights.push({
      type: 'tip', icon: '⏱', priority: 3,
      title: 'Parties longues',
      description: `Moyenne de ${avgMin} min. Essaie de closer plus tôt — force Baron dès 20 min si tu es ahead.`,
    })
  }

  // ── Meilleur rôle ─────────────────────────────────────────────────────────
  const roleStats: Record<string, { wins: number; total: number }> = {}
  for (const g of recent) {
    if (!g.role) continue
    if (!roleStats[g.role]) roleStats[g.role] = { wins: 0, total: 0 }
    roleStats[g.role].total++
    if (g.result === 'win') roleStats[g.role].wins++
  }
  const roles = Object.entries(roleStats).filter(([, s]) => s.total >= 3)
  if (roles.length >= 2) {
    const best = roles.sort(([, a], [, b]) => (b.wins / b.total) - (a.wins / a.total))[0]
    const bestWr = Math.round((best[1].wins / best[1].total) * 100)
    if (bestWr >= 55) {
      insights.push({
        type: 'success', icon: '🎮', priority: 2,
        title: `Ton meilleur rôle : ${best[0]}`,
        description: `${bestWr}% winrate sur ${best[1].total} parties. Priorise ce rôle en ranked.`,
      })
    }
  }

  // ── Ratio morts par minute ────────────────────────────────────────────────
  const avgDeathsPerMin = recent.reduce((a, g) => a + (g.gameTime > 0 ? g.deaths / (g.gameTime / 60) : 0), 0) / recent.length
  if (avgDeathsPerMin > 0.35) {
    insights.push({
      type: 'warning', icon: '💀', priority: 6,
      title: 'Tu meurs trop souvent',
      description: `${avgDeathsPerMin.toFixed(2)} morts/min en moyenne. Objectif : moins de 0.25. Joue plus prudemment en early.`,
    })
  }

  return insights.sort((a, b) => b.priority - a.priority).slice(0, 6)
}

// ─── Stats quotidiennes (7 derniers jours) ───────────────────────────────────

export interface DayStat {
  date: string       // 'lun', 'mar', etc.
  dateShort: string  // 'DD/MM'
  games: number
  wins: number
  winrate: number    // 0-100
  avgKda: number
}

/**
 * Calcule les stats par jour pour les 7 derniers jours (du plus ancien au plus récent).
 * Retourne toujours 7 entrées, même si 0 parties un jour donné.
 */
export function computeDailyStats(games: RankedGame[]): DayStat[] {
  const DAYS_FR = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam']
  const result: DayStat[] = []

  for (let d = 6; d >= 0; d--) {
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    dayStart.setDate(dayStart.getDate() - d)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)

    const dayGames = games.filter(g => g.timestamp >= dayStart.getTime() && g.timestamp < dayEnd.getTime())
    const wins = dayGames.filter(g => g.result === 'win').length
    const kdas = dayGames.map(g => g.deaths === 0 ? 5 : (g.kills + g.assists) / g.deaths)
    const avgKda = kdas.length > 0 ? kdas.reduce((a, b) => a + b, 0) / kdas.length : 0

    result.push({
      date: DAYS_FR[dayStart.getDay()],
      dateShort: `${dayStart.getDate().toString().padStart(2, '0')}/${(dayStart.getMonth() + 1).toString().padStart(2, '0')}`,
      games: dayGames.length,
      wins,
      winrate: dayGames.length > 0 ? Math.round((wins / dayGames.length) * 100) : -1,
      avgKda: Math.round(avgKda * 100) / 100,
    })
  }

  return result
}

// ─── Debrief local par partie (gratuit, sans API) ─────────────────────────────

export interface LocalDebrief {
  strengths: string[]
  improvements: string[]
  keyTakeaway: string
  score: number
}

/**
 * Analyse une partie individuelle et génère un debrief structuré localement.
 * Pas d'appel API — tout est calculé depuis les données de la partie.
 */
export function computeLocalDebrief(game: RankedGame): LocalDebrief {
  const strengths: string[] = []
  const improvements: string[] = []

  const kda = game.deaths === 0 ? (game.kills + game.assists) : (game.kills + game.assists) / game.deaths
  const csMin = game.gameTime > 60 ? game.cs / (game.gameTime / 60) : 0
  const kp = game.teamKills > 0 ? ((game.kills + game.assists) / game.teamKills) * 100 : 0
  const visionMin = game.gameTime > 60 ? game.wardScore / (game.gameTime / 60) : 0
  const gameMin = game.gameTime / 60
  const deathsPerMin = gameMin > 0 ? game.deaths / gameMin : 0

  // ── KDA analysis ──
  if (kda >= 5) {
    strengths.push(`KDA exceptionnel (${kda.toFixed(1)}) — tu as dominé cette partie`)
  } else if (kda >= 3) {
    strengths.push(`Bon KDA (${kda.toFixed(1)}) — tu as joué clean`)
  } else if (kda < 1.5 && game.deaths >= 5) {
    improvements.push(`KDA trop bas (${kda.toFixed(1)}) — ${game.deaths} morts, joue plus prudemment`)
  } else if (kda < 2) {
    improvements.push(`KDA insuffisant (${kda.toFixed(1)}) — essaie de réduire tes morts`)
  }

  // ── CS analysis ──
  if (csMin >= 8) {
    strengths.push(`Farming excellent (${csMin.toFixed(1)} CS/min) — tu absorbes bien les ressources`)
  } else if (csMin >= 6.5) {
    strengths.push(`CS correct (${csMin.toFixed(1)}/min) — continue à ne pas rater les canons`)
  } else if (csMin < 5 && csMin > 0) {
    improvements.push(`CS trop bas (${csMin.toFixed(1)}/min) — chaque 15 CS = ~1 kill en or`)
  }

  // ── Kill participation ──
  if (kp >= 70) {
    strengths.push(`${kp.toFixed(0)}% KP — tu étais impliqué dans presque tous les kills`)
  } else if (kp < 35 && game.teamKills >= 5) {
    improvements.push(`Seulement ${kp.toFixed(0)}% KP — roam plus ou groupe pour les teamfights`)
  }

  // ── Vision ──
  if (visionMin >= 1.5) {
    strengths.push(`Excellent contrôle de vision (${game.wardScore} score) — tu aides ton équipe à jouer safe`)
  } else if (visionMin < 0.4 && gameMin > 15) {
    improvements.push(`Vision très basse (${visionMin.toFixed(1)}/min) — achète des wards de contrôle`)
  }

  // ── Deaths timing ──
  if (game.deaths === 0) {
    strengths.push('Zero mort — partie parfaite en survie')
  } else if (deathsPerMin > 0.35) {
    improvements.push(`${deathsPerMin.toFixed(2)} morts/min — tu meurs trop souvent, joue plus safe`)
  }

  // ── Game length ──
  if (game.result === 'win' && gameMin < 25) {
    strengths.push(`Victoire rapide en ${Math.floor(gameMin)} min — tu as bien converti ton avantage`)
  } else if (game.result === 'loss' && gameMin > 35) {
    improvements.push(`Partie perdue en ${Math.floor(gameMin)} min — essaie de closer plus tôt quand tu es ahead`)
  }

  // ── Kills vs assists ratio ──
  if (game.kills >= 10 && game.assists >= 10) {
    strengths.push(`${game.kills} kills + ${game.assists} assists — tu as tout fait dans cette partie`)
  }

  // ── Key takeaway ──
  let keyTakeaway = ''
  if (game.result === 'win') {
    if (kda >= 4 && csMin >= 7) {
      keyTakeaway = 'Partie modèle — continue de jouer comme ça et tu grimperas'
    } else if (kda < 2) {
      keyTakeaway = 'Victoire mais trop de morts — tu ne pourras pas toujours compter sur tes coéquipiers'
    } else if (csMin < 5) {
      keyTakeaway = 'Tu gagnes mais tu farm pas assez — avec un meilleur CS tu aurais snowball plus vite'
    } else {
      keyTakeaway = 'Bonne victoire — focus CS et vision pour passer au niveau supérieur'
    }
  } else {
    if (kda >= 3 && kp >= 60) {
      keyTakeaway = 'Tu as bien joué mais l\'équipe n\'a pas suivi — continue de carry comme ça'
    } else if (game.deaths >= 8) {
      keyTakeaway = `${game.deaths} morts = trop de gold gratuit pour l'ennemi. Joue plus safe, farm, et attends les ouvertures`
    } else if (csMin < 5) {
      keyTakeaway = 'La défaite vient probablement d\'un retard de farm — priorité : 7+ CS/min'
    } else {
      keyTakeaway = 'Défaite — analyse : as-tu farm, wardé, et participé aux objectifs ?'
    }
  }

  const grade = computeGameGrade(game)

  // Assurer au moins 1 item dans chaque liste
  if (strengths.length === 0) strengths.push('Partie jouée — garde la motivation')
  if (improvements.length === 0) improvements.push('Rien de critique — maintiens ce niveau')

  return {
    strengths: strengths.slice(0, 4),
    improvements: improvements.slice(0, 4),
    keyTakeaway,
    score: grade.score,
  }
}
