import { Tray, Menu, BrowserWindow, app, nativeImage } from 'electron'
import { join } from 'path'
import { getOverlayWindows } from './windowManager'

let tray: Tray | null = null

export function setupTray(mainWindow: BrowserWindow, hotkey = 'F9'): void {
  const iconPath = join(__dirname, '../../resources/tray-icon.png')
  let trayIcon: Electron.NativeImage

  try {
    trayIcon = nativeImage.createFromPath(iconPath)
  } catch {
    trayIcon = nativeImage.createEmpty()
  }

  tray = new Tray(trayIcon)
  tray.setToolTip('maKro Compass')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Ouvrir maKro Compass',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
      }
    },
    {
      label: `Afficher/Masquer overlay (${hotkey})`,
      click: () => {
        const windows = getOverlayWindows()
        if (windows.length === 0) return
        const shouldHide = windows[0].isVisible()
        for (const win of windows) {
          if (shouldHide) win.hide()
          else win.show()
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quitter',
      click: () => app.quit()
    }
  ])

  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => {
    mainWindow.show()
    mainWindow.focus()
  })
}
