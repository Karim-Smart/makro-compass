/**
 * AI Win Condition Tracker — Overlay temps réel avec % victoire + condition + action.
 * Tier requis : Elite
 * Cycle de 60s pendant la partie.
 */
import Anthropic from '@anthropic-ai/sdk'
import { DEV_MOCK_AI } from '../../shared/constants'
import { IPC } from '../../shared/ipc-channels'
import { guardFeature } from './subscriptionAgent'
import { broadcastToWindows } from '../main/ipcHandlers'
import type { GameData, WinConditionData } from '../../shared/types'

let anthropic: Anthropic | null = null
let tracker: ReturnType<typeof setInterval> | null = null
let initialTimeout: ReturnType<typeof setTimeout> | null = null
let currentGameData: GameData | null = null
let isActive = false

export function setWinConditionClient(client: Anthropic): void {
  anthropic = client
}

const SYSTEM_PROMPT = `Tu es un analyste de probabilité de victoire League of Legends. Analyse l'état actuel de la partie et retourne un JSON.

RÉPONDS UNIQUEMENT en JSON valide avec ce format exact :
{
  "winProbability": 55,
  "primaryCondition": "Condition principale pour gagner",
  "nextAction": "Prochaine action à faire",
  "trend": "up"
}

RÈGLES :
- "winProbability" : 0 à 100 (basé sur gold diff, objectifs, tours, composition)
- "primaryCondition" : 1 phrase, la win condition principale de ton équipe
- "nextAction" : 1 phrase impérative, l'action immédiate à faire
- "trend" : "up" (situation s'améliore), "stable" ou "down" (situation se dégrade)
- Langue : FRANÇAIS uniquement
- Sois précis et actionnable`

let lastMockWinProb = 50

function generateMockWinCondition(gameData: GameData): WinConditionData {
  const killDiff = gameData.teamKills - gameData.enemyKills
  const drakeDiff = gameData.objectives.dragonStacks - gameData.objectives.enemyDragonStacks
  const towerDiff = gameData.towers.enemyDestroyed - gameData.towers.allyDestroyed
  const phase = gameData.gameTime < 840 ? 'early' : gameData.gameTime < 1500 ? 'mid' : 'late'

  // Probabilité calculée à partir de multiples facteurs
  let winProb = 50
  winProb += killDiff * 2.5       // chaque kill diff = ~2.5%
  winProb += drakeDiff * 4        // chaque drake diff = ~4%
  winProb += towerDiff * 3        // chaque tour diff = ~3%
  if (gameData.objectives.baronActive) winProb += 10
  if (gameData.objectives.elderActive) winProb += 15
  winProb = Math.max(5, Math.min(95, Math.round(winProb)))

  // Trend basé sur l'évolution depuis le dernier tick
  const trend: WinConditionData['trend'] = winProb > lastMockWinProb + 3 ? 'up'
    : winProb < lastMockWinProb - 3 ? 'down'
    : 'stable'
  lastMockWinProb = winProb

  // Condition principale contextuelle
  let primaryCondition: string
  if (gameData.objectives.elderActive) {
    primaryCondition = 'Elder Dragon actif — forcez un fight immédiat'
  } else if (gameData.objectives.baronActive) {
    primaryCondition = 'Baron buff actif — push 2 lanes et étouffez'
  } else if (gameData.objectives.dragonStacks >= 3) {
    primaryCondition = 'Soul point ! Sécurisez le prochain Drake'
  } else if (gameData.objectives.enemyDragonStacks >= 3) {
    primaryCondition = 'Ennemi au soul point — contestez le prochain Drake à tout prix'
  } else if (killDiff > 5) {
    primaryCondition = 'Avantage écrasant — étouffez leur jungle et forcez les objectifs'
  } else if (killDiff < -5) {
    primaryCondition = 'Fort retard — farmez safe et attendez une erreur ennemie'
  } else if (towerDiff > 2) {
    primaryCondition = 'Avantage de tours — utilisez la pression map pour contrôler les objectifs'
  } else if (phase === 'early') {
    primaryCondition = 'Phase de lane — priorisez CS et vision pour préparer le mid-game'
  } else if (phase === 'late') {
    primaryCondition = winProb >= 50 ? 'Baron est la clé pour finir — contrôlez le pit' : 'Défendez les inhib et cherchez un miracle Elder'
  } else {
    primaryCondition = 'Contestez chaque objectif neutre pour construire votre avantage'
  }

  // Action immédiate
  let nextAction: string
  if (gameData.objectives.elderActive) {
    nextAction = 'Engagez MAINTENANT — Elder execute fait la différence'
  } else if (gameData.objectives.baronActive) {
    nextAction = 'Push mid et bot en même temps — ne groupez pas 5 sur une lane'
  } else if (phase === 'late' && gameData.gameTime >= 1200) {
    nextAction = winProb >= 50 ? 'Setup Baron : vision des 2 côtés du pit' : 'Dégagez les vagues latérales avant de contester'
  } else if (drakeDiff <= -2) {
    nextAction = 'Priorisez le prochain Drake — arrivez 30s en avance avec wards'
  } else if (phase === 'early') {
    nextAction = 'Crash ta vague et aide ton jungler au prochain objectif'
  } else {
    nextAction = killDiff >= 0 ? 'Groupez pour le prochain objectif neutre' : 'Placez des wards défensives et farmez safe'
  }

  return { winProbability: winProb, primaryCondition, nextAction, trend }
}

async function generateWinCondition(gameData: GameData): Promise<WinConditionData> {
  if (DEV_MOCK_AI) {
    return generateMockWinCondition(gameData)
  }

  if (!anthropic) return generateMockWinCondition(gameData)

  const phase = gameData.gameTime < 840 ? 'EARLY' : gameData.gameTime < 1500 ? 'MID' : 'LATE'
  const killDiff = gameData.teamKills - gameData.enemyKills

  const prompt = `
[${phase} GAME] ${Math.floor(gameData.gameTime / 60)}:${String(Math.floor(gameData.gameTime % 60)).padStart(2, '0')}
Mon champion : ${gameData.champion} (niv ${gameData.level})
KDA : ${gameData.kda.kills}/${gameData.kda.deaths}/${gameData.kda.assists}
Kills équipe : ${gameData.teamKills} vs ${gameData.enemyKills} (diff: ${killDiff > 0 ? '+' : ''}${killDiff})
Drakes : nous ${gameData.objectives.dragonStacks} / eux ${gameData.objectives.enemyDragonStacks}
Baron : ${gameData.objectives.baronActive ? 'ACTIF' : gameData.gameTime >= 1200 ? 'Disponible' : 'Pas spawn'}
Tours : perdues ${gameData.towers.allyDestroyed} / détruites ${gameData.towers.enemyDestroyed}
Alliés : ${gameData.allies.join(', ')}
Ennemis : ${gameData.enemies.join(', ')}

Retourne le JSON.`.trim()

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    })

    const textContent = message.content.find((c) => c.type === 'text')
    if (!textContent || textContent.type !== 'text') return generateMockWinCondition(gameData)

    const fallback = generateMockWinCondition(gameData)
    const parsed = JSON.parse(textContent.text) as WinConditionData
    return {
      winProbability: typeof parsed.winProbability === 'number' ? Math.max(0, Math.min(100, parsed.winProbability)) : 50,
      primaryCondition: parsed.primaryCondition ?? fallback.primaryCondition,
      nextAction: parsed.nextAction ?? fallback.nextAction,
      trend: ['up', 'stable', 'down'].includes(parsed.trend) ? parsed.trend : 'stable',
    }
  } catch (error) {
    console.error('[WinConditionTracker] Erreur:', (error as Error).message)
    return generateMockWinCondition(gameData)
  }
}

async function tick(): Promise<void> {
  if (!isActive || !currentGameData) return

  const hasAccess = await guardFeature('wincondition_tracker')
  if (!hasAccess) return

  const data = await generateWinCondition(currentGameData)
  broadcastToWindows(IPC.WIN_CONDITION, data)
}

export function onGameStart(): void {
  isActive = true
  lastMockWinProb = 50
  // Premier tick après 10s pour avoir un premier feedback rapide
  initialTimeout = setTimeout(() => {
    initialTimeout = null
    tick()
  }, 10_000)
  // Puis cycle régulier toutes les 60s
  tracker = setInterval(tick, 60_000)
  console.log('[WinConditionTracker] Démarré — premier tick dans 10s puis cycle de 60s')
}

export function updateGameData(gameData: GameData): void {
  currentGameData = gameData
}

export function onGameEnd(): void {
  isActive = false
  currentGameData = null
  if (initialTimeout) {
    clearTimeout(initialTimeout)
    initialTimeout = null
  }
  if (tracker) {
    clearInterval(tracker)
    tracker = null
  }
  lastMockWinProb = 50
  console.log('[WinConditionTracker] Arrêté')
}
