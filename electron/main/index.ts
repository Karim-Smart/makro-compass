import { app, globalShortcut } from 'electron'
import { createMainWindow, createOverlayWindows, setOverlayApi, getOverlayApi, showOverlay, hideOverlay } from './windowManager'
import { setupIpcHandlers, stopAllAgents } from './ipcHandlers'
import { setupTray } from './trayManager'
import type { IOverwolfOverlayApi } from '@overwolf/ow-electron-packages-types'

// Désactiver la vérification de certificat SSL (pour Riot API auto-signé)
app.commandLine.appendSwitch('ignore-certificate-errors')

if (process.platform === 'linux') {
  // WSL2 : forcer le rendu CPU (le GPU virtuel WSLg échoue avec Electron)
  app.disableHardwareAcceleration()
}

// ─── Détection du runtime ow-electron ─────────────────────────────────────────

function isOverwolfRuntime(): boolean {
  try {
    return !!(app as Record<string, unknown>).overwolf
  } catch {
    return false
  }
}

/**
 * Attend que le package overlay Overwolf soit prêt.
 * Retourne l'API overlay une fois chargée.
 */
function waitForOverlayPackage(): Promise<IOverwolfOverlayApi> {
  return new Promise((resolve) => {
    const owApp = app as Record<string, any>
    owApp.overwolf.packages.on('ready', (_e: unknown, packageName: string, version: string) => {
      if (packageName !== 'overlay') return
      console.log(`[Main] Package overlay Overwolf prêt (v${version})`)
      const api = owApp.overwolf.packages.overlay as IOverwolfOverlayApi
      resolve(api)
    })
  })
}

// ─── Initialisation ───────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  const mainWindow = createMainWindow()

  if (isOverwolfRuntime()) {
    // ── Mode ow-electron : overlay DirectX (fullscreen exclusif supporté) ──
    console.log('[Main] Runtime ow-electron détecté — mode overlay DirectX')

    const overlayApiRef = await waitForOverlayPackage()
    setOverlayApi(overlayApiRef)

    // Créer les fenêtres overlay (utilisent OverlayBrowserWindow)
    const overlayWindows = await createOverlayWindows()

    // Setup IPC, agents, tray
    const initialSettings = setupIpcHandlers(mainWindow, overlayWindows)
    setupTray(mainWindow, initialSettings.hotkey ?? 'F9')

    // Enregistrer League of Legends pour l'injection overlay
    // Game ID 5426 = League of Legends (Overwolf game registry)
    overlayApiRef.registerGames({ gamesIds: [5426] })
    console.log('[Main] LoL enregistré pour injection overlay (gameId: 5426)')

    // ── Game lifecycle events ──
    overlayApiRef.on('game-launched', (event, gameInfo) => {
      console.log(`[Main] Jeu détecté: ${gameInfo.name ?? 'inconnu'}`)
      if (gameInfo.processInfo?.isElevated) {
        console.warn('[Main] Jeu lancé en admin — injection impossible sans élévation')
        return
      }
      event.inject()
    })

    overlayApiRef.on('game-injected', (gameInfo) => {
      console.log(`[Main] Overlay injecté dans ${gameInfo.name ?? 'le jeu'}`)
      showOverlay()
    })

    overlayApiRef.on('game-injection-error', (gameInfo, error) => {
      console.error(`[Main] Erreur injection overlay: ${error}`, gameInfo)
    })

    overlayApiRef.on('game-exit', (_gameInfo, wasInjected) => {
      if (wasInjected) {
        console.log('[Main] Jeu fermé — overlay masqué')
        hideOverlay()
      }
    })

    overlayApiRef.on('game-focus-changed', (_window, _gameInfo, focus) => {
      // En mode ow-electron, l'overlay suit automatiquement le focus du jeu
      console.log(`[Main] Focus jeu: ${focus ? 'actif' : 'perdu'}`)
    })

  } else {
    // ── Mode standard Electron (dev / WSL2) : alwaysOnTop + transparent ──
    console.log('[Main] Runtime Electron standard — mode overlay alwaysOnTop')

    const overlayWindows = await createOverlayWindows()
    const initialSettings = setupIpcHandlers(mainWindow, overlayWindows)
    setupTray(mainWindow, initialSettings.hotkey ?? 'F9')
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  stopAllAgents()
})
