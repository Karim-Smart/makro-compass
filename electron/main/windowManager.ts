import { BrowserWindow, screen, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { OverlayPanels, SubscriptionTier } from '../../shared/types'
import { canAccess } from '../../shared/feature-gates'

let mainWindow: BrowserWindow | null = null

// 7 fenêtres overlay indépendantes
let statsWindow: BrowserWindow | null = null
let timersWindow: BrowserWindow | null = null
let adviceWindow: BrowserWindow | null = null
let styleWindow: BrowserWindow | null = null
let buildWindow: BrowserWindow | null = null
let winconditionWindow: BrowserWindow | null = null
let scoreboardWindow: BrowserWindow | null = null

// Préférences de visibilité par panneau (par défaut tout activé sauf wincondition)
let panelSettings: OverlayPanels = {
  stats: true,
  timers: true,
  advice: true,
  style: true,
  build: true,
  wincondition: false,
  scoreboard: true,
}

// true quand l'overlay est globalement affiché (partie en cours)
let overlayActive = false

// Tier actuel pour le gating overlay
let currentTier: SubscriptionTier = 'free'

/** Met à jour le tier pour le gating overlay. */
export function setOverlayTier(tier: SubscriptionTier): void {
  currentTier = tier
}

const PRELOAD_MAIN = join(__dirname, '../preload/index.cjs')
const PRELOAD_OVERLAY = join(__dirname, '../preload/overlay.cjs')

export function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'maKro Compass',
    backgroundColor: '#010A13',
    frame: false,
    show: false,
    icon: join(__dirname, '../../resources/icon.png'),
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
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: PRELOAD_OVERLAY,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.setAlwaysOnTop(true, 'screen-saver')
  // Laisser passer les clics au jeu par défaut
  win.setIgnoreMouseEvents(true, { forward: true })
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

  // Stats — haut gauche (KDA + CS + Gold + timer + matchup + vision)
  statsWindow = createPanelWindow({
    panel: 'stats',
    width: 320,
    height: 110,
    x: 10,
    y: 10,
  })
  statsWindow.on('closed', () => { statsWindow = null })

  // Timers — bas gauche
  timersWindow = createPanelWindow({
    panel: 'timers',
    width: 220,
    height: 180,
    x: 10,
    y: sh - 200,
  })
  timersWindow.on('closed', () => { timersWindow = null })

  // Advice — haut droite (élargi pour meilleur texte)
  adviceWindow = createPanelWindow({
    panel: 'advice',
    width: 380,
    height: 170,
    x: sw - 400,
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

  // Build — droite, colonne compacte verticale
  buildWindow = createPanelWindow({
    panel: 'build',
    width: 64,
    height: 420,
    x: sw - 80,
    y: Math.round(sh / 2 - 210),
  })
  buildWindow.on('closed', () => { buildWindow = null })

  // Win Condition — haut centre (Elite uniquement)
  winconditionWindow = createPanelWindow({
    panel: 'wincondition',
    width: 280,
    height: 80,
    x: Math.round(sw / 2 - 140),
    y: 10,
  })
  winconditionWindow.on('closed', () => { winconditionWindow = null })

  // Scoreboard — bas centre (5v5 gold diff style Blitz)
  scoreboardWindow = createPanelWindow({
    panel: 'scoreboard',
    width: 420,
    height: 220,
    x: Math.round(sw / 2 - 210),
    y: sh - 240,
  })
  scoreboardWindow.on('closed', () => { scoreboardWindow = null })

  return [statsWindow, timersWindow, adviceWindow, styleWindow, buildWindow, winconditionWindow, scoreboardWindow]
}

// ─── Accesseurs ───────────────────────────────────────────────────────────────

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function getOverlayWindows(): BrowserWindow[] {
  return [statsWindow, timersWindow, adviceWindow, styleWindow, buildWindow, winconditionWindow, scoreboardWindow].filter(
    (w): w is BrowserWindow => w !== null && !w.isDestroyed()
  )
}

/** Retourne la fenêtre overlay d'un panneau spécifique. */
function getPanelWindow(panel: keyof OverlayPanels): BrowserWindow | null {
  const map: Record<keyof OverlayPanels, BrowserWindow | null> = {
    stats: statsWindow,
    timers: timersWindow,
    advice: adviceWindow,
    style: styleWindow,
    build: buildWindow,
    wincondition: winconditionWindow,
    scoreboard: scoreboardWindow,
  }
  return map[panel]
}

/**
 * Met à jour les préférences de panneau et applique immédiatement
 * si l'overlay est actif (partie en cours).
 */
export function setPanelSettings(panels: Partial<OverlayPanels>): void {
  panelSettings = { ...panelSettings, ...panels }
  if (overlayActive) {
    // Appliquer en temps réel : show/hide chaque panneau
    for (const key of Object.keys(panelSettings) as (keyof OverlayPanels)[]) {
      const win = getPanelWindow(key)
      if (!win || win.isDestroyed()) continue
      if (panelSettings[key]) {
        win.setAlwaysOnTop(true, 'screen-saver')
        win.setIgnoreMouseEvents(true, { forward: true })
        win.showInactive()
      } else {
        win.hide()
      }
    }
  }
}

// Map panneau → feature gatée (panneaux non listés = toujours accessibles)
const PANEL_FEATURE_MAP: Partial<Record<keyof OverlayPanels, import('../../shared/feature-gates').GatedFeature>> = {
  advice: 'overlay_advice',
  build: 'overlay_build',
  style: 'overlay_style',
  wincondition: 'wincondition_tracker',
}

export function showOverlay(): void {
  overlayActive = true
  for (const key of Object.keys(panelSettings) as (keyof OverlayPanels)[]) {
    const win = getPanelWindow(key)
    if (!win || win.isDestroyed()) continue

    // Gating : vérifier le tier avant d'afficher
    const requiredFeature = PANEL_FEATURE_MAP[key]
    if (requiredFeature && !canAccess(requiredFeature, currentTier)) {
      win.hide()
      continue
    }

    if (panelSettings[key]) {
      // Forcer alwaysOnTop + ignore mouse events à chaque show
      // (le jeu peut réclamer le focus entre les shows)
      win.setAlwaysOnTop(true, 'screen-saver')
      win.setIgnoreMouseEvents(true, { forward: true })
      win.showInactive()  // showInactive = montre sans voler le focus au jeu
    }
    // les panneaux désactivés restent cachés
  }
  console.log('[WindowManager] Overlays affichés (partie détectée)')
}

export function hideOverlay(): void {
  overlayActive = false
  for (const win of getOverlayWindows()) {
    win.hide()
  }
  console.log('[WindowManager] Overlays masqués (fin de partie)')
}
