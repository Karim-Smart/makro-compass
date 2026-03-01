import { create } from 'zustand'
import { IPC } from '../../../shared/ipc-channels'
import type { GameData, GameStatus, ObjectiveTimers } from '../../../shared/types'

interface GameState {
  isInGame: boolean
  champion: string | null
  gameData: GameData | null
  timers: ObjectiveTimers | null
  lastUpdate: number | null

  // Actions
  setGameStatus: (status: GameStatus) => void
  setGameData: (data: GameData) => void
  setTimers: (timers: ObjectiveTimers) => void
}

export const useGameStore = create<GameState>((set) => ({
  isInGame: false,
  champion: null,
  gameData: null,
  timers: null,
  lastUpdate: null,

  setGameStatus: (status) => set(status.isInGame
    ? { isInGame: true, champion: status.champion ?? null }
    // Fin de partie : on vide tout pour que l'UI ne montre plus les vieilles données
    : { isInGame: false, champion: null, gameData: null, timers: null }
  ),

  setGameData: (data) => set({
    gameData: data,
    isInGame: data.isInGame,
    champion: data.champion,
    lastUpdate: Date.now()
  }),

  setTimers: (timers) => set({ timers })
}))

// Brancher le store sur les événements IPC (appelé une seule fois au démarrage)
export function initGameStoreIpc(): void {
  const api = window.electronAPI

  api.on(IPC.GAME_STATUS, (status: unknown) => {
    useGameStore.getState().setGameStatus(status as GameStatus)
  })

  api.on(IPC.GAME_DATA, (data: unknown) => {
    useGameStore.getState().setGameData(data as GameData)
  })

  api.on(IPC.OVERLAY_TIMERS, (timers: unknown) => {
    useGameStore.getState().setTimers(timers as ObjectiveTimers)
  })
}
