import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import type { CoachingStyle } from '../../shared/types'

const overlayAPI = {
  // Écouter les événements envoyés depuis le main process
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const validChannels = [
      IPC.OVERLAY_SHOW_ADVICE,
      IPC.OVERLAY_SHOW_ALERT,
      IPC.OVERLAY_TIMERS,
      IPC.OVERLAY_TOGGLE,
      IPC.GAME_DATA,
      IPC.GAME_STATUS,
      IPC.STYLE_CHANGE,
      IPC.OVERLAY_BUILD,
      IPC.OVERLAY_RUNES,
    ]
    if (validChannels.includes(channel as (typeof validChannels)[number])) {
      ipcRenderer.on(channel, (_event: IpcRendererEvent, ...args: unknown[]) => callback(...args))
    }
  },

  removeListener: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, callback as Parameters<typeof ipcRenderer.removeListener>[1])
  },

  // Changer le style de coaching depuis l'overlay (boutons StyleSwitcher)
  changeStyle: (style: CoachingStyle) => {
    ipcRenderer.send(IPC.STYLE_CHANGE, style)
  },

  // Importer une page de runes dans le client LoL
  importRunes: (variant: string) => {
    ipcRenderer.send(IPC.IMPORT_RUNES, variant)
  },

  // Recalculer le build
  refreshBuild: () => {
    ipcRenderer.send(IPC.REFRESH_BUILD)
  },

  // Activer/désactiver le click-through de l'overlay
  // false = l'overlay capture les clics (pour les boutons)
  // true  = les clics passent à travers vers LoL
  setIgnoreMouseEvents: (ignore: boolean) => {
    ipcRenderer.send(IPC.OVERLAY_MOUSE_IGNORE, ignore)
  },
}

contextBridge.exposeInMainWorld('overlayAPI', overlayAPI)

export type OverlayAPI = typeof overlayAPI
