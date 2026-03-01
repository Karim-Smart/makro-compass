import { create } from 'zustand'
import type { PlayerRole, DraftState, ChampionRecommendation } from '../../../shared/types'
import { getRecommendations, getDraftCompTips } from '../../../shared/draft-data'
import { IPC } from '../../../shared/ipc-channels'

interface DraftStoreState {
  role: PlayerRole
  draftState: DraftState | null
  allyPicks: string[]         // Picks alliés (manuels ou LCU)
  enemyPicks: string[]        // Picks ennemis (manuels ou LCU)
  recommendations: ChampionRecommendation[]
  compTips: string[]
  lcuConnected: boolean
}

interface DraftStoreActions {
  setRole: (role: PlayerRole) => void
  setDraftState: (state: DraftState) => void
  setLcuConnected: (connected: boolean) => void
  setAllyPick: (index: number, champion: string) => void
  setEnemyPick: (index: number, champion: string) => void
  clearAll: () => void
  refreshRecommendations: () => void
  init: () => void
}

export const useDraftStore = create<DraftStoreState & DraftStoreActions>((set, get) => ({
  role: 'MID',
  draftState: null,
  allyPicks: ['', '', '', '', ''],
  enemyPicks: ['', '', '', '', ''],
  recommendations: [],
  compTips: [],
  lcuConnected: false,

  setRole: (role) => {
    set({ role })
    window.electronAPI?.send(IPC.ROLE_CHANGE, role)
    get().refreshRecommendations()
  },

  setDraftState: (draftState) => {
    set({ draftState, lcuConnected: draftState.phase !== 'NONE' })

    // Auto-remplir les picks depuis le LCU
    if (draftState.myTeam.length > 0) {
      const allyPicks = draftState.myTeam.map((p) => p.championName || '')
      const currentAllies = get().allyPicks
      const mergedAllies = allyPicks.map((p, i) => p || currentAllies[i] || '')
      set({ allyPicks: mergedAllies })
    }

    if (draftState.theirTeam.length > 0) {
      const enemyPicks = draftState.theirTeam.map((p) => p.championName || '')
      const currentEnemies = get().enemyPicks
      const mergedEnemies = enemyPicks.map((p, i) => p || currentEnemies[i] || '')
      set({ enemyPicks: mergedEnemies })
    }

    // Auto-détecter le rôle assigné
    if (draftState.assignedPosition) {
      const posMap: Record<string, PlayerRole> = {
        TOP: 'TOP', JUNGLE: 'JUNGLE', MIDDLE: 'MID', MID: 'MID',
        BOTTOM: 'ADC', ADC: 'ADC', UTILITY: 'SUPPORT', SUPPORT: 'SUPPORT',
      }
      const detected = posMap[draftState.assignedPosition]
      if (detected && detected !== get().role) {
        set({ role: detected })
      }
    }

    get().refreshRecommendations()
  },

  setLcuConnected: (connected) => set({ lcuConnected: connected }),

  setAllyPick: (index, champion) => {
    const picks = [...get().allyPicks]
    picks[index] = champion
    set({ allyPicks: picks })
    get().refreshRecommendations()
  },

  setEnemyPick: (index, champion) => {
    const picks = [...get().enemyPicks]
    picks[index] = champion
    set({ enemyPicks: picks })
    get().refreshRecommendations()
  },

  clearAll: () => {
    set({
      allyPicks: ['', '', '', '', ''],
      enemyPicks: ['', '', '', '', ''],
      recommendations: [],
      compTips: [],
    })
  },

  refreshRecommendations: () => {
    const { enemyPicks, allyPicks, role } = get()
    const filledEnemies = enemyPicks.filter(Boolean)
    const filledAllies = allyPicks.filter(Boolean)
    if (filledEnemies.length === 0 && filledAllies.length === 0) {
      set({ recommendations: [], compTips: [] })
      return
    }
    const recommendations = getRecommendations(filledEnemies, role, filledAllies)
    const compTips = getDraftCompTips(filledEnemies)
    set({ recommendations, compTips })
  },

  init: () => {
    if (!window.electronAPI) return
    if ((window as unknown as { _draftIpcInit?: boolean })._draftIpcInit) return
    ;(window as unknown as { _draftIpcInit?: boolean })._draftIpcInit = true
    window.electronAPI.on(IPC.DRAFT_UPDATE, (state: unknown) => {
      get().setDraftState(state as DraftState)
    })
  },
}))
