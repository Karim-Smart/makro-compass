/// <reference types="vite/client" />

import type { CoachingStyle } from '../../shared/types'

declare global {
  interface Window {
    overlayAPI: {
      on: (channel: string, callback: (...args: unknown[]) => void) => void
      removeListener: (channel: string, callback: (...args: unknown[]) => void) => void
      changeStyle: (style: CoachingStyle) => void
      importRunes: (variant: string) => void
      refreshBuild: () => void
      setIgnoreMouseEvents: (ignore: boolean) => void
    }
  }
}
