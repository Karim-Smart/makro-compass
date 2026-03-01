import { IPC } from '../../shared/ipc-channels'
import { COACHING_STYLES, QUOTA_RULES, DEV_MOCK_AI } from '../../shared/constants'
import type { CoachAdvice, CoachingStyle, GameData, SubscriptionTier } from '../../shared/types'
import { broadcastToWindows } from '../main/ipcHandlers'
import { getQuotaStatus, incrementQuota, logAdvice } from './quotaManager'
import { getSubscriptionStatus } from './subscriptionAgent'
import { getAnthropicClient as getSharedClient } from './anthropicClient'

// ─── État interne ─────────────────────────────────────────────────────────────

let currentStyle: CoachingStyle = 'LCK'
let lastAdviceTime: number | null = null
let isInGame = false
let currentGameData: GameData | null = null
let adviceTimer: ReturnType<typeof setInterval> | null = null

// ── Shotcaller + Custom Coach (Elite) ─────────────────────────────────────────
let shotcallerMode = false
let customCoachTone = ''

// Compteur incrémental pour varier les mocks (pas juste gameTime)
let mockAdviceCounter = 0

/**
 * Met à jour la clé API Anthropic (appelé depuis les settings utilisateur).
 * Délègue au client partagé via anthropicClient.ts.
 */
export function setApiKey(_apiKey: string): void {
  // La propagation se fait via setAnthropicApiKey() dans anthropicClient.ts
  // Cette fonction existe pour compatibilité avec ipcHandlers
  console.log('[AICoachAgent] Clé API mise à jour via client partagé.')
}

// ─── Gestion du style ─────────────────────────────────────────────────────────

export function setCoachingStyle(style: CoachingStyle): void {
  currentStyle = style
  console.log(`[AICoachAgent] Style changé → ${style}`)
}

export function getCoachingStyle(): CoachingStyle {
  return currentStyle
}

export function setShotcallerMode(enabled: boolean): void {
  shotcallerMode = enabled
  console.log(`[AICoachAgent] Shotcaller mode: ${enabled ? 'ON' : 'OFF'}`)
}

export function setCustomCoachTone(tone: string): void {
  customCoachTone = tone.trim()
  console.log(`[AICoachAgent] Custom tone: "${customCoachTone || '(défaut)'}"`)
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
  const { kda, cs, gold, gameTime, level, objectives, allies, enemies, gameMode, items, towers, teamKills, enemyKills, matchup, wardScore } = gameData
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

  const matchupLines = matchup
    ? `Adversaire direct : ${matchup.champion} (niv ${matchup.level}, diff ${matchup.levelDiff > 0 ? '+' : ''}${matchup.levelDiff})
  → KDA ${matchup.oppKda.kills}/${matchup.oppKda.deaths}/${matchup.oppKda.assists} | CS ${matchup.oppCs}
  → ${matchup.isDead ? `MORT — revient dans ${Math.round(matchup.respawnTimer)}s` : 'En vie'}`
    : ''

  const objectiveContext = objectiveTrigger
    ? `\n⚠️ ÉVÉNEMENT : ${objectiveTrigger} vient d'être tué. Donne un conseil macro immédiat : que faire MAINTENANT avec cet avantage/désavantage ?`
    : ''

  // Draft context : dans les premières minutes, analyser la comp
  const hasDraft = allies.length > 0 && enemies.length > 0
  const draftContext = gameTime < 180 && hasDraft
    ? `\n🎯 DRAFT CONNUE : Commence ta réponse par "[DRAFT : ${allyList} vs ${enemyList}]" puis donne la win condition de ton équipe (teamfight, split, pick, poke...) et comment jouer l'early en conséquence.`
    : gameTime < 180 && !hasDraft
      ? `\n⚠️ DRAFT INCONNUE : Les compositions ne sont pas encore visibles. Commence ta réponse par "[DRAFT INCONNUE]" puis donne un conseil early game générique adapté au champion.`
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
Ward score : ${wardScore}
${matchupLines}
${objectiveContext}${draftContext}
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

// ─── Mock : conseils pré-générés par style et phase de jeu ─────────────────

const MOCK_ADVICE: Record<CoachingStyle, Record<string, string[]>> = {
  LCK: {
    early: [
      'Concentre-toi sur le CS et le contrôle de vague. Slow push 3 vagues puis crash sous tour pour un recall gratuit.',
      'Place un ward tribush à 2:45 pour track le jungler. Priorise la vision sur les trades.',
      'Le Herald spawn bientôt — push ta lane et prépare une rotation pour aider ton jungler.',
    ],
    mid: [
      'Groupe pour le prochain objectif. Place une deep ward 30s avant le spawn de Drake.',
      'Ta lane est push — fais une rotation mid pour créer de la pression numérique sur la tour.',
      'L\'ennemi a 2 drakes. Priorise la vision autour du pit et force le prochain contest.',
    ],
    late: [
      'Ne fight pas sans objectif à prendre. Baron est la win condition avec ton avantage de tours.',
      'Gère les vagues latérales avant de grouper. Un split push forcerait l\'ennemi à réagir.',
      'Un pick sur leur carry suffirait pour forcer Baron. Contrôle les bushes autour du pit.',
    ],
  },
  LEC: {
    early: [
      'Ton mid a la prio — profites-en pour un roam bot. Un kill early snowball toute la partie.',
      'Push agressif pour les plates avant 14 min. L\'or des plaques fait la différence.',
      'Herald est contestable — ping ton jungler et fais un 2v2 sur le crab.',
    ],
    mid: [
      'Tu es ahead de 2 kills — convertis en tour puis dragon. Ne laisse pas l\'avantage refroidir.',
      'Leur jungler est bot — envahis la jungle haute. Vole les camps et place des wards deep.',
      'Drake vs Herald trade : prends Herald si tu peux T1 mid avec. Ça ouvre toute la map.',
    ],
    late: [
      'Start Baron → stop → fight quand ils check → reprends Baron. Le classique appât EU.',
      'Un ace sans objectif = gaspillé. Push une lane puis force Baron dans les 30 prochaines secondes.',
      'Leur carry farm seul bot — catch lui et c\'est Baron free. Go group immédiatement.',
    ],
  },
  LCS: {
    early: [
      'Joue safe et farm. Track le jungler ennemi — s\'il gank top, Drake est libre pour ton équipe.',
      'Aide ton jungler pour le scuttle contest à 3:15. La pression mid décide du premier 2v2.',
      'Farm les canons, trade quand ton sort est up, ne force pas les all-in risqués.',
    ],
    mid: [
      'Regroupe 4-5 pour le prochain Drake. Place 2 wards dans la rivière avant de contester.',
      'Ne split pas seul sans vision. Groupe avec ton équipe pour forcer un teamfight autour de l\'objectif.',
      'Baron setup : vérifie que toutes les ults de ton équipe sont prêtes avant d\'engager.',
    ],
    late: [
      'Le teamfight décide tout. Positionne-toi derrière ton frontline et peel le carry.',
      'Attends les CDs clés (Flash + Ult) avant d\'engager. Un mauvais fight = game over.',
      'Groupe mid avec Baron buff. Ne vous séparez pas — push en équipe pour finir.',
    ],
  },
  LPL: {
    early: [
      'Dive sous tour maintenant ! L\'adversaire est low HP et ton jungler est à portée. Force le Flash.',
      'Invade leur buff level 1. Ta comp est plus forte en 2v2 early. Force les fights !',
      'Ne farm pas, HUNT. L\'ennemi est alone top sans wards — c\'est un kill gratuit, fonce.',
    ],
    mid: [
      'Tu es ahead de 3 kills — envahis leur jungle ! Vole camps, place wards offensives, étouffe-les.',
      'Kill → Tour → Drake en chaîne SANS reset. Le tempo agressif ne leur laisse aucun répit.',
      'Force un fight dans leur jungle. Tu gagnes le 5v5 avec ton avantage — ne les laisse pas scaler.',
    ],
    late: [
      'Baron MAINTENANT. Même si c\'est un 50/50, ça force l\'ennemi à réagir dans ta zone.',
      'Leur ADC farm bot seul — catch + Baron instant. Ne perds pas 1 seconde.',
      'Elder Dragon > tout. Force le fight immédiatement. Avec Elder, un seul combo tue.',
    ],
  },
}

// ─── Shotcaller Mode : ordres courts et directifs (Elite) ────────────────────

const SHOTCALLER_CALLS: Record<string, string[]> = {
  early: [
    'WARD RIVIÈRE — track jungler',
    'PUSH VAGUE → crash sous tour + back',
    'FREEZE — zone-le du CS',
    'HERALD BIENTÔT — push et rotate',
    'JOUE SAFE — jungler côté toi',
    'TRADE NIVEAU 2 — avantage XP',
    'SCUTTLE 3:15 — aide ton jungler',
  ],
  mid: [
    'GROUPE BOT — DRAKE DANS 30S',
    'SPLIT TOP — DRAKE 4v4',
    'BARON SETUP — wards côtés pit',
    'PUSH MID — TOUR AVANT RESET',
    'INVADE JUNGLE — jungler mort',
    'ROTATION BOT → TOUR + DRAKE',
    'VISION DEEP — prépare l\'objectif',
  ],
  late: [
    'BARON MAINTENANT — ILS SONT 4',
    'ELDER → TOUT LE MONDE BOT',
    'CATCH ADC → BARON DIRECT',
    'SPLIT + BARON — pression 2 côtés',
    'RECULEZ — ATTENDEZ LES ULTS',
    'NASH FREE — 2 ENNEMIS MORTS',
    'PUSH 2 LANES — NE GROUPEZ PAS MID',
  ],
  behind: [
    'FARM SOUS TOUR — PAS DE FIGHT',
    'VISION DÉFENSIVE — notre jungle',
    'ATTENDEZ LEUR ERREUR — pas de force',
    'CONCÉDEZ DRAKE — prenez tour',
    'TURTLE — scale pour le late',
  ],
  ahead: [
    'ENVAHIS JUNGLE — ÉTOUFFE-LES',
    'FORCE L\'OBJECTIF — no contest',
    'DIVE — SUPÉRIORITÉ NUMÉRIQUE',
    'DENY CAMPS + DEEP WARDS',
    'FERME LE GAME — objectif en chaîne',
  ],
}

const SHOTCALLER_SYSTEM_PROMPT = `Tu es un shotcaller de LoL compétitif. Donne UN SEUL ordre court et directif.

RÈGLES :
- Maximum 8 mots
- Style : appel micro en jeu (comme Discord en compétition)
- Commence par un verbe d'action ou un objectif en MAJUSCULES
- Pas d'explication, juste L'ORDRE
- Langue : français

EXEMPLES :
"BARON MAINTENANT — ILS SONT 4"
"GROUPE BOT POUR DRAKE"
"SPLIT TOP, PRESSURE NASH"
"RECULEZ — PAS DE FIGHT SANS ULTS"
"PUSH MID + INVADE APRÈS"
"WARD PIT — DRAKE DANS 40S"`

function generateShotcallerCall(gameData: GameData, objectiveTrigger?: string): string {
  if (objectiveTrigger) {
    const killDiff = gameData.teamKills - gameData.enemyKills
    if (killDiff > 0) return `${objectiveTrigger.toUpperCase()} DOWN — PUSH MAINTENANT`
    return `${objectiveTrigger.toUpperCase()} PERDU — RECULEZ ET FARM`
  }

  const killDiff = gameData.teamKills - gameData.enemyKills

  // Contexte prioritaire
  if (gameData.objectives.baronActive) return 'PUSH 2 LANES AVEC BARON — NE SÉPAREZ PAS'
  if (gameData.objectives.elderActive) return 'FORCE LE FIGHT — ELDER ACTIF'
  if (killDiff <= -8) {
    const pool = SHOTCALLER_CALLS.behind
    mockAdviceCounter++
    return pool[mockAdviceCounter % pool.length]
  }
  if (killDiff >= 6) {
    const pool = SHOTCALLER_CALLS.ahead
    mockAdviceCounter++
    return pool[mockAdviceCounter % pool.length]
  }
  if (gameData.objectives.dragonStacks >= 3) return 'DRAKE SOUL — TOUT LE MONDE BOT MAINTENANT'
  if (gameData.objectives.enemyDragonStacks >= 3) return 'CONTEST DRAKE — ILS ONT SOUL POINT'

  // Phase-based
  const phase = gameData.gameTime < 840 ? 'early' : gameData.gameTime < 1500 ? 'mid' : 'late'
  const pool = SHOTCALLER_CALLS[phase]
  mockAdviceCounter++
  return pool[mockAdviceCounter % pool.length]
}

// Premiers conseils contextuels draft (< 3 min)
const DRAFT_FIRST_ADVICE: Record<CoachingStyle, string[]> = {
  LCK: [
    'Draft analysée : priorise le farm et le contrôle de vague. Ta comp scale mieux en late — ne force pas les fights early.',
    'Composition évaluée : focus la vision et les objectifs neutres. Slow push + crash pour générer un avantage progressif.',
  ],
  LEC: [
    'Draft analysée : ta comp a du potentiel de snowball. Cherche un roam ou un trade agressif pour prendre l\'avantage tôt.',
    'Composition évaluée : tu as du pick potentiel. Place des wards offensives et cherche les catches en transition.',
  ],
  LCS: [
    'Draft analysée : ta comp excelle en teamfight groupé. Farm clean et regroupe-toi pour les objectifs dès le mid game.',
    'Composition évaluée : votre frontline est solide. Jouez autour des objectifs neutres et protégez vos carries.',
  ],
  LPL: [
    'Draft analysée : ta comp est plus forte en 2v2 et skirmish. Force les invades et les fights dans la jungle ennemie.',
    'Composition évaluée : avantage en burst et engage. Dive sous tour dès qu\'un ennemi est low — pas de pitié.',
  ],
}

function generateMockAdvice(gameData: GameData, objectiveTrigger?: string): string {
  // Mode Shotcaller : ordres ultra-courts
  if (shotcallerMode) {
    return generateShotcallerCall(gameData, objectiveTrigger)
  }

  const phase = gameData.gameTime < 840 ? 'early' : gameData.gameTime < 1500 ? 'mid' : 'late'
  const tips = MOCK_ADVICE[currentStyle][phase]

  // Si objectif tué, conseil contextuel
  if (objectiveTrigger) {
    const killDiff = gameData.teamKills - gameData.enemyKills
    if (killDiff > 0) {
      return `${objectiveTrigger} tué ! Capitalise immédiatement — push une lane et force le prochain objectif.`
    }
    return `${objectiveTrigger} perdu. Regroupe-toi et sécurise la vision pour contester le prochain.`
  }

  // Premier conseil avec info draft (< 3 min)
  if (gameData.gameTime < 180) {
    const hasDraft = gameData.allies.length > 0 && gameData.enemies.length > 0
    if (hasDraft) {
      const allyStr = gameData.allies.join(', ')
      const enemyStr = gameData.enemies.join(', ')
      const draftTips = DRAFT_FIRST_ADVICE[currentStyle]
      mockAdviceCounter++
      const tip = draftTips[mockAdviceCounter % draftTips.length]
      return `[DRAFT : ${allyStr} vs ${enemyStr}] ${tip}`
    } else {
      return `[DRAFT INCONNUE] Pas de données de composition disponibles. Conseil générique : focus le CS et la vision en attendant plus d'infos sur les comps.`
    }
  }

  // Compteur incrémental pour varier entre appels (pas juste gameTime)
  mockAdviceCounter++
  return tips[mockAdviceCounter % tips.length]
}

/**
 * Génère un conseil IA via Claude Haiku (ou mock en dev) et l'envoie aux renderers.
 */
async function generateAdvice(gameData: GameData, objectiveTrigger?: string): Promise<void> {
  const styleConfig = COACHING_STYLES[currentStyle]

  try {
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

    console.log(`[AICoachAgent] Génération conseil (style: ${currentStyle}, tier: ${tier}, mock: ${DEV_MOCK_AI})`)

    let adviceText: string

    if (DEV_MOCK_AI) {
      // ── Mode mock : pas d'appel API, conseils pré-générés ────────────
      adviceText = generateMockAdvice(gameData, objectiveTrigger)
    } else {
      // ── Mode réel : appel Claude Haiku ─────────────────────────────
      const client = getSharedClient()
      if (!client) {
        console.warn('[AICoachAgent] Pas de client Anthropic configuré — conseil ignoré.')
        return
      }

      // Choisir le system prompt selon le mode
      let systemPrompt: string
      if (shotcallerMode) {
        systemPrompt = SHOTCALLER_SYSTEM_PROMPT
      } else {
        systemPrompt = styleConfig.systemPrompt
        // Injecter le ton custom si défini (Elite)
        if (customCoachTone) {
          systemPrompt += `\n\nPERSONNALITÉ : Tu adoptes un ton ${customCoachTone}. Adapte ton langage et ta façon de formuler les conseils à cette personnalité, tout en gardant le contenu macro pertinent.`
        }
      }

      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: shotcallerMode ? 40 : 150,
        system: systemPrompt,
        messages: [
          { role: 'user', content: buildUserPrompt(gameData, objectiveTrigger) }
        ]
      })

      const textContent = message.content.find((c) => c.type === 'text')
      if (!textContent || textContent.type !== 'text') return
      adviceText = textContent.text.trim()
    }

    // Priorité dynamique basée sur le contexte
    const priority = determinePriority(gameData, objectiveTrigger)

    // Catégorie automatique
    let category: string | undefined
    if (objectiveTrigger) {
      const lower = objectiveTrigger.toLowerCase()
      if (lower.includes('baron')) category = 'baron'
      else if (lower.includes('dragon') || lower.includes('drake') || lower.includes('elder')) category = 'dragon'
      else if (lower.includes('héraut') || lower.includes('herald')) category = 'herald'
      else if (lower.includes('tour') || lower.includes('tower')) category = 'tower'
      else category = 'objective'
    } else if (shotcallerMode) {
      category = 'shotcaller'
    } else {
      const phase = gameData.gameTime < 840 ? 'early' : gameData.gameTime < 1500 ? 'mid' : 'late'
      category = `macro-${phase}`
    }

    const advice: CoachAdvice = {
      text: adviceText,
      style: currentStyle,
      priority,
      timestamp: Date.now(),
      gameTime: gameData.gameTime,
      category,
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
  console.log('[AICoachAgent] Démarrage — conseils IA toutes les 15s (soumis au cooldown 45s).')
  // Timer rapide (15s) mais canGenerateAdvice() applique le cooldown réel (45s free, 90s pro).
  // macroTipsEngine couvre uniquement les alertes critiques (priority === 'high').
  adviceTimer = setInterval(async () => {
    if (!isInGame || !currentGameData) return
    await generateAdvice(currentGameData)
  }, 15_000)
}

export function stopAICoachAgent(): void {
  if (adviceTimer) {
    clearInterval(adviceTimer)
    adviceTimer = null
  }
  console.log('[AICoachAgent] Arrêté.')
}
