/**
 * Agent de connexion au League Client (LCU API).
 * Détecte le champion select et broadcast les picks en temps réel.
 */

import axios from 'axios'
import https from 'https'
import { readFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import { IPC } from '../../shared/ipc-channels'
import type { DraftState, DraftPick, FullRunePage } from '../../shared/types'
import { broadcastToWindows } from '../main/ipcHandlers'
import { generateRunePages } from '../../shared/rune-data'
import { getCoachingStyle } from './aiCoachAgent'
import { saveRankedGameDirect } from './quotaManager'
import type { RankedQueueType } from '../../shared/types'

// ─── Configuration ──────────────────────────────────────────────────────────

const LCU_POLL_MS = 3000  // Poll toutes les 3s

const lcuHttpClient = axios.create({
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  timeout: 3000,
})

// ─── État interne ───────────────────────────────────────────────────────────

let retryTimer: ReturnType<typeof setInterval> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let lcuPort: number | null = null
let lcuPassword: string | null = null
let lcuHost = '127.0.0.1'
let championMap: Record<number, string> = {}  // id → name
let wasInChampSelect = false
let connectionAttempts = 0
let lastAutoImportChampion = ''
let lastDetectedQueueId: number | null = null
let isReplayMode = false
let gameflowPollTimer: ReturnType<typeof setInterval> | null = null
let hasImportedGames = false  // évite de ré-importer à chaque reconnexion

function detectLcuHost(): string {
  // Si Electron tourne sur Windows (même lancé depuis WSL2), utiliser localhost
  if (process.platform === 'win32') return '127.0.0.1'

  // Si on est vraiment dans un process Linux (WSL2 natif), utiliser la gateway
  const isWSL = existsSync('/proc/sys/fs/binfmt_misc/WSLInterop')
    || process.env.WSL_DISTRO_NAME != null

  if (!isWSL) return '127.0.0.1'

  try {
    const gateway = execSync("ip route show default | awk '{print $3}'", { encoding: 'utf-8' }).trim()
    if (gateway) {
      console.log(`[LCUAgent] WSL2 détecté — essai gateway Windows: ${gateway}`)
      return gateway
    }
  } catch { /* fallback */ }
  return '127.0.0.1'
}

// ─── Recherche du lockfile ──────────────────────────────────────────────────

function findLockfile(): string | null {
  // Chemins communs d'installation de LoL
  const paths = [
    '/mnt/c/Riot Games/League of Legends/lockfile',
    '/mnt/d/Riot Games/League of Legends/lockfile',
    '/mnt/c/Program Files/Riot Games/League of Legends/lockfile',
    '/mnt/c/Games/League of Legends/lockfile',
    'C:\\Riot Games\\League of Legends\\lockfile',
    'D:\\Riot Games\\League of Legends\\lockfile',
  ]

  for (const p of paths) {
    if (existsSync(p)) return p
  }

  // Tentative via le processus Windows (WSL2)
  try {
    const cmd = 'cmd.exe /c "wmic process where name=\'LeagueClientUx.exe\' get commandline /format:list" 2>nul'
    const output = execSync(cmd, { encoding: 'utf-8', timeout: 5000 })
    const portMatch = output.match(/--app-port=(\d+)/)
    const tokenMatch = output.match(/--remoting-auth-token=([\w-]+)/)
    if (portMatch && tokenMatch) {
      lcuPort = parseInt(portMatch[1], 10)
      lcuPassword = tokenMatch[1]
      console.log(`[LCUAgent] Trouvé via process: port=${lcuPort}`)
      return '__process__'
    }
  } catch { /* silencieux */ }

  return null
}

function parseLockfile(path: string): boolean {
  if (path === '__process__') return lcuPort !== null

  try {
    const content = readFileSync(path, 'utf-8').trim()
    const parts = content.split(':')
    if (parts.length < 5) return false
    // Format: name:pid:port:password:protocol
    lcuPort = parseInt(parts[2], 10)
    lcuPassword = parts[3]
    return true
  } catch {
    return false
  }
}

// ─── Connexion LCU ─────────────────────────────────────────────────────────

function getLcuUrl(endpoint: string): string {
  return `https://${lcuHost}:${lcuPort}${endpoint}`
}

function getLcuHeaders(): Record<string, string> {
  const auth = Buffer.from(`riot:${lcuPassword}`).toString('base64')
  return { Authorization: `Basic ${auth}` }
}

async function fetchChampionMap(): Promise<void> {
  // 1. Essai rapide via LCU (5s max — le fichier peut être lent via WSL2)
  try {
    const resp = await lcuHttpClient.get(
      getLcuUrl('/lol-game-data/assets/v1/champion-summary.json'),
      { headers: getLcuHeaders(), timeout: 5_000 },
    )
    const data = resp.data as Array<{ id: number; name: string }>
    championMap = {}
    for (const champ of data) {
      if (champ.id > 0) championMap[champ.id] = champ.name
    }
    console.log(`[LCUAgent] ${Object.keys(championMap).length} champions chargés (LCU)`)
    return
  } catch {
    console.warn('[LCUAgent] Champion map LCU lente/indisponible — fallback DDragon CDN')
  }

  // 2. Fallback DDragon CDN (internet direct, sans le bridge WSL2→Windows)
  try {
    const versionsResp = await axios.get<string[]>(
      'https://ddragon.leagueoflegends.com/api/versions.json',
      { timeout: 5_000 },
    )
    const latestVersion = versionsResp.data[0]

    const champResp = await axios.get<{ data: Record<string, { key: string; name: string }> }>(
      `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/champion.json`,
      { timeout: 10_000 },
    )
    championMap = {}
    for (const champ of Object.values(champResp.data.data)) {
      const id = parseInt(champ.key, 10)
      if (id > 0) championMap[id] = champ.name
    }
    console.log(`[LCUAgent] ${Object.keys(championMap).length} champions chargés (DDragon ${latestVersion})`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[LCUAgent] Impossible de charger la map des champions: ${msg}`)
  }
}

// ─── Export de page de runes vers le client LoL ─────────────────────────────

export async function exportRunePageToClient(page: FullRunePage): Promise<boolean> {
  if (!lcuPort || !lcuPassword) {
    console.warn('[LCUAgent] Impossible d\'importer les runes — client non connecté')
    return false
  }

  try {
    // Récupérer les pages existantes pour trouver l'ID de la page courante
    const pagesResp = await lcuHttpClient.get(
      getLcuUrl('/lol-perks/v1/pages'),
      { headers: getLcuHeaders() },
    )
    const pages = pagesResp.data as Array<{ id: number; isDeletable: boolean; current: boolean }>
    const currentPage = pages.find(p => p.current && p.isDeletable)

    // Si une page éditable est courante, la supprimer d'abord
    if (currentPage) {
      await lcuHttpClient.delete(
        getLcuUrl(`/lol-perks/v1/pages/${currentPage.id}`),
        { headers: getLcuHeaders() },
      )
    }

    // Créer la nouvelle page
    await lcuHttpClient.post(
      getLcuUrl('/lol-perks/v1/pages'),
      {
        name: page.name,
        primaryStyleId: page.primaryTreeId,
        subStyleId: page.subTreeId,
        selectedPerkIds: page.selectedPerkIds,
        current: true,
      },
      { headers: { ...getLcuHeaders(), 'Content-Type': 'application/json' } },
    )

    console.log(`[LCUAgent] Page de runes importée: ${page.name}`)
    return true
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[LCUAgent] Erreur import runes: ${msg}`)
    return false
  }
}

export function isLcuConnected(): boolean {
  return lcuPort !== null && lcuPassword !== null
}

/**
 * Retourne le type de queue de la dernière partie détectée.
 * null si pas ranked, 'RANKED_SOLO' ou 'RANKED_FLEX'.
 */
export function getLastQueueType(): import('../../shared/types').RankedQueueType | null {
  // Queue 420 = Solo/Duo, Queue 440 = Flex
  if (lastDetectedQueueId === 420) return 'RANKED_SOLO'
  if (lastDetectedQueueId === 440) return 'RANKED_FLEX'
  return null
}

/**
 * Interroge le LCU pour détecter le type de queue de la partie en cours.
 */
export async function detectCurrentQueueType(): Promise<void> {
  if (!lcuPort || !lcuPassword) return

  try {
    const resp = await lcuHttpClient.get(
      getLcuUrl('/lol-gameflow/v1/session'),
      { headers: getLcuHeaders() },
    )
    const data = resp.data as { gameData?: { queue?: { id?: number } } }
    const queueId = data?.gameData?.queue?.id ?? null
    lastDetectedQueueId = queueId
    if (queueId) {
      console.log(`[LCUAgent] Queue détectée: ${queueId} (${queueId === 420 ? 'Solo/Duo' : queueId === 440 ? 'Flex' : 'Autre'})`)
    }
  } catch {
    // Pas en gameflow, on ignore
  }
}

// ─── Replay mode detection ──────────────────────────────────────────────────

/**
 * Retourne true si le client LoL est en mode replay (WatchInProgress).
 */
export function isInReplayMode(): boolean {
  return isReplayMode
}

/**
 * Lancer un replay via LCU API.
 */
export async function launchReplay(gameId: number): Promise<boolean> {
  if (!lcuPort || !lcuPassword) {
    console.warn('[LCUAgent] Impossible de lancer le replay — client non connecté')
    return false
  }

  try {
    await lcuHttpClient.post(
      getLcuUrl(`/lol-replays/v1/rofls/${gameId}/watch`),
      {},
      { headers: { ...getLcuHeaders(), 'Content-Type': 'application/json' } },
    )
    console.log(`[LCUAgent] Replay lancé pour gameId=${gameId}`)
    return true
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[LCUAgent] Erreur lancement replay: ${msg}`)
    return false
  }
}

/**
 * Poll le gameflow pour détecter le mode replay (WatchInProgress).
 */
async function pollGameflow(): Promise<void> {
  if (!lcuPort || !lcuPassword) return

  try {
    const resp = await lcuHttpClient.get(
      getLcuUrl('/lol-gameflow/v1/gameflow-phase'),
      { headers: getLcuHeaders() },
    )
    const phase = resp.data as string

    if (phase === 'WatchInProgress' && !isReplayMode) {
      isReplayMode = true
      broadcastToWindows(IPC.REPLAY_DETECTED, { isReplay: true })
      console.log('[LCUAgent] Mode Replay détecté (WatchInProgress)')
    } else if (phase !== 'WatchInProgress' && isReplayMode) {
      isReplayMode = false
      broadcastToWindows(IPC.REPLAY_DETECTED, { isReplay: false })
      console.log('[LCUAgent] Fin du mode Replay')
    }
  } catch {
    // Pas connecté au gameflow, on ignore
  }
}

// ─── Import historique LCU ──────────────────────────────────────────────────

interface LcuMatchStats {
  win: boolean
  kills: number
  deaths: number
  assists: number
  totalMinionsKilled: number
  neutralMinionsKilled: number
  goldEarned: number
  champLevel: number
  visionScore: number
  item0: number; item1: number; item2: number
  item3: number; item4: number; item5: number; item6: number
}

interface LcuMatchParticipant {
  participantId: number
  teamId: number
  championId: number
  stats: LcuMatchStats
}

interface LcuMatchIdentity {
  participantId: number
  player: { accountId: string; currentAccountId?: string; summonerId: number; summonerName: string }
}

interface LcuMatchHistoryGame {
  gameId: number
  queueId: number
  gameCreation: number   // timestamp ms
  gameDuration: number   // secondes
  participants: LcuMatchParticipant[]
  participantIdentities: LcuMatchIdentity[]
}

const RANKED_QUEUE_IDS: Record<number, RankedQueueType> = {
  420: 'RANKED_SOLO',
  440: 'RANKED_FLEX',
}

/**
 * Importe les N dernières parties classées depuis l'historique du client LoL.
 * Utilise INSERT OR IGNORE : les parties déjà présentes sont ignorées sans erreur.
 * Retourne le nombre de nouvelles parties insérées.
 */
export async function importRecentRankedGames(count = 5): Promise<number> {
  if (!lcuPort || !lcuPassword) return 0

  try {
    // Une seule requête LCU : l'endpoint "current-summoner" inclut l'accountId
    // dans le corps de la réponse — pas besoin d'un appel séparé /lol-summoner
    const histResp = await lcuHttpClient.get(
      getLcuUrl(`/lol-match-history/v1/products/lol/current-summoner/matches?begIndex=0&endIndex=${count * 2 - 1}`),
      { headers: getLcuHeaders(), timeout: 30_000 },
    )
    const histData = histResp.data as {
      accountId: string             // accountId du joueur connecté
      games: { games: LcuMatchHistoryGame[] }
    }
    const myAccountId = histData.accountId ?? ''
    const allGames: LcuMatchHistoryGame[] = histData?.games?.games ?? []

    let imported = 0

    for (const game of allGames) {
      if (imported >= count) break

      // Filtrer : ranked solo ou flex uniquement
      const queueType = RANKED_QUEUE_IDS[game.queueId]
      if (!queueType) continue

      // Trouver le participant correspondant au joueur actuel via accountId
      const identity = game.participantIdentities.find(
        (pi) => pi.player.accountId === myAccountId
          || pi.player.currentAccountId === myAccountId,
      )
      if (!identity) continue

      const me = game.participants.find((p) => p.participantId === identity.participantId)
      if (!me) continue

      // Répartir les participants en équipe alliée et ennemie
      const myTeam = game.participants.filter((p) => p.teamId === me.teamId)
      const enemies = game.participants.filter((p) => p.teamId !== me.teamId)

      const allyNames = myTeam
        .filter((p) => p.participantId !== me.participantId)
        .map((p) => championMap[p.championId] ?? `Champion_${p.championId}`)

      const enemyNames = enemies
        .map((p) => championMap[p.championId] ?? `Champion_${p.championId}`)

      const teamKills = myTeam.reduce((s, p) => s + p.stats.kills, 0)
      const enemyKills = enemies.reduce((s, p) => s + p.stats.kills, 0)

      const items = [
        me.stats.item0, me.stats.item1, me.stats.item2,
        me.stats.item3, me.stats.item4, me.stats.item5, me.stats.item6,
      ].filter((id) => id > 0).map(String)

      const inserted = saveRankedGameDirect({
        gameId: String(game.gameId),
        timestamp: game.gameCreation,
        queueType,
        champion: championMap[me.championId] ?? `Champion_${me.championId}`,
        kills: me.stats.kills,
        deaths: me.stats.deaths,
        assists: me.stats.assists,
        cs: me.stats.totalMinionsKilled + me.stats.neutralMinionsKilled,
        gold: me.stats.goldEarned,
        gameTime: game.gameDuration,
        teamKills,
        enemyKills,
        wardScore: me.stats.visionScore ?? 0,
        level: me.stats.champLevel,
        items,
        allies: allyNames,
        enemies: enemyNames,
        result: me.stats.win ? 'win' : 'loss',
      })

      if (inserted) imported++
    }

    if (imported > 0) {
      broadcastToWindows(IPC.RANKED_IMPORT_DONE, { count: imported })
      console.log(`[LCUAgent] ${imported} partie(s) classée(s) importée(s) depuis l'historique`)
    }

    return imported
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[LCUAgent] Impossible d'importer l'historique: ${msg}`)
    return 0
  }
}

// ─── Polling champion select ────────────────────────────────────────────────

interface LcuChampSelectSession {
  myTeam?: Array<{
    cellId: number
    championId: number
    championPickIntent: number
    assignedPosition: string
    summonerId: number
  }>
  theirTeam?: Array<{
    cellId: number
    championId: number
    championPickIntent: number
    assignedPosition: string
  }>
  localPlayerCellId?: number
  timer?: { phase: string }
}

function parseDraftState(session: LcuChampSelectSession): DraftState {
  const localCellId = session.localPlayerCellId ?? -1

  const myTeam: DraftPick[] = (session.myTeam ?? []).map((p) => ({
    championId: p.championId || p.championPickIntent || 0,
    championName: championMap[p.championId || p.championPickIntent || 0] ?? '',
    assignedPosition: p.assignedPosition?.toUpperCase() ?? '',
    completed: p.championId > 0,
  }))

  const theirTeam: DraftPick[] = (session.theirTeam ?? []).map((p) => ({
    championId: p.championId || p.championPickIntent || 0,
    championName: championMap[p.championId || p.championPickIntent || 0] ?? '',
    assignedPosition: p.assignedPosition?.toUpperCase() ?? '',
    completed: p.championId > 0,
  }))

  // Trouver le rôle assigné au joueur local
  const localPlayer = (session.myTeam ?? []).find((p) => p.cellId === localCellId)
  const assignedPosition = localPlayer?.assignedPosition?.toUpperCase() ?? ''

  const phase = session.timer?.phase ?? ''
  const draftPhase = phase === 'FINALIZATION' ? 'FINALIZATION'
    : (phase === 'BAN_PICK' || phase === 'PLANNING') ? 'BAN_PICK'
    : 'NONE'

  return { phase: draftPhase, myTeam, theirTeam, assignedPosition }
}

async function poll(): Promise<void> {
  if (!lcuPort || !lcuPassword) return

  try {
    const resp = await lcuHttpClient.get<LcuChampSelectSession>(
      getLcuUrl('/lol-champ-select/v1/session'),
      { headers: getLcuHeaders() },
    )

    const draftState = parseDraftState(resp.data)

    if (!wasInChampSelect) {
      wasInChampSelect = true
      console.log('[LCUAgent] Champion Select détecté')
    }

    broadcastToWindows(IPC.DRAFT_UPDATE, draftState)

    // Auto-import runes au lock-in (phase FINALIZATION)
    if (draftState.phase === 'FINALIZATION') {
      const localPick = draftState.myTeam.find(p => p.completed && p.championName)
      if (localPick && localPick.championName !== lastAutoImportChampion) {
        lastAutoImportChampion = localPick.championName
        const style = getCoachingStyle()
        const pages = generateRunePages(localPick.championName, style)
        exportRunePageToClient(pages.standard).then(ok => {
          if (ok) console.log(`[LCUAgent] Auto-import runes pour ${localPick.championName} (${style})`)
        })
      }
    }

  } catch (error) {
    if (wasInChampSelect) {
      wasInChampSelect = false
      lastAutoImportChampion = ''
      broadcastToWindows(IPC.DRAFT_UPDATE, {
        phase: 'NONE',
        myTeam: [],
        theirTeam: [],
        assignedPosition: '',
      } satisfies DraftState)
      console.log('[LCUAgent] Champion Select terminé')
    }
  }
}

// ─── API publique ───────────────────────────────────────────────────────────

export async function startLcuAgent(): Promise<void> {
  console.log('[LCUAgent] Recherche du League Client...')

  // Détecter le host (gateway Windows si WSL2)
  lcuHost = detectLcuHost()

  const lockPath = findLockfile()
  if (!lockPath) {
    console.log('[LCUAgent] Lockfile introuvable — agent en veille (retry toutes les 30s)')
    // Retry de trouver le lockfile toutes les 30s (timer séparé de pollTimer)
    retryTimer = setInterval(async () => {
      connectionAttempts++
      const path = findLockfile()
      if (path && parseLockfile(path)) {
        console.log(`[LCUAgent] League Client trouvé ! Port: ${lcuPort}`)
        await fetchChampionMap()
        if (retryTimer) { clearInterval(retryTimer); retryTimer = null }
        pollTimer = setInterval(poll, LCU_POLL_MS)
        gameflowPollTimer = setInterval(pollGameflow, 5000)
        if (!hasImportedGames && Object.keys(championMap).length > 0) {
          importRecentRankedGames(5).then((n) => { if (n > 0) hasImportedGames = true })
        }
      } else if (connectionAttempts % 10 === 0) {
        console.debug(`[LCUAgent] Toujours pas de client (${connectionAttempts} tentatives)`)
      }
    }, 30_000)
    return
  }

  if (!parseLockfile(lockPath)) {
    console.warn('[LCUAgent] Lockfile trouvé mais parsing échoué')
    return
  }

  console.log(`[LCUAgent] Connecté — host: ${lcuHost}, port: ${lcuPort}`)
  await fetchChampionMap()

  // Commencer le polling
  pollTimer = setInterval(poll, LCU_POLL_MS)
  gameflowPollTimer = setInterval(pollGameflow, 5000)

  // Import des 5 dernières parties classées (seulement si la champion map est chargée)
  if (!hasImportedGames && Object.keys(championMap).length > 0) {
    importRecentRankedGames(5).then((n) => { if (n > 0) hasImportedGames = true })
  }
}

export function stopLcuAgent(): void {
  if (retryTimer) {
    clearInterval(retryTimer)
    retryTimer = null
  }
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (gameflowPollTimer) {
    clearInterval(gameflowPollTimer)
    gameflowPollTimer = null
  }
  lcuPort = null
  lcuPassword = null
  lastAutoImportChampion = ''
  isReplayMode = false
  hasImportedGames = false
  console.log('[LCUAgent] Arrêté.')
}
