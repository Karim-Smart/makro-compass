/**
 * AI Post-Game Debrief — Analyse IA personnalisée après chaque partie.
 * Tier requis : Pro+
 */
import Anthropic from '@anthropic-ai/sdk'
import { DEV_MOCK_AI } from '../../shared/constants'
import { guardFeature } from './subscriptionAgent'
import { getDebrief, saveDebrief } from './quotaManager'
import type { RankedGame, PostGameDebriefResponse } from '../../shared/types'

let anthropic: Anthropic | null = null

export function setPostGameDebriefClient(client: Anthropic): void {
  anthropic = client
}

const SYSTEM_PROMPT = `Tu es un coach League of Legends expert en analyse post-game. Tu analyses les statistiques d'une partie terminée et fournis un debrief personnalisé.

RÉPONDS UNIQUEMENT en JSON valide avec ce format exact :
{
  "strengths": ["Force 1", "Force 2", "Force 3"],
  "improvements": ["Amélioration 1", "Amélioration 2", "Amélioration 3"],
  "keyTakeaway": "Le conseil principal à retenir de cette partie"
}

RÈGLES :
- Exactement 3 forces et 3 améliorations
- Chaque point en 1-2 phrases maximum
- "keyTakeaway" : 1 phrase actionnable et concrète
- Langue : FRANÇAIS uniquement
- Base ton analyse sur les stats fournies (KDA, CS, vision, durée, résultat)
- Sois direct et constructif, pas condescendant`

function generateMockDebrief(game: RankedGame): PostGameDebriefResponse {
  const kda = game.deaths === 0 ? game.kills + game.assists : (game.kills + game.assists) / game.deaths
  const csPerMin = game.gameTime > 0 ? game.cs / (game.gameTime / 60) : 0
  const kp = game.teamKills > 0 ? Math.round(((game.kills + game.assists) / game.teamKills) * 100) : 0
  const isWin = game.result === 'win'

  // Forces — basées sur les stats réelles
  const strengths: string[] = []
  if (kda >= 3) strengths.push(`Excellent KDA de ${kda.toFixed(1)} — tu as minimisé les morts inutiles et maximisé ton impact.`)
  else if (kda >= 2) strengths.push(`Bon ratio KDA de ${kda.toFixed(1)}, un score solide qui montre une gestion correcte des fights.`)
  else strengths.push(`Malgré un KDA difficile (${kda.toFixed(1)}), tu as continué à participer aux fights d'équipe.`)

  if (csPerMin >= 7) strengths.push(`Farm exceptionnelle à ${csPerMin.toFixed(1)} CS/min — au-dessus de la moyenne des joueurs classés.`)
  else if (csPerMin >= 6) strengths.push(`Bonne farm à ${csPerMin.toFixed(1)} CS/min, tu gardes un rythme de gold constant.`)
  else if (kp >= 50) strengths.push(`Kill participation de ${kp}% — tu es présent dans les engagements importants de ton équipe.`)
  else strengths.push(`${game.kills + game.assists} participations au score — tu cherches activement à contribuer aux fights.`)

  if (game.wardScore >= 20) strengths.push(`Ward score élevé (${game.wardScore}) — ta vision contribue activement aux décisions macro.`)
  else if (isWin) strengths.push(`Victoire méritée — tu as su convertir tes avantages en objectifs concrets.`)
  else strengths.push(`${game.kills} kills accumulées montrent une bonne capacité à trouver des ouvertures.`)

  // Améliorations
  const improvements: string[] = []
  if (game.deaths >= 6) improvements.push(`${game.deaths} morts est élevé — analyse les replays pour identifier les morts évitables (mauvais positionnement, face-check).`)
  else if (game.deaths >= 4) improvements.push(`${game.deaths} morts reste améliorable — certaines étaient probablement dues à un mauvais timing de rotation.`)
  else improvements.push(`Continue à travailler le wave management pour créer encore plus de pression sans prendre de risques.`)

  if (csPerMin < 6) improvements.push(`CS/min de ${csPerMin.toFixed(1)} est en dessous du seuil optimal (7+). Travaille les last-hit sous tour et le farming entre les objectifs.`)
  else if (csPerMin < 8) improvements.push(`Optimise tes backs pour ne pas perdre de vagues — crash la wave avant de recall pour dépasser les ${csPerMin.toFixed(0)} CS/min.`)
  else improvements.push(`Farm excellente — prochaine étape : utilise ton avantage de gold pour contrôler la vision et forcer les objectifs.`)

  if (game.wardScore < 15) improvements.push(`Ward score de ${game.wardScore} est faible — achète des pinks régulièrement et place des wards deep avant chaque objectif.`)
  else improvements.push(`Continue à diversifier tes emplacements de ward — vision deep dans la jungle ennemie en mid-game.`)

  // Conseil principal
  let keyTakeaway: string
  if (!isWin && game.deaths >= 6) {
    keyTakeaway = `Réduis tes morts en priorité : chaque mort donne ~300g à l'ennemi + du temps mort. Cible max 3-4 morts par game en jouant plus safe en mid-game.`
  } else if (!isWin && csPerMin < 5.5) {
    keyTakeaway = `Améliore ta farm : la différence entre 5 et 7 CS/min sur 25 minutes = ~2000g d'écart. Drill les last-hit dans l'outil d'entraînement.`
  } else if (isWin && kda >= 4) {
    keyTakeaway = `Excellente performance ! Pour progresser davantage, concentre-toi sur le shotcalling : appelle les objectifs et guide les rotations de ton équipe.`
  } else if (isWin) {
    keyTakeaway = `Bien joué la victoire ! Prochain objectif : augmenter ton CS/min à 7+ pour avoir un gold lead constant même quand les kills ne viennent pas.`
  } else {
    keyTakeaway = `Focus la vision et les objectifs neutres : 1 drake > 2 kills. Place toujours 2 wards deep 30s avant le spawn d'un objectif.`
  }

  return { strengths: strengths.slice(0, 3), improvements: improvements.slice(0, 3), keyTakeaway }
}

export async function generateDebrief(game: RankedGame): Promise<PostGameDebriefResponse> {
  // Guard tier
  const hasAccess = await guardFeature('postgame_debrief')
  if (!hasAccess) {
    throw new Error('Fonctionnalité réservée au tier Pro ou supérieur')
  }

  // Vérifier le cache SQLite
  const cached = getDebrief(game.id)
  if (cached) return cached

  // Mock en dev — réponse contextuelle basée sur les stats réelles
  if (DEV_MOCK_AI) {
    console.log(`[PostGameDebrief] Mock — debrief pour game ${game.id} (${game.champion})`)
    const mockResult = generateMockDebrief(game)
    saveDebrief(game.id, mockResult)
    return mockResult
  }

  if (!anthropic) {
    throw new Error('Client Anthropic non initialisé. Configurez votre clé API.')
  }

  const kda = game.deaths === 0 ? game.kills + game.assists : (game.kills + game.assists) / game.deaths
  const csPerMin = game.gameTime > 0 ? (game.cs / (game.gameTime / 60)).toFixed(1) : '0'
  const kp = game.teamKills > 0 ? Math.round(((game.kills + game.assists) / game.teamKills) * 100) : 0
  const duration = `${Math.floor(game.gameTime / 60)}:${String(game.gameTime % 60).padStart(2, '0')}`

  const userPrompt = `
Analyse cette partie et donne un debrief :

Résultat : ${game.result === 'win' ? 'VICTOIRE' : 'DÉFAITE'}
Champion : ${game.champion}
KDA : ${game.kills}/${game.deaths}/${game.assists} (ratio: ${kda.toFixed(2)})
CS : ${game.cs} (${csPerMin}/min)
Gold : ${game.gold.toLocaleString()}
Kill participation : ${kp}%
Ward score : ${game.wardScore}
Durée : ${duration}
Niveau : ${game.level}
Alliés : ${game.allies.join(', ')}
Ennemis : ${game.enemies.join(', ')}
Items : ${game.items.join(', ')}
Queue : ${game.queueType === 'RANKED_SOLO' ? 'Solo/Duo' : 'Flex'}

Retourne uniquement le JSON.`.trim()

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const textContent = message.content.find((c) => c.type === 'text')
    const fallback = generateMockDebrief(game)
    if (!textContent || textContent.type !== 'text') {
      saveDebrief(game.id, fallback)
      return fallback
    }

    const parsed = JSON.parse(textContent.text) as PostGameDebriefResponse
    const result: PostGameDebriefResponse = {
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 3) : fallback.strengths,
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements.slice(0, 3) : fallback.improvements,
      keyTakeaway: parsed.keyTakeaway ?? fallback.keyTakeaway,
    }

    // Sauvegarder dans le cache
    saveDebrief(game.id, result)
    return result
  } catch (error) {
    console.error('[PostGameDebrief] Erreur:', (error as Error).message)
    return generateMockDebrief(game)
  }
}
