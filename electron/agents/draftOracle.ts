/**
 * AI Draft Oracle — Analyse IA de la composition en champion select.
 * Tier requis : Pro+
 */
import Anthropic from '@anthropic-ai/sdk'
import { DEV_MOCK_AI } from '../../shared/constants'
import { guardFeature } from './subscriptionAgent'
import type { DraftOracleRequest, DraftOracleResponse } from '../../shared/types'

let anthropic: Anthropic | null = null

export function setDraftOracleClient(client: Anthropic): void {
  anthropic = client
}

const SYSTEM_PROMPT = `Tu es un analyste de draft League of Legends expert. Tu analyses les compositions d'équipe et donnes des conseils stratégiques.

RÉPONDS UNIQUEMENT en JSON valide avec ce format exact :
{
  "analysis": "Analyse textuelle de la comp en 2-3 phrases",
  "suggestions": [
    { "champion": "NomChampion", "reason": "Raison en 1 phrase", "score": 85 }
  ],
  "winConditions": ["Condition 1", "Condition 2"]
}

RÈGLES :
- "suggestions" : exactement 3 champions recommandés pour le poste assigné
- "score" : de 0 à 100 (pertinence du pick)
- "winConditions" : 2-3 conditions de victoire pour la comp actuelle
- Langue : FRANÇAIS uniquement
- Prends en compte les synergies alliées ET les counters ennemis`

// ── Données de suggestions par rôle (mock intelligent) ──────────────────────

const ROLE_SUGGESTIONS: Record<string, { champion: string; reason: string; score: number }[]> = {
  TOP: [
    { champion: 'K\'Sante', reason: 'Tank polyvalent avec engage et sustain, domine la plupart des matchups top', score: 90 },
    { champion: 'Jax', reason: 'Split-pusher redoutable en late game, écrase les auto-attackers', score: 85 },
    { champion: 'Aatrox', reason: 'Sustain et teamfight AoE, excelle en mid-game skirmish', score: 80 },
    { champion: 'Gnar', reason: 'Polyvalent lane bully avec engage teamfight en Mega Gnar', score: 77 },
  ],
  JUNGLE: [
    { champion: 'Vi', reason: 'Engage fiable et burst sur carry, excellente pour pick-off', score: 88 },
    { champion: 'Lee Sin', reason: 'Playmaker early game, kick d\'isolation sur le carry ennemi', score: 84 },
    { champion: 'Viego', reason: 'Reset en teamfight et adaptabilité, snowball très fort', score: 81 },
    { champion: 'Jarvan IV', reason: 'Engage garantie avec Cataclysm, flag+drag combo dévastateur', score: 78 },
  ],
  MID: [
    { champion: 'Orianna', reason: 'CC de zone et synergies avec les engages, safe en lane', score: 89 },
    { champion: 'Ahri', reason: 'Pick-off avec charm, mobilité élevée et roaming efficace', score: 85 },
    { champion: 'Viktor', reason: 'Contrôle de zone massif et scaling exceptionnel en late', score: 82 },
    { champion: 'Syndra', reason: 'Burst assassin et zone control, domine la lane avec sa portée', score: 79 },
  ],
  ADC: [
    { champion: 'Jinx', reason: 'Hypercarry avec resets en teamfight, scaling exponentiel', score: 88 },
    { champion: 'Kai\'Sa', reason: 'Hybride AP/AD, assassinat des carries avec ult et burst', score: 84 },
    { champion: 'Jhin', reason: 'Utilitaire avec root et slow, 4ème tir dévastateur en late', score: 80 },
    { champion: 'Ezreal', reason: 'Sécurité maximale avec E et poke longue portée, très safe', score: 77 },
  ],
  SUPPORT: [
    { champion: 'Thresh', reason: 'Polyvalent : engage, peel, lantern save, playmaker ultime', score: 91 },
    { champion: 'Nautilus', reason: 'Engage imparable avec R point & click, CC chain énorme', score: 86 },
    { champion: 'Lulu', reason: 'Peel imbattable pour le carry, polymorph neutralise les assassins', score: 83 },
    { champion: 'Rakan', reason: 'Engage rapide et charme AoE, synergie Xayah si applicable', score: 79 },
  ],
}

function generateMockDraftResponse(req: DraftOracleRequest): DraftOracleResponse {
  const role = req.assignedPosition || 'MID'
  const pool = ROLE_SUGGESTIONS[role] ?? ROLE_SUGGESTIONS.MID

  const allyNames = req.myTeam.filter(p => p.completed && p.championName).map(p => p.championName)
  const enemyNames = req.theirTeam.filter(p => p.completed && p.championName).map(p => p.championName)

  // Filtrer les champions déjà pick des suggestions
  const allPicked = [...allyNames, ...enemyNames]
  const available = pool.filter(s => !allPicked.includes(s.champion))
  // Fallback : si tous les champions du pool sont pris, retourner le pool sans filtre
  const suggestions = (available.length >= 3 ? available : pool).slice(0, 3)

  // Analyse contextuelle basée sur la composition
  const ENGAGE_CHAMPS = ['Malphite', 'Leona', 'Nautilus', 'Amumu', 'Jarvan IV', 'Rakan', 'Ornn', 'Sett', 'K\'Sante', 'Sejuani', 'Rell', 'Alistar']
  const PEEL_CHAMPS = ['Lulu', 'Janna', 'Thresh', 'Braum', 'Yuumi', 'Soraka', 'Renata Glasc', 'Milio']
  const ASSASSIN_CHAMPS = ['Zed', 'Talon', 'Katarina', 'Fizz', 'Akali', 'LeBlanc', 'Qiyana', 'Kha\'Zix', 'Evelynn', 'Pyke', 'Rengar']
  const hasEngage = allyNames.some(n => ENGAGE_CHAMPS.includes(n))
  const hasPeel = allyNames.some(n => PEEL_CHAMPS.includes(n))
  const enemyHasAssassin = enemyNames.some(n => ASSASSIN_CHAMPS.includes(n))
  const enemyAssassins = enemyNames.filter(n => ASSASSIN_CHAMPS.includes(n))

  let analysis: string
  if (enemyHasAssassin && !hasPeel) {
    analysis = `Attention : l'ennemi a des assassins (${enemyAssassins.join(', ')}). Priorisez un champion avec du peel ou du CC pour protéger vos carries.`
  } else if (!hasEngage && allyNames.length >= 2) {
    analysis = `Votre composition manque d'engage. Un initiateur renforcerait considérablement vos teamfights autour des objectifs. Cherchez un champion avec du CC de zone.`
  } else if (allyNames.length >= 3) {
    analysis = `Bonne base de composition. Complétez avec un champion qui apporte ${hasEngage ? 'des dégâts soutenus' : 'du contrôle de zone'} pour maximiser votre potentiel de teamfight.`
  } else {
    analysis = `Draft en cours. Surveillez la composition ennemie pour adapter votre pick. Le ${role} est un rôle clé pour ${role === 'SUPPORT' ? 'le peel et la vision' : role === 'JUNGLE' ? 'le tempo early' : 'la pression de lane et les roams'}.`
  }

  const winConditions = [
    hasEngage
      ? 'Forcer des teamfights autour des objectifs avec votre avantage d\'engage'
      : 'Chercher des picks isolés avant de forcer les objectifs',
    enemyHasAssassin
      ? 'Grouper serré pour ne pas donner d\'angle aux assassins ennemis'
      : 'Contrôler les flanks et la vision pour imposer votre tempo',
    allyNames.length >= 3
      ? 'Exploiter vos synergies de composition pour dominer les teamfights mid-game'
      : 'Adapter votre draft aux picks restants de l\'ennemi',
  ]

  return { analysis, suggestions, winConditions }
}

export async function analyzeDraft(req: DraftOracleRequest): Promise<DraftOracleResponse> {
  // Guard tier
  const hasAccess = await guardFeature('draft_oracle')
  if (!hasAccess) {
    throw new Error('Fonctionnalité réservée au tier Pro ou supérieur')
  }

  // Mock en dev — réponse contextuelle basée sur le draft réel
  if (DEV_MOCK_AI) {
    console.log(`[DraftOracle] Mock — analyse draft pour ${req.assignedPosition}`)
    return generateMockDraftResponse(req)
  }

  if (!anthropic) {
    throw new Error('Client Anthropic non initialisé. Configurez votre clé API.')
  }

  const allyPicks = req.myTeam
    .filter((p) => p.completed && p.championName)
    .map((p) => `${p.championName} (${p.assignedPosition})`)
    .join(', ') || 'aucun'

  const enemyPicks = req.theirTeam
    .filter((p) => p.completed && p.championName)
    .map((p) => `${p.championName} (${p.assignedPosition})`)
    .join(', ') || 'aucun'

  const userPrompt = `
Analyse cette draft et suggère 3 champions pour le poste ${req.assignedPosition}.

Alliés : ${allyPicks}
Ennemis : ${enemyPicks}
Poste à remplir : ${req.assignedPosition}
Style de jeu : ${req.style}

Retourne uniquement le JSON.`.trim()

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const textContent = message.content.find((c) => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      return generateMockDraftResponse(req)
    }

    const fallback = generateMockDraftResponse(req)
    const parsed = JSON.parse(textContent.text) as DraftOracleResponse
    return {
      analysis: parsed.analysis ?? fallback.analysis,
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3) : fallback.suggestions,
      winConditions: Array.isArray(parsed.winConditions) ? parsed.winConditions : fallback.winConditions,
    }
  } catch (error) {
    console.error('[DraftOracle] Erreur:', (error as Error).message)
    return generateMockDraftResponse(req)
  }
}
