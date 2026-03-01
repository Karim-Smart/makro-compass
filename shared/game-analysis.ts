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
  const topChampGames = Math.max(...Object.values(champCounts))
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

  return insights.sort((a, b) => b.priority - a.priority).slice(0, 5)
}
