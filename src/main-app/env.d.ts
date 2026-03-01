/// <reference types="vite/client" />

import type { CoachingStyle } from '../../shared/types'

declare global {
  interface Window {
    electronAPI: {
      on: (channel: string, callback: (...args: unknown[]) => void) => void
      send: (channel: string, data?: unknown) => void
      invoke: (channel: string, data?: unknown) => Promise<unknown>
      removeListener: (channel: string, callback: (...args: unknown[]) => void) => void
      changeStyle: (style: CoachingStyle) => void
      checkSubscription: () => Promise<unknown>
    }
    overlayAPI: {
      on: (channel: string, callback: (...args: unknown[]) => void) => void
      removeListener: (channel: string, callback: (...args: unknown[]) => void) => void
    }
  }
}
