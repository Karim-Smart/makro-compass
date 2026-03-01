import axios from 'axios'
import https from 'https'
import tls from 'tls'
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { IPC } from '../../shared/ipc-channels'
import { POLL_INTERVAL_MS } from '../../shared/constants'
import type { GameData, GameStatus } from '../../shared/types'
import { broadcastToWindows } from '../main/ipcHandlers'
import { showOverlay, hideOverlay } from '../main/windowManager'
import { onGameStart, onGameEnd, updateGameData, getCoachingStyle } from './aiCoachAgent'
import { registerObjectiveKill, setGameStartTime, resetTimers } from './timerAgent'
import { generateMacroTip, trackObjectiveKill, resetMacroEngine } from './macroTipsEngine'
import { detectAlerts, resetAlertEngine } from './alertEngine'
import { generateBuildRecommendations } from './buildEngine'
import { generateRunePages } from '../../shared/rune-data'
import { getLastQueueType, detectCurrentQueueType } from './lcuAgent'
import { saveRankedGame } from './quotaManager'

// ─── Configuration ────────────────────────────────────────────────────────────

function detectRiotHost(): string {
  if (process.env.RIOT_HOST) return process.env.RIOT_HOST

  const isWSL = existsSync('/proc/sys/fs/binfmt_misc/WSLInterop')
    || process.env.WSL_DISTRO_NAME != null

  if (!isWSL) return '127.0.0.1'

  try {
    const gateway = execSync("ip route show default | awk '{print $3}'", { encoding: 'utf-8' }).trim()
    if (gateway) {
      console.log(`[RiotAgent] WSL2 détecté — utilisation gateway Windows: ${gateway}`)
      return gateway
    }
  } catch {
    console.warn('[RiotAgent] Impossible de détecter la gateway WSL2, fallback 127.0.0.1')
  }
  return '127.0.0.1'
}

const RIOT_HOST = detectRiotHost()
const RIOT_URL  = `https://${RIOT_HOST}:2999/liveclientdata/allgamedata`

const riotHttpClient = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
    checkServerIdentity: () => undefined,
    keepAlive: true,
    maxSockets: 1,
    minVersion: 'TLSv1' as tls.SecureVersion,
    ciphers: 'ALL',
  }),
  timeout: 4000,
})

// ─── État interne ─────────────────────────────────────────────────────────────

let pollTimer: ReturnType<typeof setInterval> | null = null
let wasInGame = false
let lastProcessedEventId = -1
let consecutiveErrors = 0
const ERRORS_BEFORE_END = 3

// Throttle : ne pas broadcasté la même donnée à chaque poll
let lastBroadcastedTip = ''
let lastBroadcastedBuildKey = ''

// Résultat de fin de partie (détecté via GameEnd event)
let lastGameResult: 'win' | 'loss' | null = null
let lastGameData: GameData | null = null

// ─── Parsing enrichi ─────────────────────────────────────────────────────────

function parseGameData(raw: RiotApiResponse): GameData {
  const player = raw.activePlayer
  const events = raw.events?.Events ?? []
  const gameTime = raw.gameData?.gameTime ?? 0

  const summonerName = raw.activePlayer.summonerName ?? ''
  const riotId       = raw.activePlayer.riotId ?? ''

  const activePlayerData = raw.allPlayers?.find(
    (p) => p.summonerName === summonerName
        || p.riotId === summonerName
        || p.riotId === riotId
        || p.summonerName === riotId
  )

  const kills   = activePlayerData?.scores?.kills      ?? 0
  const deaths  = activePlayerData?.scores?.deaths     ?? 0
  const assists = activePlayerData?.scores?.assists    ?? 0
  const cs      = activePlayerData?.scores?.creepScore ?? 0
  const championName = activePlayerData?.championName || summonerName || 'Inconnu'

  const myTeam  = activePlayerData?.team ?? 'ORDER'
  const allies:  string[] = []
  const enemies: string[] = []
  let teamKills = 0
  let enemyKills = 0

  for (const p of raw.allPlayers ?? []) {
    const champ = p.championName ?? p.summonerName ?? ''
    if (!champ) continue
    if (p.team === myTeam) {
      if (champ !== championName) allies.push(champ)
      teamKills += p.scores?.kills ?? 0
    } else {
      enemies.push(champ)
      enemyKills += p.scores?.kills ?? 0
    }
  }

  // Items du joueur actif
  const items: string[] = (activePlayerData?.items ?? [])
    .map((item) => item.displayName)
    .filter((name) => name && name !== 'Stealth Ward')

  // Objectifs depuis les événements (avec tracking d'équipe)
  let allyDragons = 0
  let enemyDragons = 0
  let baronActive  = false
  let heraldActive = false
  let elderActive = false
  let allyTowers = 0
  let enemyTowers = 0

  for (const event of events) {
    const killerTeam = getKillerTeam(event.KillerName, myTeam, raw.allPlayers ?? [])

    switch (event.EventName) {
      case 'DragonKill':
        if (killerTeam === 'ally') allyDragons++
        else enemyDragons++
        break
      case 'BaronKill':
        if (killerTeam === 'ally') baronActive = true
        break
      case 'HeraldKill':
        if (killerTeam === 'ally') heraldActive = true
        break
      case 'TurretKilled':
        if (killerTeam === 'ally') enemyTowers++  // On détruit les tours ennemies
        else allyTowers++
        break
    }
  }

  // Elder dragon (4+ dragons d'une équipe)
  if (allyDragons >= 4) elderActive = true

  // Dragon soul type depuis le terrain
  const dragonSoul = raw.gameData?.mapTerrain ?? null

  // Matchup de lane — trouver l'adversaire par position
  const myPosition = activePlayerData?.position ?? ''
  const myLevel = player.level ?? activePlayerData?.level ?? 1
  let matchup: GameData['matchup'] = null

  if (myPosition && myPosition !== '' && myPosition !== 'Unknown') {
    const opponent = (raw.allPlayers ?? []).find(
      (p) => p.team !== myTeam && p.position === myPosition
    )
    if (opponent) {
      const oppLevel = opponent.level ?? 1
      matchup = {
        champion: opponent.championName ?? opponent.summonerName ?? '?',
        level: oppLevel,
        levelDiff: myLevel - oppLevel,
        position: myPosition,
        isDead: opponent.isDead ?? false,
        respawnTimer: opponent.respawnTimer ?? 0,
      }
    }
  }

  return {
    isInGame: true,
    champion: championName,
    level:    myLevel,
    kda:      { kills, deaths, assists },
    cs,
    gold:     player.currentGold ?? 0,
    gameTime,
    teamGold:   0,
    enemyGold:  0,
    objectives: {
      dragonStacks: Math.min(allyDragons, 4),
      enemyDragonStacks: Math.min(enemyDragons, 4),
      baronActive,
      heraldActive,
      dragonSoul,
      elderActive,
    },
    towers: {
      allyDestroyed: allyTowers,
      enemyDestroyed: enemyTowers,
    },
    items,
    teamKills,
    enemyKills,
    allies,
    enemies,
    wardScore: activePlayerData?.scores?.wardScore ?? 0,
    gameMode: raw.gameData?.gameMode ?? 'CLASSIC',
    matchup,
  }
}

/** Détermine si le tueur est un allié ou un ennemi */
function getKillerTeam(
  killerName: string | undefined,
  myTeam: string,
  allPlayers: RiotApiResponse['allPlayers'] & Array<unknown>
): 'ally' | 'enemy' {
  if (!killerName) return 'ally' // défaut
  const player = (allPlayers as Array<{ summonerName: string; championName?: string; team?: string }>)
    .find((p) => p.summonerName === killerName || p.championName === killerName)
  if (!player) return 'ally'
  return player.team === myTeam ? 'ally' : 'enemy'
}

function processNewEvents(events: RiotApiResponse['events'], gameData: GameData): void {
  if (!events?.Events) return

  for (const event of events.Events) {
    if (event.EventID <= lastProcessedEventId) continue
    lastProcessedEventId = event.EventID

    const eventTime = event.EventTime ?? gameData.gameTime

    switch (event.EventName) {
      case 'DragonKill':
        registerObjectiveKill('dragon', gameData.gameTime)
        trackObjectiveKill('dragon', eventTime)
        break
      case 'BaronKill':
        registerObjectiveKill('baron', gameData.gameTime)
        trackObjectiveKill('baron', eventTime)
        break
      case 'HeraldKill':
        registerObjectiveKill('herald', gameData.gameTime)
        trackObjectiveKill('herald', eventTime)
        break
      case 'GameEnd':
        lastGameResult = event.Result === 'Win' ? 'win' : 'loss'
        console.log(`[RiotAgent] GameEnd détecté — résultat: ${lastGameResult}`)
        break
    }
  }
}

// ─── Polling ──────────────────────────────────────────────────────────────────

async function poll(): Promise<void> {
  try {
    const response = await riotHttpClient.get<RiotApiResponse>(RIOT_URL)
    const raw = response.data

    if (consecutiveErrors > 0) {
      console.log(`[RiotAgent] Connexion rétablie après ${consecutiveErrors} erreur(s)`)
    }
    consecutiveErrors = 0

    const gameData = parseGameData(raw)

    if (!wasInGame) {
      wasInGame = true
      lastProcessedEventId = -1
      lastBroadcastedTip = ''
      lastBroadcastedBuildKey = ''
      resetMacroEngine()
      resetAlertEngine()
      const startTimestamp = Date.now() - gameData.gameTime * 1000
      setGameStartTime(startTimestamp)

      const status: GameStatus = {
        isInGame: true,
        champion: gameData.champion,
        gameTime: gameData.gameTime,
      }
      broadcastToWindows(IPC.GAME_STATUS, status)
      showOverlay()
      onGameStart(gameData)

      // Broadcast runes au début de partie
      const style = getCoachingStyle()
      const runePages = generateRunePages(gameData.champion, style)
      broadcastToWindows(IPC.OVERLAY_RUNES, runePages)

      // Détecter le type de queue (ranked ?) via LCU
      detectCurrentQueueType()

      console.log(`[RiotAgent] Partie détectée — ${gameData.champion} (${gameData.gameMode})`)
    }

    processNewEvents(raw.events, gameData)
    updateGameData(gameData)
    broadcastToWindows(IPC.GAME_DATA, gameData)

    // Garder les dernières gameData pour sauvegarde ranked en fin de partie
    lastGameData = gameData

    // Stocker les dernières gameData pour le refresh build
    ;(global as typeof global & { __lastGameData?: GameData }).__lastGameData = gameData

    // Broadcast build recommendations (seulement si le profil change)
    const currentStyleForBuild = getCoachingStyle()
    const buildRec = generateBuildRecommendations(gameData, currentStyleForBuild)
    const buildKey = `${buildRec.enemyProfile.dominantType}-${buildRec.gamePhase}-${buildRec.style}-${gameData.items.length}`
    if (buildKey !== lastBroadcastedBuildKey) {
      broadcastToWindows(IPC.OVERLAY_BUILD, buildRec)
      lastBroadcastedBuildKey = buildKey
    }

    // Détecter et broadcaster les alertes courtes (3s)
    const alerts = detectAlerts(gameData)
    for (const alert of alerts) {
      broadcastToWindows(IPC.OVERLAY_SHOW_ALERT, alert)
      console.log(`[AlertEngine] ${alert.type}: ${alert.text}`)
    }

    // Générer et broadcaster le macro tip (seulement si le texte change)
    const currentStyle = getCoachingStyle()
    const tip = generateMacroTip(gameData, currentStyle)
    if (tip.text !== lastBroadcastedTip) {
      lastBroadcastedTip = tip.text
      broadcastToWindows(IPC.OVERLAY_SHOW_ADVICE, {
        text: tip.text,
        style: currentStyle,
        priority: tip.priority,
        timestamp: Date.now(),
        gameTime: gameData.gameTime,
      })
    }

  } catch (error) {
    if (!axios.isAxiosError(error)) {
      console.warn('[RiotAgent] Erreur inattendue:', (error as Error).message)
      return
    }

    const code = error.code ?? ''
    const status = error.response?.status ?? 0
    const isExpectedError = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'].includes(code)
      || status >= 400

    if (!isExpectedError) {
      console.warn('[RiotAgent] Erreur poll inattendue:', error.message, `(code: ${code})`)
      return
    }

    if (process.env.NODE_ENV !== 'production') {
      const detail = status ? `HTTP ${status}` : code
      console.debug(`[RiotAgent] Poll: ${detail} (wasInGame=${wasInGame}, errors=${consecutiveErrors + 1})`)
    }

    consecutiveErrors++

    if (wasInGame && consecutiveErrors >= ERRORS_BEFORE_END) {
      // Sauvegarder la partie ranked si applicable
      const queueType = getLastQueueType()
      if (queueType && lastGameData) {
        const result = lastGameResult ?? (lastGameData.teamKills > lastGameData.enemyKills ? 'win' : 'loss')
        saveRankedGame(lastGameData, queueType, result)
        console.log(`[RiotAgent] Partie classée sauvegardée — ${lastGameData.champion} ${result} (${queueType})`)
      }

      wasInGame = false
      lastProcessedEventId = -1
      consecutiveErrors = 0
      lastBroadcastedTip = ''
      lastBroadcastedBuildKey = ''
      lastGameResult = null
      lastGameData = null
      const status: GameStatus = { isInGame: false }
      broadcastToWindows(IPC.GAME_STATUS, status)
      hideOverlay()
      onGameEnd()
      resetTimers()
      resetMacroEngine()
      resetAlertEngine()
      console.log('[RiotAgent] Fin de partie détectée.')
    }
  }
}

export async function startRiotAgent(): Promise<void> {
  console.log(`[RiotAgent] Démarrage — polling ${RIOT_HOST}:2999 toutes les ${POLL_INTERVAL_MS / 1000}s`)
  await poll()
  pollTimer = setInterval(poll, POLL_INTERVAL_MS)
}

export function stopRiotAgent(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
    console.log('[RiotAgent] Arrêté.')
  }
}

// ─── Types Riot API ───────────────────────────────────────────────────────────

interface RiotApiResponse {
  activePlayer: {
    summonerName?: string
    riotId?: string
    level?: number
    currentGold?: number
    championStats: {
      currentHealth?: number
      maxHealth?: number
      armor?: number
      magicResist?: number
      attackDamage?: number
      abilityPower?: number
      attackSpeed?: number
      moveSpeed?: number
    }
    abilities?: {
      Q?: { abilityLevel?: number; displayName?: string }
      W?: { abilityLevel?: number; displayName?: string }
      E?: { abilityLevel?: number; displayName?: string }
      R?: { abilityLevel?: number; displayName?: string }
    }
  }
  allPlayers?: Array<{
    summonerName: string
    riotId?: string
    championName?: string
    team?: string
    level?: number
    position?: string    // TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY
    isDead?: boolean
    respawnTimer?: number
    scores?: {
      kills: number
      deaths: number
      assists: number
      creepScore: number
      wardScore?: number
    }
    items?: Array<{
      displayName: string
      itemID: number
    }>
    summonerSpells?: {
      summonerSpellOne?: { displayName?: string }
      summonerSpellTwo?: { displayName?: string }
    }
  }>
  gameData?: {
    gameTime: number
    gameMode: string
    mapTerrain?: string
  }
  events?: {
    Events: Array<{
      EventName: string
      EventID: number
      EventTime?: number     // game time en secondes
      KillerName?: string
      TurretKilled?: string
      DragonType?: string    // Fire, Water, Earth, Air, Hextech, Chemtech, Elder
      Result?: string        // Win ou Lose (GameEnd event)
    }>
  }
}
