import { create } from 'zustand'
import { IPC } from '../../../shared/ipc-channels'
import type { SubscriptionStatus } from '../../../shared/types'
import { canAccess as checkAccess, type GatedFeature } from '../../../shared/feature-gates'

interface SubscriptionState {
  status: SubscriptionStatus | null
  isLoading: boolean

  // Actions
  setStatus: (status: SubscriptionStatus) => void
  setLoading: (value: boolean) => void
  refresh: () => void
  canAccess: (feature: GatedFeature) => boolean
}

const DEFAULT_STATUS: SubscriptionStatus = {
  tier: 'free',
  isActive: true,
  expiresAt: null,
  quotaUsed: 0,
  quotaMax: 1,
  nextResetAt: Date.now() + 86_400_000 // +24h
}

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  status: DEFAULT_STATUS,
  isLoading: false,

  setStatus: (status) => set({ status, isLoading: false }),

  setLoading: (value) => set({ isLoading: value }),

  refresh: () => {
    set({ isLoading: true })
    window.electronAPI.invoke(IPC.SUBSCRIPTION_CHECK)
      .then((status) => {
        if (status) useSubscriptionStore.getState().setStatus(status as SubscriptionStatus)
      })
      .catch(() => set({ isLoading: false }))
  },

  canAccess: (feature: GatedFeature) => {
    const tier = useSubscriptionStore.getState().status?.tier ?? 'free'
    return checkAccess(feature, tier)
  }
}))

let _ipcInitialized = false

export function initSubscriptionStoreIpc(): void {
  if (_ipcInitialized) return
  _ipcInitialized = true
  const api = window.electronAPI

  // Statut envoyé par le main au démarrage ou après génération d'un conseil
  api.on(IPC.SUBSCRIPTION_STATUS, (status: unknown) => {
    useSubscriptionStore.getState().setStatus(status as SubscriptionStatus)
  })
}
