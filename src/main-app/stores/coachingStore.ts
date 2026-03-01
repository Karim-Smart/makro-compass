import { create } from 'zustand'
import { IPC } from '../../../shared/ipc-channels'
import type { CoachAdvice, CoachingStyle } from '../../../shared/types'

interface CoachingState {
  selectedStyle: CoachingStyle
  lastAdvice: CoachAdvice | null
  history: CoachAdvice[]
  isGenerating: boolean

  // Actions
  setStyle: (style: CoachingStyle) => void
  setStyleLocal: (style: CoachingStyle) => void  // Sans IPC (pour init depuis settings)
  addAdvice: (advice: CoachAdvice) => void
  setGenerating: (value: boolean) => void
}

export const useCoachingStore = create<CoachingState>((set) => ({
  selectedStyle: 'LCK',
  lastAdvice: null,
  history: [],
  isGenerating: false,

  setStyle: (style) => {
    set({ selectedStyle: style })
    // Envoyer au main process pour que l'agent utilise le bon style
    window.electronAPI.changeStyle(style)
  },

  setStyleLocal: (style) => {
    set({ selectedStyle: style })
  },

  addAdvice: (advice) => set((state) => ({
    lastAdvice: advice,
    history: [advice, ...state.history].slice(0, 100) // Garder les 100 derniers
  })),

  setGenerating: (value) => set({ isGenerating: value })
}))

let _ipcInitialized = false

export function initCoachingStoreIpc(): void {
  if (_ipcInitialized) return
  _ipcInitialized = true
  const api = window.electronAPI

  api.on(IPC.OVERLAY_SHOW_ADVICE, (advice: unknown) => {
    useCoachingStore.getState().addAdvice(advice as CoachAdvice)
  })
}
