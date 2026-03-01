import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import type { CoachingStyle } from '../../shared/types'

// Map pour associer les callbacks originaux aux wrappers IPC (nécessaire pour removeListener)
const listenerMap = new Map<(...args: unknown[]) => void, (event: IpcRendererEvent, ...args: unknown[]) => void>()

const VALID_ON_CHANNELS = [
  IPC.OVERLAY_SHOW_ADVICE,
  IPC.OVERLAY_SHOW_ALERT,
  IPC.OVERLAY_TIMERS,
  IPC.OVERLAY_TOGGLE,
  IPC.GAME_DATA,
  IPC.GAME_STATUS,
  IPC.STYLE_CHANGE,
  IPC.OVERLAY_BUILD,
  IPC.OVERLAY_RUNES,
  IPC.OVERLAY_REVIEW,
  IPC.REPLAY_DETECTED,
  IPC.SETTINGS_UPDATE,
]

const overlayAPI = {
  // Écouter les événements envoyés depuis le main process
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    if (VALID_ON_CHANNELS.includes(channel as (typeof VALID_ON_CHANNELS)[number])) {
      const wrapper = (_event: IpcRendererEvent, ...args: unknown[]) => callback(...args)
      listenerMap.set(callback, wrapper)
      ipcRenderer.on(channel, wrapper)
    }
  },

  removeListener: (channel: string, callback: (...args: unknown[]) => void) => {
    const wrapper = listenerMap.get(callback)
    if (wrapper) {
      ipcRenderer.removeListener(channel, wrapper)
      listenerMap.delete(callback)
    }
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
