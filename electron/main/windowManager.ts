import { BrowserWindow, screen, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

let mainWindow: BrowserWindow | null = null

// 6 fenêtres overlay indépendantes (opaques, draggables)
let statsWindow: BrowserWindow | null = null
let timersWindow: BrowserWindow | null = null
let adviceWindow: BrowserWindow | null = null
let styleWindow: BrowserWindow | null = null
let runesWindow: BrowserWindow | null = null
let buildWindow: BrowserWindow | null = null

const PRELOAD_MAIN = join(__dirname, '../preload/index.cjs')
const PRELOAD_OVERLAY = join(__dirname, '../preload/overlay.cjs')

export function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'maKro Compass',
    backgroundColor: '#0D1117',
    frame: true,
    show: false,
    webPreferences: {
      preload: PRELOAD_MAIN,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/main-app/index.html`)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/main-app/index.html'))
  }

  if (is.dev) {
    mainWindow.webContents.on('console-message', (_e, level, message, line, source) => {
      const tag = ['verbose', 'info', 'warning', 'error'][level] ?? 'log'
      console.log(`[Renderer:${tag}] ${message} (${source}:${line})`)
    })
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  return mainWindow
}

// ─── Création d'une fenêtre overlay individuelle ──────────────────────────────

interface OverlaySpec {
  panel: string
  width: number
  height: number
  x: number
  y: number
}

function createPanelWindow(spec: OverlaySpec): BrowserWindow {
  const win = new BrowserWindow({
    width: spec.width,
    height: spec.height,
    x: spec.x,
    y: spec.y,
    frame: false,
    transparent: false,
    backgroundColor: '#080A12',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: true,
    roundedCorners: true,
    webPreferences: {
      preload: PRELOAD_OVERLAY,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.setAlwaysOnTop(true, 'screen-saver')
  win.hide()

  const panelUrl = `?panel=${spec.panel}`
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/overlay/index.html${panelUrl}`)
  } else {
    win.loadFile(join(__dirname, '../renderer/overlay/index.html'), { search: panelUrl })
  }

  if (is.dev) {
    win.webContents.on('console-message', (_e, level, message) => {
      const tag = ['verbose', 'info', 'warning', 'error'][level] ?? 'log'
      console.log(`[Overlay:${spec.panel}:${tag}] ${message}`)
    })
  }

  return win
}

export function createOverlayWindows(): BrowserWindow[] {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize

  // Stats — haut gauche (plus large pour KDA + CS + Gold + timer)
  statsWindow = createPanelWindow({
    panel: 'stats',
    width: 280,
    height: 60,
    x: 10,
    y: 10,
  })
  statsWindow.on('closed', () => { statsWindow = null })

  // Timers + Objectifs — bas gauche (plus haut pour objectifs enrichis)
  timersWindow = createPanelWindow({
    panel: 'timers',
    width: 220,
    height: 260,
    x: 10,
    y: sh - 280,
  })
  timersWindow.on('closed', () => { timersWindow = null })

  // Advice — haut droite
  adviceWindow = createPanelWindow({
    panel: 'advice',
    width: 340,
    height: 160,
    x: sw - 360,
    y: 10,
  })
  adviceWindow.on('closed', () => { adviceWindow = null })

  // Style switcher — droite, centré verticalement (un peu plus large pour les icônes SVG)
  styleWindow = createPanelWindow({
    panel: 'style',
    width: 72,
    height: 200,
    x: sw - 82,
    y: Math.round(sh / 2 - 100),
  })
  styleWindow.on('closed', () => { styleWindow = null })

  // Runes — bas-droite (grande fenêtre pour l'arbre complet)
  runesWindow = createPanelWindow({
    panel: 'runes',
    width: 320,
    height: 520,
    x: sw - 340,
    y: sh - 540,
  })
  runesWindow.on('closed', () => { runesWindow = null })

  // Build — droite, colonne compacte verticale
  buildWindow = createPanelWindow({
    panel: 'build',
    width: 64,
    height: 420,
    x: sw - 80,
    y: Math.round(sh / 2 - 210),
  })
  buildWindow.on('closed', () => { buildWindow = null })

  return [statsWindow, timersWindow, adviceWindow, styleWindow, runesWindow, buildWindow]
}

// ─── Accesseurs ───────────────────────────────────────────────────────────────

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function getOverlayWindows(): BrowserWindow[] {
  return [statsWindow, timersWindow, adviceWindow, styleWindow, runesWindow, buildWindow].filter(
    (w): w is BrowserWindow => w !== null && !w.isDestroyed()
  )
}

export function showOverlay(): void {
  for (const win of getOverlayWindows()) {
    win.show()
  }
  console.log('[WindowManager] Overlays affichés (partie détectée)')
}

export function hideOverlay(): void {
  for (const win of getOverlayWindows()) {
    win.hide()
  }
  console.log('[WindowManager] Overlays masqués (fin de partie)')
}
