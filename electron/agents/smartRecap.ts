/**
 * AI Smart Recap — Génère un résumé headline pour une partie classée.
 * Tier requis : Pro+
 * Cache SQLite pour ne pas re-générer.
 */
import Anthropic from '@anthropic-ai/sdk'
import { DEV_MOCK_AI } from '../../shared/constants'
import { guardFeature } from './subscriptionAgent'
import { getSmartRecap as getCachedRecap, saveSmartRecap } from './quotaManager'
import type { RankedGame, SmartRecap } from '../../shared/types'

let anthropic: Anthropic | null = null

export function setSmartRecapClient(client: Anthropic): void {
  anthropic = client
}

// ── Mock intelligent basé sur les stats ──────────────────────────────────────

function calculateGrade(game: RankedGame): SmartRecap['grade'] {
  const kda = game.deaths === 0 ? game.kills + game.assists : (game.kills + game.assists) / game.deaths
  const csPerMin = game.gameTime > 0 ? game.cs / (game.gameTime / 60) : 0
  const kp = game.teamKills > 0 ? ((game.kills + game.assists) / game.teamKills) * 100 : 0

  let score = 0

  // KDA
  if (kda >= 8) score += 30
  else if (kda >= 5) score += 25
  else if (kda >= 3) score += 20
  else if (kda >= 2) score += 15
  else if (kda >= 1) score += 10
  else score += 5

  // CS/min
  if (csPerMin >= 8) score += 20
  else if (csPerMin >= 7) score += 17
  else if (csPerMin >= 6) score += 14
  else if (csPerMin >= 5) score += 10
  else score += 5

  // Kill participation
  if (kp >= 70) score += 20
  else if (kp >= 50) score += 15
  else if (kp >= 35) score += 10
  else score += 5

  // Ward score
  if (game.wardScore >= 30) score += 10
  else if (game.wardScore >= 20) score += 7
  else if (game.wardScore >= 10) score += 5
  else score += 2

  // Win bonus
  if (game.result === 'win') score += 10

  // Deaths penalty
  if (game.deaths >= 10) score -= 15
  else if (game.deaths >= 7) score -= 10
  else if (game.deaths >= 5) score -= 5

  if (score >= 75) return 'S'
  if (score >= 60) return 'A'
  if (score >= 45) return 'B'
  if (score >= 30) return 'C'
  return 'D'
}

function generateMockRecap(game: RankedGame): SmartRecap {
  const grade = calculateGrade(game)
  const kda = game.deaths === 0 ? game.kills + game.assists : (game.kills + game.assists) / game.deaths
  const csPerMin = game.gameTime > 0 ? game.cs / (game.gameTime / 60) : 0
  const kp = game.teamKills > 0 ? ((game.kills + game.assists) / game.teamKills) * 100 : 0
  const minutes = Math.floor(game.gameTime / 60)
  const killDiff = game.teamKills - game.enemyKills
  const isWin = game.result === 'win'

  // Headline contextuel
  let headline: string
  if (isWin && game.deaths === 0) {
    headline = `Partie parfaite sur ${game.champion} — ${game.kills}/${game.deaths}/${game.assists} sans une mort en ${minutes} min`
  } else if (isWin && kda >= 8) {
    headline = `Domination absolue sur ${game.champion} — ${game.kills}/${game.deaths}/${game.assists}, la diff était totale`
  } else if (isWin && killDiff >= 15) {
    headline = `Stomp complet — ${game.teamKills} à ${game.enemyKills} kills, l'ennemi n'a jamais eu une chance`
  } else if (isWin && killDiff <= 3) {
    headline = `Victoire serrée sur ${game.champion} — chaque fight comptait, le late game a fait la différence`
  } else if (isWin && csPerMin >= 8) {
    headline = `Farm machine ${game.champion} : ${csPerMin.toFixed(1)} CS/min qui a financé la victoire en ${minutes} min`
  } else if (isWin) {
    headline = `Win propre sur ${game.champion} — ${game.kills}/${game.deaths}/${game.assists} en ${minutes} min`
  } else if (!isWin && kda >= 5 && kp >= 50) {
    headline = `Effort honorable sur ${game.champion} malgré la défaite — ${game.kills}/${game.deaths}/${game.assists}, la team n'a pas suivi`
  } else if (!isWin && game.deaths >= 10) {
    headline = `Game difficile sur ${game.champion} — ${game.deaths} morts en ${minutes} min, le tilt était réel`
  } else if (!isWin && killDiff <= -15) {
    headline = `Défaite écrasante — ${game.teamKills} vs ${game.enemyKills} kills, stomp complet côté ennemi`
  } else if (!isWin && game.kills >= 8) {
    headline = `${game.champion} ${game.kills} kills mais défaite — les kills ne se sont pas convertis en objectifs`
  } else {
    headline = `Défaite sur ${game.champion} en ${minutes} min — ${game.kills}/${game.deaths}/${game.assists}, prochaine game sera mieux`
  }

  // MVP moment
  let mvpMoment: string
  if (game.deaths === 0 && game.kills >= 5) {
    mvpMoment = `Le perfect game : ${game.kills} kills sans mourir une seule fois`
  } else if (game.kills >= 10) {
    mvpMoment = `${game.kills} kills — tu étais la principale menace de ton équipe`
  } else if (kp >= 75) {
    mvpMoment = `${Math.round(kp)}% de kill participation — présent dans quasiment chaque fight`
  } else if (csPerMin >= 9) {
    mvpMoment = `${csPerMin.toFixed(1)} CS/min — une farm de niveau pro qui t'a donné un avantage d'items constant`
  } else if (game.wardScore >= 40) {
    mvpMoment = `Ward score de ${game.wardScore} — vision exceptionnelle qui a permis de contrôler la map`
  } else if (game.assists >= 15) {
    mvpMoment = `${game.assists} assists — le playmaker qui connectait chaque fight`
  } else if (isWin && killDiff <= 2) {
    mvpMoment = `La clutch play en late game — la game était serrée mais ton équipe a trouvé l'ouverture`
  } else if (game.kills >= 5 && game.deaths <= 2) {
    mvpMoment = `${game.kills}/${game.deaths} — dominance en lane avec un minimum de risque`
  } else {
    mvpMoment = `Partie en ${minutes} min — ${game.kills + game.assists} contributions au score`
  }

  return { headline, mvpMoment, grade }
}

// ── Interface publique ───────────────────────────────────────────────────────

export async function generateSmartRecapForGame(game: RankedGame): Promise<SmartRecap | null> {
  const hasAccess = await guardFeature('smart_recap')
  if (!hasAccess) return null

  // Vérifier le cache
  const cached = getCachedRecap(game.id)
  if (cached) return cached

  let recap: SmartRecap

  if (DEV_MOCK_AI) {
    recap = generateMockRecap(game)
  } else if (anthropic) {
    try {
      const kda = game.deaths === 0 ? game.kills + game.assists : (game.kills + game.assists) / game.deaths
      const csPerMin = game.gameTime > 0 ? game.cs / (game.gameTime / 60) : 0
      const kp = game.teamKills > 0 ? ((game.kills + game.assists) / game.teamKills) * 100 : 0

      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: `Tu génères des Smart Recaps pour des parties LoL. Réponds UNIQUEMENT en JSON valide.

Format exact :
{
  "headline": "Résumé accrocheur de la partie en 1 phrase (max 120 caractères)",
  "mvpMoment": "Le moment clé ou la stat la plus impressionnante en 1 phrase",
  "grade": "S"
}

RÈGLES :
- grade : S (exceptionnel), A (très bien), B (correct), C (passable), D (mauvais)
- headline : ton de commentateur sportif, percutant, en français
- mvpMoment : concret, cite des chiffres
- Langue : FRANÇAIS uniquement`,
        messages: [{
          role: 'user',
          content: `${game.champion} — ${game.result === 'win' ? 'VICTOIRE' : 'DÉFAITE'} en ${Math.floor(game.gameTime / 60)} min
KDA: ${game.kills}/${game.deaths}/${game.assists} (ratio: ${kda.toFixed(1)})
CS: ${game.cs} (${csPerMin.toFixed(1)}/min) | Gold: ${game.gold.toLocaleString()}
Équipe: ${game.teamKills} kills vs ${game.enemyKills} | KP: ${Math.round(kp)}%
Ward score: ${game.wardScore}
Alliés: ${(game.allies ?? []).join(', ') || 'inconnus'} | Ennemis: ${(game.enemies ?? []).join(', ') || 'inconnus'}`,
        }],
      })

      const text = message.content.find(c => c.type === 'text')
      if (text && text.type === 'text') {
        const fallback = generateMockRecap(game)
        const parsed = JSON.parse(text.text) as SmartRecap
        const validGrades = ['S', 'A', 'B', 'C', 'D']
        recap = {
          headline: typeof parsed.headline === 'string' ? parsed.headline : fallback.headline,
          mvpMoment: typeof parsed.mvpMoment === 'string' ? parsed.mvpMoment : fallback.mvpMoment,
          grade: validGrades.includes(parsed.grade) ? parsed.grade : fallback.grade,
        }
      } else {
        recap = generateMockRecap(game)
      }
    } catch (err) {
      console.error('[SmartRecap] Erreur API:', (err as Error).message)
      recap = generateMockRecap(game)
    }
  } else {
    recap = generateMockRecap(game)
  }

  // Sauvegarder en cache
  saveSmartRecap(game.id, recap)
  console.log(`[SmartRecap] Recap générée — ${game.champion} ${game.result} (grade: ${recap.grade})`)

  return recap
}
