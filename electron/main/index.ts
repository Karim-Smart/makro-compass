import { app, globalShortcut } from 'electron'
import { createMainWindow, createOverlayWindows, getOverlayWindows } from './windowManager'
import { setupIpcHandlers, stopAllAgents } from './ipcHandlers'
import { setupTray } from './trayManager'

// Désactiver la vérification de certificat SSL (pour Riot API auto-signé)
app.commandLine.appendSwitch('ignore-certificate-errors')

if (process.platform === 'linux') {
  // WSL2 : forcer le rendu CPU (le GPU virtuel WSLg échoue avec Electron)
  app.disableHardwareAcceleration()
}

app.whenReady().then(async () => {
  const mainWindow = createMainWindow()
  const overlayWindows = createOverlayWindows()

  setupIpcHandlers(mainWindow, overlayWindows)
  setupTray(mainWindow)

  // Hotkey global F9 : afficher/masquer les overlays
  globalShortcut.register('F9', () => {
    const windows = getOverlayWindows()
    if (windows.length === 0) return

    // Toggle basé sur le premier overlay
    const shouldHide = windows[0].isVisible()
    for (const win of windows) {
      if (shouldHide) win.hide()
      else win.show()
    }
  })
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
