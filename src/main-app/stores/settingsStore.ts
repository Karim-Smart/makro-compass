import { create } from 'zustand'
import { IPC } from '../../../shared/ipc-channels'
import type { UserSettings, CoachingStyle } from '../../../shared/types'
import { useCoachingStore } from './coachingStore'

interface SettingsState {
  settings: UserSettings
  updateSettings: (partial: Partial<UserSettings>) => void
  updateStyle: (style: CoachingStyle) => void
  applyPersistedSettings: (settings: UserSettings) => void
}

const DEFAULT_SETTINGS: UserSettings = {
  hotkey: 'F9',
  overlayOpacity: 0.9,
  overlayPosition: { x: 100, y: 100 },
  region: 'EUW',
  selectedStyle: 'LCK',
  overlayPanels: { stats: true, timers: true, advice: true, style: true, build: true, wincondition: false },
  voiceAlerts: true,
  voiceVolume: 0.8,
  shotcallerMode: false,
  customCoachTone: '',
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,

  updateSettings: (partial) => {
    set((state) => {
      const updated = { ...state.settings, ...partial }
      window.electronAPI.send(IPC.SETTINGS_UPDATE, partial)
      return { settings: updated }
    })
  },

  updateStyle: (style) => {
    set((state) => ({
      settings: { ...state.settings, selectedStyle: style }
    }))
    window.electronAPI.changeStyle(style)
  },

  // Applique les settings chargés depuis electron-store au démarrage
  applyPersistedSettings: (settings) => {
    set({ settings })
    // Synchroniser le style avec le coachingStore
    useCoachingStore.getState().setStyleLocal(settings.selectedStyle)
  }
}))

let _ipcInitialized = false

export function initSettingsStoreIpc(): void {
  if (_ipcInitialized) return
  _ipcInitialized = true
  window.electronAPI.on(IPC.SETTINGS_UPDATE, (settings: unknown) => {
    useSettingsStore.getState().applyPersistedSettings(settings as UserSettings)
  })
}
