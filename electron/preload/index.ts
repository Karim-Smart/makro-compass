import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import type { CoachingStyle } from '../../shared/types'

// API exposée au renderer de la fenêtre principale
const electronAPI = {
  // Écouter les événements du main process
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const validChannels = Object.values(IPC)
    if (validChannels.includes(channel as (typeof validChannels)[number])) {
      ipcRenderer.on(channel, (_event: IpcRendererEvent, ...args: unknown[]) => callback(...args))
    }
  },

  // Envoyer des commandes au main process (one-way)
  send: (channel: string, data?: unknown) => {
    const validChannels = [
      IPC.STYLE_CHANGE,
      IPC.OVERLAY_TOGGLE,
      IPC.SETTINGS_UPDATE,
      IPC.ROLE_CHANGE,
    ]
    if (validChannels.includes(channel as (typeof validChannels)[number])) {
      ipcRenderer.send(channel, data)
    }
  },

  // Requêtes avec réponse (invoke/handle)
  invoke: async (channel: string, data?: unknown): Promise<unknown> => {
    const validChannels = [
      IPC.SUBSCRIPTION_CHECK,
      IPC.ADVICE_HISTORY,
      IPC.QUOTA_STATUS
    ]
    if (validChannels.includes(channel as (typeof validChannels)[number])) {
      return ipcRenderer.invoke(channel, data)
    }
    return undefined
  },

  // Supprimer un listener
  removeListener: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, callback as Parameters<typeof ipcRenderer.removeListener>[1])
  },

  // Actions spécifiques
  changeStyle: (style: CoachingStyle) => {
    ipcRenderer.send(IPC.STYLE_CHANGE, style)
  },

  checkSubscription: () => {
    return ipcRenderer.invoke(IPC.SUBSCRIPTION_CHECK)
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// Typage pour TypeScript côté renderer
export type ElectronAPI = typeof electronAPI
