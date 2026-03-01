import Anthropic from '@anthropic-ai/sdk'
import { IPC } from '../../shared/ipc-channels'
import { COACHING_STYLES, QUOTA_RULES } from '../../shared/constants'
import type { CoachAdvice, CoachingStyle, GameData, SubscriptionTier } from '../../shared/types'
import { broadcastToWindows } from '../main/ipcHandlers'
import { getQuotaStatus, incrementQuota, logAdvice } from './quotaManager'
import { getSubscriptionStatus } from './subscriptionAgent'

// ─── État interne ─────────────────────────────────────────────────────────────

let currentStyle: CoachingStyle = 'LCK'
let lastAdviceTime: number | null = null
let isInGame = false
let currentGameData: GameData | null = null
let adviceTimer: ReturnType<typeof setInterval> | null = null
let anthropic: Anthropic | null = null

// ─── Initialisation ───────────────────────────────────────────────────────────

function getAnthropicClient(): Anthropic {
  if (!anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY non définie. Configurer dans les paramètres.')
    }
    anthropic = new Anthropic({ apiKey })
  }
  return anthropic
}

/**
 * Met à jour la clé API Anthropic (appelé depuis les settings utilisateur).
 * Réinitialise le client pour utiliser la nouvelle clé immédiatement.
 */
export function setApiKey(apiKey: string): void {
  anthropic = new Anthropic({ apiKey })
  console.log('[AICoachAgent] Clé API mise à jour.')
}

// ─── Gestion du style ─────────────────────────────────────────────────────────

export function setCoachingStyle(style: CoachingStyle): void {
  currentStyle = style
  console.log(`[AICoachAgent] Style changé → ${style}`)
}

export function getCoachingStyle(): CoachingStyle {
  return currentStyle
}

// ─── Cycle de vie (appelé par riotAgent) ──────────────────────────────────────

export function onGameStart(gameData: GameData): void {
  isInGame = true
  currentGameData = gameData
  lastAdviceTime = null
  console.log('[AICoachAgent] Partie démarrée, en attente du premier conseil...')
}

/** Mis à jour à chaque poll Riot (données de jeu en temps réel). */
export function updateGameData(gameData: GameData): void {
  currentGameData = gameData
}

const OBJECTIVE_LABELS: Record<string, string> = {
  dragon: 'Un dragon',
  baron:  'Le Baron Nashor',
  herald: 'Le Héraut de la Faille',
  tower:  'Une tour',
}

/**
 * Déclenche un conseil spécifique 5s après la mort d'un objectif.
 * Bypasse le cooldown régulier mais respecte le quota quotidien.
 */
export function scheduleObjectiveAdvice(objective: string, gameData: GameData): void {
  const label = OBJECTIVE_LABELS[objective] ?? objective
  setTimeout(async () => {
    if (!isInGame) return
    await generateAdvice(currentGameData ?? gameData, label)
  }, 5_000)
}

export function onGameEnd(): void {
  isInGame = false
  currentGameData = null
  lastAdviceTime = null
  console.log('[AICoachAgent] Partie terminée.')
}

// ─── Génération de conseil ────────────────────────────────────────────────────

/**
 * Construit le prompt utilisateur à partir des données de jeu.
 */
function buildUserPrompt(gameData: GameData, objectiveTrigger?: string): string {
  const { kda, cs, gold, gameTime, level, objectives, allies, enemies, gameMode, items, towers, teamKills, enemyKills } = gameData
  const minutes  = Math.floor(gameTime / 60)
  const seconds  = gameTime % 60
  const csPerMin = gameTime > 0 ? (cs / (gameTime / 60)).toFixed(1) : '0'

  const modeLabel: Record<string, string> = {
    CLASSIC:      'Partie classique (Summoner\'s Rift)',
    ARAM:         'ARAM (Howling Abyss)',
    PRACTICETOOL: 'Outil d\'entraînement',
    URF:          'URF',
    CHERRY:       'Arena',
  }
  const modeFr = modeLabel[gameMode] ?? gameMode

  const allyList  = allies.length  > 0 ? allies.join(', ')  : 'inconnus'
  const enemyList = enemies.length > 0 ? enemies.join(', ') : 'inconnus'
  const itemList  = items.length   > 0 ? items.join(', ')   : 'aucun'

  // Phase de jeu
  const phase = gameTime < 840 ? 'EARLY GAME' : gameTime < 1500 ? 'MID GAME' : 'LATE GAME'

  // Kill diff
  const killDiff = teamKills - enemyKills
  const killDiffStr = killDiff > 0 ? `+${killDiff} kills d'avance` : killDiff < 0 ? `${killDiff} kills de retard` : 'kills égaux'

  // Dragons détaillé
  const dragonInfo = [`Alliés : ${objectives.dragonStacks}/4 drakes`, `Ennemis : ${objectives.enemyDragonStacks}/4 drakes`]
  if (objectives.dragonSoul) dragonInfo.push(`Terrain : ${objectives.dragonSoul}`)
  if (objectives.elderActive) dragonInfo.push('ELDER DRAGON ACTIF')

  // Tours
  const towerInfo = `Tours détruites — Alliées perdues : ${towers.allyDestroyed} | Ennemies détruites : ${towers.enemyDestroyed}`

  // Baron / Herald
  const baronStr = objectives.baronActive ? 'BARON BUFF ACTIF' : (gameTime >= 1200 ? 'Baron vivant' : 'Baron pas encore spawn')
  const heraldStr = objectives.heraldActive ? 'Héraut actif' : (gameTime < 1200 ? 'Héraut disponible' : 'Héraut disparu (>20min)')

  const objectiveContext = objectiveTrigger
    ? `\n⚠️ ÉVÉNEMENT : ${objectiveTrigger} vient d'être tué. Donne un conseil macro immédiat : que faire MAINTENANT avec cet avantage/désavantage ?`
    : ''

  return `
[${phase}] ${modeFr} — ${minutes}:${String(seconds).padStart(2, '0')}
Champion : ${gameData.champion} (niv ${level})
KDA : ${kda.kills}/${kda.deaths}/${kda.assists} | CS : ${cs} (${csPerMin}/min) | Gold : ${gold.toLocaleString()}
Items : ${itemList}
Équipe : ${teamKills} kills (${killDiffStr})
Alliés : ${allyList}
Ennemis : ${enemyList}
Dragons : ${dragonInfo.join(' | ')}
${baronStr} | ${heraldStr}
${towerInfo}
${objectiveContext}
Conseil macro concis et actionnable. Maximum 2 phrases.`.trim()
}

/**
 * Détermine la priorité du conseil en fonction du contexte de jeu.
 */
function determinePriority(gameData: GameData, objectiveTrigger?: string): 'low' | 'medium' | 'high' {
  // Baron/Elder = toujours urgent
  if (objectiveTrigger === 'Le Baron Nashor' || objectiveTrigger === 'Elder Dragon') return 'high'
  // Soul point (3+ drakes d'un côté) = urgent
  if (gameData.objectives.dragonStacks >= 3 || gameData.objectives.enemyDragonStacks >= 3) return 'high'
  // Elder actif = urgent
  if (gameData.objectives.elderActive) return 'high'
  // Late game (25+ min) = plus important
  if (gameData.gameTime >= 1500) return 'high'
  // Objectif tué = moyen
  if (objectiveTrigger) return 'medium'
  // Mid game
  if (gameData.gameTime >= 840) return 'medium'
  // Early game = info
  return 'low'
}

/**
 * Vérifie si on peut générer un nouveau conseil en fonction du quota et du cooldown.
 */
async function canGenerateAdvice(tier: SubscriptionTier, gameTime: number): Promise<boolean> {
  const rules = QUOTA_RULES[tier]

  // Vérifier le temps de jeu minimum
  const minGameTime = rules.adviceAfterMinutes * 60
  if (gameTime < minGameTime) {
    return false
  }

  // Vérifier le cooldown
  if (lastAdviceTime !== null && rules.cooldownSeconds !== null) {
    const elapsed = (Date.now() - lastAdviceTime) / 1000
    if (elapsed < rules.cooldownSeconds) {
      return false
    }
  }

  // Vérifier le quota quotidien
  const quota = await getQuotaStatus()
  if (rules.maxPerDay !== null && quota.used >= rules.maxPerDay) {
    return false
  }

  return true
}

/**
 * Génère un conseil IA via Claude Haiku et l'envoie aux renderers.
 */
async function generateAdvice(gameData: GameData, objectiveTrigger?: string): Promise<void> {
  const styleConfig = COACHING_STYLES[currentStyle]

  try {
    const client = getAnthropicClient()
    const subscription = await getSubscriptionStatus()
    const tier = subscription.tier

    // Les conseils déclenchés par un objectif contournent le cooldown régulier
    // mais respectent toujours le quota quotidien
    const skipCooldown = !!objectiveTrigger
    if (!skipCooldown && !(await canGenerateAdvice(tier, gameData.gameTime))) {
      return
    }
    // Vérifier le quota même pour les objectifs
    if (skipCooldown) {
      const quota = await getQuotaStatus()
      const rules = QUOTA_RULES[tier]
      if (rules.maxPerDay !== null && quota.used >= rules.maxPerDay) return
      const minGameTime = rules.adviceAfterMinutes * 60
      if (gameData.gameTime < minGameTime) return
    }

    console.log(`[AICoachAgent] Génération conseil (style: ${currentStyle}, tier: ${tier})`)

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: styleConfig.systemPrompt,
      messages: [
        { role: 'user', content: buildUserPrompt(gameData, objectiveTrigger) }
      ]
    })

    const textContent = message.content.find((c) => c.type === 'text')
    if (!textContent || textContent.type !== 'text') return

    // Priorité dynamique basée sur le contexte
    const priority = determinePriority(gameData, objectiveTrigger)

    const advice: CoachAdvice = {
      text: textContent.text.trim(),
      style: currentStyle,
      priority,
      timestamp: Date.now(),
      gameTime: gameData.gameTime
    }

    // Enregistrer dans le quota, logger l'historique, et mettre à jour le timestamp
    await incrementQuota()
    logAdvice(currentStyle, gameData.gameTime, advice.priority, advice.text)
    lastAdviceTime = Date.now()

    // Envoyer le conseil aux deux fenêtres
    broadcastToWindows(IPC.OVERLAY_SHOW_ADVICE, advice)
    console.log(`[AICoachAgent] Conseil envoyé : "${advice.text.slice(0, 60)}..."`)

    // Mettre à jour le quota affiché dans le renderer (sans passer par le cache)
    const updatedStatus = await getSubscriptionStatus()
    broadcastToWindows(IPC.SUBSCRIPTION_STATUS, updatedStatus)

  } catch (error) {
    console.error('[AICoachAgent] Erreur génération:', (error as Error).message)
  }
}

// ─── Démarrage / Arrêt ────────────────────────────────────────────────────────

export async function startAICoachAgent(): Promise<void> {
  console.log('[AICoachAgent] Démarrage (IA désactivée — macro tips engine actif).')
  // Timer IA désactivé : les conseils sont générés par macroTipsEngine (code-only).
  // Pour réactiver l'IA : décommenter le setInterval ci-dessous.
  // adviceTimer = setInterval(async () => {
  //   if (!isInGame || !currentGameData) return
  //   await generateAdvice(currentGameData)
  // }, 15_000)
}

export function stopAICoachAgent(): void {
  if (adviceTimer) {
    clearInterval(adviceTimer)
    adviceTimer = null
  }
  console.log('[AICoachAgent] Arrêté.')
}
