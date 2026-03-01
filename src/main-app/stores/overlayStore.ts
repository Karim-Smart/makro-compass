import { create } from 'zustand'
import { IPC } from '../../../shared/ipc-channels'

interface OverlayState {
  isVisible: boolean
  opacity: number
  position: { x: number; y: number }

  // Actions
  setVisible: (value: boolean) => void
  setOpacity: (value: number) => void
  setPosition: (pos: { x: number; y: number }) => void
  toggle: () => void
}

export const useOverlayStore = create<OverlayState>((set, get) => ({
  isVisible: true,
  opacity: 0.9,
  position: { x: 100, y: 100 },

  setVisible: (value) => set({ isVisible: value }),

  setOpacity: (value) => set({ opacity: Math.max(0.1, Math.min(1, value)) }),

  setPosition: (pos) => set({ position: pos }),

  toggle: () => {
    const next = !get().isVisible
    set({ isVisible: next })
    window.electronAPI.send(IPC.OVERLAY_TOGGLE, next)
  }
}))

let _ipcInitialized = false

export function initOverlayStoreIpc(): void {
  if (_ipcInitialized) return
  _ipcInitialized = true
  const api = window.electronAPI

  // Hotkey F9 appuyé dans le main process
  api.on(IPC.OVERLAY_TOGGLE, (isVisible: unknown) => {
    useOverlayStore.getState().setVisible(isVisible as boolean)
  })
}
