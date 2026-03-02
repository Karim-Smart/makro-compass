import { ipcMain, BrowserWindow, globalShortcut, safeStorage, shell } from 'electron'
import Store from 'electron-store'
import { IPC } from '../../shared/ipc-channels'
import type { CoachingStyle, UserSettings, SubscriptionTier } from '../../shared/types'
import { startRiotAgent, stopRiotAgent } from '../agents/riotAgent'
import { setCoachingStyle, setApiKey, getCoachingStyle, startAICoachAgent, stopAICoachAgent, setShotcallerMode, setCustomCoachTone } from '../agents/aiCoachAgent'
import { setAnthropicApiKey } from '../agents/anthropicClient'
import { getSubscriptionStatus } from '../agents/subscriptionAgent'
import { startTimerAgent, stopTimerAgent } from '../agents/timerAgent'
import { startLcuAgent, stopLcuAgent, exportRunePageToClient, launchReplay, importRecentRankedGames } from '../agents/lcuAgent'
import { getAdviceHistory, getQuotaStatus, getRankedHistory } from '../agents/quotaManager'
import { generateBuildRecommendations } from '../agents/buildEngine'
import { generateReviewTimeline } from '../agents/reviewEngine'
import { analyzeDraft } from '../agents/draftOracle'
import { generateDebrief } from '../agents/postGameDebrief'
import { guardFeature } from '../agents/subscriptionAgent'
import { generateSmartRecapForGame } from '../agents/smartRecap'
import { canAccess } from '../../shared/feature-gates'
import { DEV_MOCK_AI, DEV_OVERRIDE_TIER } from '../../shared/constants'
import type { RankedGame, DraftOracleRequest } from '../../shared/types'
import { generateRunePages } from '../../shared/rune-data'
import { getOverlayWindows, setPanelSettings, setOverlayTier } from './windowManager'

// ─── Persistance des settings ─────────────────────────────────────────────────

const DEFAULT_OVERLAY_PANELS = { stats: true, timers: true, advice: true, style: true, build: true, wincondition: false, scoreboard: true }

const DEFAULT_SETTINGS: UserSettings = {
  hotkey: 'F9',
  overlayOpacity: 0.9,
  overlayPosition: { x: 100, y: 100 },
  region: 'EUW',
  selectedStyle: 'LCK',
  overlayPanels: DEFAULT_OVERLAY_PANELS,
  voiceAlerts: true,
  voiceVolume: 0.8,
  shotcallerMode: false,
  customCoachTone: '',
}

const store = new Store<{ settings: UserSettings }>({
  defaults: { settings: DEFAULT_SETTINGS }
})

// ─── Hotkey overlay ───────────────────────────────────────────────────────────

let _registeredHotkey = ''
let _mainWindowRef: BrowserWindow | null = null

function registerOverlayHotkey(key: string): void {
  if (_registeredHotkey) {
    try { globalShortcut.unregister(_registeredHotkey) } catch { /* ignoré */ }
  }
  const ok = globalShortcut.register(key, () => {
    const windows = getOverlayWindows()
    if (windows.length === 0) return
    const shouldHide = windows[0].isVisible()
    for (const win of windows) {
      if (shouldHide) win.hide()
      else win.show()
    }
    _mainWindowRef?.webContents.send(IPC.OVERLAY_TOGGLE, !shouldHide)
  })
  if (ok) {
    _registeredHotkey = key
    console.log(`[IPC] Raccourci overlay: ${key}`)
  } else {
    console.warn(`[IPC] Impossible d'enregistrer le raccourci: ${key}`)
  }
}

function loadSettings(): UserSettings {
  const settings = store.get('settings', DEFAULT_SETTINGS)
  // Déchiffrer la clé API si elle existe
  const encryptedKey = store.get('encryptedApiKey' as never) as string | undefined
  if (encryptedKey && safeStorage.isEncryptionAvailable()) {
    try {
      settings.apiKey = safeStorage.decryptString(Buffer.from(encryptedKey, 'base64'))
    } catch {
      console.warn('[Settings] Impossible de déchiffrer la clé API')
    }
  }
  return settings
}

function saveSettings(partial: Partial<UserSettings>): UserSettings {
  const current = loadSettings()

  // Chiffrer la clé API séparément (pas en clair dans electron-store)
  if (partial.apiKey !== undefined) {
    if (partial.apiKey && safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(partial.apiKey)
      store.set('encryptedApiKey' as never, encrypted.toString('base64') as never)
    }
    // Ne pas stocker la clé en clair dans settings
    const { apiKey: _, ...rest } = partial
    const updated = { ...current, ...rest, apiKey: partial.apiKey }
    const { apiKey: _2, ...settingsWithoutKey } = updated
    store.set('settings', { ...settingsWithoutKey, selectedStyle: updated.selectedStyle } as UserSettings)
    return updated
  }

  const updated = { ...current, ...partial }
  store.set('settings', updated)
  return updated
}

/**
 * Configure tous les handlers IPC du main process.
 * Retourne les settings chargés pour initialisation externe (ex. panneaux overlay).
 */
export function setupIpcHandlers(
  mainWindow: BrowserWindow,
  overlayWindows: BrowserWindow[]
): UserSettings {
  const initialSettings = loadSettings()
  _mainWindowRef = mainWindow

  // Enregistrer le raccourci overlay depuis les settings persistés
  registerOverlayHotkey(initialSettings.hotkey ?? 'F9')

  // Appliquer les préférences de panneaux au démarrage
  setPanelSettings(initialSettings.overlayPanels ?? DEFAULT_OVERLAY_PANELS)

  // Changement du style de coaching (guard: styles non-LCK nécessitent Pro+)
  ipcMain.on(IPC.STYLE_CHANGE, async (_event, style: CoachingStyle) => {
    if (style !== 'LCK') {
      const allowed = await guardFeature('all_coaching_styles')
      if (!allowed) {
        console.log(`[IPC] Style ${style} bloqué — tier free (LCK uniquement)`)
        return
      }
    }
    setCoachingStyle(style)
    saveSettings({ selectedStyle: style })
    for (const win of getOverlayWindows()) {
      win.webContents.send(IPC.STYLE_CHANGE, style)
    }
    // Recalculer les runes avec le nouveau style
    const g = global as typeof global & { __lastGameData?: import('../../shared/types').GameData }
    if (g.__lastGameData) {
      const runePages = generateRunePages(g.__lastGameData.champion, style)
      broadcastToWindows(IPC.OVERLAY_RUNES, runePages)
    }
  })

  ipcMain.handle(IPC.SUBSCRIPTION_CHECK, async () => {
    const status = await getSubscriptionStatus()
    setOverlayTier(status.tier)
    return status
  })

  ipcMain.on(IPC.SETTINGS_UPDATE, (_event, partial: Partial<UserSettings>) => {
    const updated = saveSettings(partial)
    console.log('[IPC] Settings persistés:', Object.keys(partial).join(', '))

    if (partial.apiKey) {
      setApiKey(partial.apiKey)
      setAnthropicApiKey(partial.apiKey)
    }

    if (partial.hotkey) {
      registerOverlayHotkey(partial.hotkey)
    }

    if (partial.overlayOpacity !== undefined) {
      for (const win of getOverlayWindows()) {
        win.setOpacity(updated.overlayOpacity)
      }
    }

    if (partial.overlayPanels !== undefined) {
      setPanelSettings(partial.overlayPanels)
    }

    // Shotcaller mode et custom coach (Elite)
    if (partial.shotcallerMode !== undefined) {
      setShotcallerMode(partial.shotcallerMode)
    }
    if (partial.customCoachTone !== undefined) {
      setCustomCoachTone(partial.customCoachTone)
    }

    // Syncer les settings voix vers les overlays en temps réel
    if (partial.voiceAlerts !== undefined || partial.voiceVolume !== undefined) {
      for (const win of getOverlayWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send(IPC.SETTINGS_UPDATE, {
            voiceAlerts: updated.voiceAlerts,
            voiceVolume: updated.voiceVolume,
          })
        }
      }
    }
  })

  ipcMain.handle(IPC.ADVICE_HISTORY, () => {
    return getAdviceHistory()
  })

  ipcMain.handle(IPC.QUOTA_STATUS, () => {
    return getQuotaStatus()
  })

  ipcMain.handle(IPC.RANKED_HISTORY, (_event, queueType?: string) => {
    return getRankedHistory(queueType as import('../../shared/types').RankedQueueType | undefined)
  })

  // Générer la timeline de review pour une partie (depuis la page Historique)
  ipcMain.handle(IPC.REVIEW_GENERATE, (_event, gameId: number) => {
    const games = getRankedHistory() as RankedGame[]
    const game = games.find((g) => g.id === gameId)
    if (!game) return null
    return generateReviewTimeline(game)
  })

  // Lancer le replay d'une partie via le client LoL
  ipcMain.handle(IPC.LAUNCH_REPLAY, async (_event, gameId: number) => {
    return launchReplay(gameId)
  })

  // Import manuel de l'historique LCU (bouton Actualiser dans Stats) — Pro+ requis
  ipcMain.handle(IPC.RANKED_HISTORY_IMPORT, async () => {
    const allowed = await guardFeature('ranked_import')
    if (!allowed) {
      console.log('[IPC] Import LCU bloqué — tier free')
      return 0
    }
    return importRecentRankedGames(10)
  })

  // AI Post-Game Debrief (Pro+)
  ipcMain.handle(IPC.POSTGAME_DEBRIEF, async (_event, gameId: number) => {
    try {
      const games = getRankedHistory() as RankedGame[]
      const game = games.find((g) => g.id === gameId)
      if (!game) return null
      return await generateDebrief(game)
    } catch (err) {
      console.error('[IPC] Erreur Post-Game Debrief:', (err as Error).message)
      return null
    }
  })

  // AI Smart Recap (Pro+)
  ipcMain.handle(IPC.SMART_RECAP, async (_event, gameId: number) => {
    try {
      const games = getRankedHistory() as RankedGame[]
      const game = games.find((g) => g.id === gameId)
      if (!game) return null
      return await generateSmartRecapForGame(game)
    } catch (err) {
      console.error('[IPC] Erreur Smart Recap:', (err as Error).message)
      return null
    }
  })

  // AI Draft Oracle (Pro+)
  ipcMain.handle(IPC.DRAFT_ORACLE, async (_event, req: DraftOracleRequest) => {
    try {
      if (!req?.myTeam || !req?.theirTeam) return null
      return await analyzeDraft(req)
    } catch (err) {
      console.error('[IPC] Erreur Draft Oracle:', (err as Error).message)
      return null
    }
  })

  // Changement de rôle (depuis la page Draft)
  ipcMain.on(IPC.ROLE_CHANGE, (_event, role: string) => {
    console.log(`[IPC] Rôle changé → ${role}`)
    saveSettings({ ...loadSettings() })  // juste pour log, pas de persistance spéciale ici
  })

  // Toggle overlay depuis le bouton UI
  ipcMain.on(IPC.OVERLAY_TOGGLE, (_event, shouldShow?: boolean) => {
    const windows = getOverlayWindows()
    if (windows.length === 0) return
    const nextVisible = shouldShow !== undefined ? shouldShow : !windows[0].isVisible()
    for (const win of windows) {
      if (nextVisible) win.show()
      else win.hide()
    }
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send(IPC.OVERLAY_TOGGLE, nextVisible)
  })

  // ─── Import runes via bouton overlay ou F6 ──────────────────────────────

  let lastRunePages: import('../../shared/types').RunePageSet | null = null

  ipcMain.on(IPC.IMPORT_RUNES, (_event, variant: string) => {
    if (!lastRunePages) return
    const page = lastRunePages[variant as keyof typeof lastRunePages]
    if (!page) return
    exportRunePageToClient(page)
  })

  // Stocker les runes quand elles sont broadcastées
  ipcMain.on(IPC.OVERLAY_RUNES, (_event, pages: unknown) => {
    lastRunePages = pages as import('../../shared/types').RunePageSet
  })

  // Raccourci global F6 → importer la page standard
  globalShortcut.register('F6', () => {
    if (!lastRunePages) return
    exportRunePageToClient(lastRunePages.standard)
    console.log('[IPC] F6 → import runes standard')
  })

  // Click-through overlay : basculer entre mode interactif et passthrough
  ipcMain.on(IPC.OVERLAY_MOUSE_IGNORE, (_event, ignore: boolean) => {
    for (const win of getOverlayWindows()) {
      win.setIgnoreMouseEvents(ignore, { forward: true })
    }
  })

  // Stripe checkout — ouvre l'URL dans le navigateur
  ipcMain.handle(IPC.OPEN_CHECKOUT, async (_event, tier: SubscriptionTier) => {
    // TODO: Remplacer par la vraie URL Stripe quand le backend sera prêt
    const checkoutUrls: Record<string, string> = {
      pro: 'https://buy.stripe.com/placeholder-pro',
      elite: 'https://buy.stripe.com/placeholder-elite',
    }
    const url = checkoutUrls[tier]
    if (url && !url.includes('placeholder')) {
      shell.openExternal(url)
      console.log(`[IPC] Ouverture checkout Stripe → ${tier}`)
    } else {
      console.warn(`[IPC] Checkout ${tier} : URL Stripe non configurée (placeholder)`)
    }
    return true
  })

  // ─── Window controls (frameless) ─────────────────────────────────────────
  ipcMain.on('window:minimize', () => {
    if (mainWindow.isDestroyed()) return
    mainWindow.minimize()
  })
  ipcMain.on('window:maximize', () => {
    if (mainWindow.isDestroyed()) return
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.on('window:close', () => {
    if (mainWindow.isDestroyed()) return
    mainWindow.close()
  })

  // Refresh build
  ipcMain.on(IPC.REFRESH_BUILD, () => {
    const g = global as typeof global & { __lastGameData?: import('../../shared/types').GameData }
    if (!g.__lastGameData) return
    const style = getCoachingStyle()
    const buildRec = generateBuildRecommendations(g.__lastGameData, style)
    broadcastToWindows(IPC.OVERLAY_BUILD, buildRec)
  })

  // ─── Registry des fenêtres pour broadcastToWindows ────────────────────────

  setupWindowRegistry(mainWindow, overlayWindows)

  // ─── Démarrage des agents + chargement des settings persistés ────────────

  startAgents(mainWindow, overlayWindows)

  return initialSettings
}

/**
 * Expose les fenêtres aux agents via une registry globale.
 */
function setupWindowRegistry(
  mainWindow: BrowserWindow,
  overlayWindows: BrowserWindow[]
): void {
  const registry: Record<string, BrowserWindow> = { main: mainWindow }
  overlayWindows.forEach((win, i) => {
    if (win) registry[`overlay_${i}`] = win
  })
  ;(global as typeof global & { __windows: Record<string, BrowserWindow> }).__windows = registry
}

/**
 * Démarre tous les agents et applique les settings persistés.
 */
async function startAgents(mainWindow: BrowserWindow, overlayWindows: BrowserWindow[]): Promise<void> {
  try {
    if (DEV_MOCK_AI) {
      console.log(`[Main] 🤖 Mode IA mock ACTIF — aucun appel API Anthropic (tier: ${DEV_OVERRIDE_TIER ?? 'backend'})`)
    }
    const settings = loadSettings()

    if (settings.apiKey) {
      setApiKey(settings.apiKey)
      setAnthropicApiKey(settings.apiKey)
    }

    setCoachingStyle(settings.selectedStyle)
    if (settings.shotcallerMode) setShotcallerMode(settings.shotcallerMode)
    if (settings.customCoachTone) setCustomCoachTone(settings.customCoachTone)

    // Envoyer les settings au renderer principal
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.send(IPC.SETTINGS_UPDATE, settings)
    })

    // Envoyer les settings voix aux overlays au démarrage
    for (const win of overlayWindows) {
      if (!win || win.isDestroyed()) continue
      win.webContents.once('did-finish-load', () => {
        if (win.isDestroyed()) return
        win.webContents.send(IPC.SETTINGS_UPDATE, {
          voiceAlerts: settings.voiceAlerts ?? true,
          voiceVolume: settings.voiceVolume ?? 0.8,
        })
      })
    }

    await startRiotAgent()
    await startAICoachAgent()
    await startTimerAgent()
    await startLcuAgent()

    const status = await getSubscriptionStatus()
    setOverlayTier(status.tier)
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send(IPC.SUBSCRIPTION_STATUS, status)
  } catch (err) {
    console.error('[Main] Erreur démarrage agents:', err)
  }
}

/**
 * Arrête proprement tous les agents.
 */
export function stopAllAgents(): void {
  stopRiotAgent()
  stopAICoachAgent()
  stopTimerAgent()
  stopLcuAgent()
  globalShortcut.unregisterAll()
}

/**
 * Envoie des données à toutes les fenêtres enregistrées.
 */
export function broadcastToWindows(channel: string, data: unknown): void {
  const g = global as typeof global & { __windows?: Record<string, BrowserWindow> }
  const windows = g.__windows
  if (!windows) return

  for (const win of Object.values(windows)) {
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, data)
    }
  }
}
