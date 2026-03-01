import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve(__dirname, 'electron/main/index.ts')
      }
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'shared'),
        '@agents': resolve(__dirname, 'electron/agents')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/preload/index.ts'),
          overlay: resolve(__dirname, 'electron/preload/overlay.ts')
        }
      }
    }
  },
  renderer: {
    // Définir le root à 'src' pour englober les deux renderers
    root: resolve(__dirname, 'src'),
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/main-app'),
        '@shared': resolve(__dirname, 'shared')
      }
    },
    plugins: [react()],
    build: {
      outDir: resolve(__dirname, 'out/renderer'),
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main-app/index.html'),
          overlay: resolve(__dirname, 'src/overlay/index.html')
        }
      }
    }
  }
})
