# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication

Répondre en français. Expliquer étape par étape, clarifier le *pourquoi* avant le *quoi*.

## Build & Development Commands

```bash
npm run dev          # Démarre Electron + Vite en mode développement (HMR)
npm run build        # Build Vite (main + preload + renderer) → out/
npm run build:win    # Build + package Windows (NSIS + portable) → dist/
npm run gen:tray-icon  # Régénère resources/tray-icon.png (16x16)
```

Il n'y a **pas de linter configuré** ni de **framework de test**. Pas de commande lint/test disponible.

Le CI (`.github/workflows/build-windows.yml`) build et package sur Windows via `electron-builder --win --publish never`, déclenché par tags `v*` ou manuellement.

## Architecture

Application Electron avec **deux renderer processes** distincts (fenêtre principale + overlay en jeu) et un ensemble d'**agents** côté main process qui communiquent via IPC.

### Trois couches compilées séparément (electron-vite)

| Couche | Entrée | Sortie | Rôle |
|--------|--------|--------|------|
| **main** | `electron/main/index.ts` | `out/main/index.cjs` | Process principal Electron |
| **preload** | `electron/preload/index.ts` + `overlay.ts` | `out/preload/*.cjs` | Bridges contextIsolation (deux fichiers séparés) |
| **renderer** | `src/main-app/index.html` + `src/overlay/index.html` | `out/renderer/` | Deux SPAs React indépendantes |

Configuration dans `electron.vite.config.ts`. Les path aliases :
- `@shared` → `shared/` (main + renderer)
- `@agents` → `electron/agents/` (main seulement)
- `@renderer` → `src/main-app/` (renderer seulement)

### Fenêtre principale vs Overlay

- **Main window** : fenêtre classique 1200x800, chargée via `HashRouter` (obligatoire en Electron, pas BrowserRouter). 7 onglets : Région → Draft → Dashboard → Runes → Build → Classées → Paramètres.
- **Overlay** : **5 fenêtres BrowserWindow séparées** (stats, timers, advice, style, build), chacune `alwaysOnTop + frame:false`, positionnées absolument sur l'écran. Chaque fenêtre charge `overlay/index.html?panel=<name>` et affiche uniquement le composant correspondant. Le tout est show/hide via `windowManager.showOverlay()` / `hideOverlay()`.

### Agents (electron/agents/)

Modules côté main process qui tournent en boucle de polling ou timer :

- **riotAgent** : Polle la Riot Live Client API (`https://<host>:2999/liveclientdata/allgamedata`) toutes les 5s. Détecte début/fin de partie, parse les données brutes, déclenche les autres agents, broadcast `GAME_DATA` / `GAME_STATUS`. En WSL2, détecte automatiquement la gateway Windows via `ip route`.
- **aiCoachAgent** : Génère des conseils IA via Claude Haiku (`claude-haiku-4-5-20251001`, max 150 tokens). Cycle de 15s, avec cooldown et quota par tier. 4 styles de coaching (LCK/LEC/LCS/LPL) avec system prompts distincts dans `shared/constants.ts`.
- **timerAgent** : Calcule les timers de respawn Dragon/Baron/Herald à partir des événements de kill.
- **macroTipsEngine** : Génère des tips macro contextuels (sans appel API) basés sur le game state.
- **alertEngine** : Détecte des événements ponctuels (level spike, item spike...) et émet des alertes courtes (3s).
- **buildEngine** : Génère des recommandations d'items situationnels selon le profil ennemi (AP/AD/Tank).
- **lcuAgent** : Communique avec le LCU (League Client Update) local pour l'import de runes (PUT /lol-perks), détection du champion select, et lancement de replays.
- **quotaManager** : Gère le quota quotidien et l'historique via Better-SQLite3.
- **subscriptionAgent** : Gère les tiers d'abonnement (free/pro/elite).
- **reviewEngine** : Génère des timelines de coaching pour le replay.

### Communication IPC

Tous les noms de canaux sont centralisés dans `shared/ipc-channels.ts` (objet `IPC`). Trois patterns :

1. **send** (one-way renderer→main) : `STYLE_CHANGE`, `SETTINGS_UPDATE`, `OVERLAY_TOGGLE`, `IMPORT_RUNES`
2. **invoke/handle** (request-response) : `ADVICE_HISTORY`, `QUOTA_STATUS`, `RANKED_HISTORY`, `REVIEW_GENERATE`
3. **broadcastToWindows** (main→all renderers) : utilise une registry globale `(global).__windows` pour envoyer à toutes les fenêtres actives

Les preloads whitelistent strictement les canaux autorisés. Le preload principal expose `window.electronAPI` (send + invoke + on + removeListener), le preload overlay expose `window.overlayAPI` (on + changeStyle + importRunes + setIgnoreMouseEvents).

### State Management (renderers)

Zustand stores dans `src/main-app/stores/` : `gameStore`, `coachingStore`, `subscriptionStore`, `overlayStore`, `settingsStore`, `draftStore`. Chaque store a une fonction `initXxxStoreIpc()` appelée une seule fois au mount (garde `_ipcInitialized` pour éviter les doublons).

L'overlay n'utilise pas Zustand — son state est local dans `src/overlay/App.tsx` avec des listeners IPC via `useEffect` + cleanup.

## Pièges connus

- **Preload .cjs** : electron-vite compile les preloads en `.cjs`, pas `.js`. `windowManager.ts` référence `../preload/index.cjs` et `../preload/overlay.cjs`.
- **HashRouter obligatoire** : BrowserRouter ne fonctionne pas en Electron (le pathname est le chemin du fichier HTML).
- **WSL2** : Le riotAgent détecte WSL2 et utilise la gateway Windows comme host pour la Riot API. Le `app.disableHardwareAcceleration()` est nécessaire sous WSL2 pour éviter un crash GPU.
- **Riot API self-signed** : `app.commandLine.appendSwitch('ignore-certificate-errors')` + `rejectUnauthorized: false` dans le client axios.
- **API key chiffrée** : La clé Anthropic est stockée via `safeStorage.encryptString()` (chiffrement OS), jamais en clair dans electron-store.
- **Listener cleanup** : Les preloads utilisent un `listenerMap` (Map callback→wrapper) pour permettre `removeListener` correct, car les callbacks sont wrappés.
- **broadcastToWindows null safety** : Toujours vérifier `win && !win.isDestroyed()` avant d'envoyer.

## Hotkeys

- **F9** : Toggle visibilité de tous les panneaux overlay (global shortcut)
- **F6** : Import des runes standard dans le client LoL via LCU API

## Stack technique

Electron 27, React 18, TypeScript, Vite 5 (via electron-vite), Tailwind CSS 3, Zustand 5, Better-SQLite3, electron-store, @anthropic-ai/sdk, axios, react-router-dom 6.
