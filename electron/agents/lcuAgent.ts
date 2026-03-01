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
  try {
    const resp = await lcuHttpClient.get(
      getLcuUrl('/lol-game-data/assets/v1/champion-summary.json'),
      { headers: getLcuHeaders() },
    )
    const data = resp.data as Array<{ id: number; name: string }>
    championMap = {}
    for (const champ of data) {
      if (champ.id > 0) championMap[champ.id] = champ.name
    }
    console.log(`[LCUAgent] ${Object.keys(championMap).length} champions chargés`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[LCUAgent] Impossible de charger la map des champions: ${msg}`)
    console.warn(`[LCUAgent] URL tentée: ${getLcuUrl('/lol-game-data/assets/v1/champion-summary.json')}`)
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
  lcuPort = null
  lcuPassword = null
  lastAutoImportChampion = ''
  console.log('[LCUAgent] Arrêté.')
}
