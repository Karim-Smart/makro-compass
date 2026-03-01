import { app, globalShortcut } from 'electron'
import { createMainWindow, createOverlayWindows } from './windowManager'
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

  // setupIpcHandlers enregistre le hotkey depuis les settings persistés
  const initialSettings = setupIpcHandlers(mainWindow, overlayWindows)
  setupTray(mainWindow, initialSettings.hotkey ?? 'F9')
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
