/**
 * Noms des canaux IPC entre le main process et les renderers.
 * Centralisés ici pour éviter les fautes de frappe.
 */
export const IPC = {
  // Main → Renderer : état de la partie
  GAME_STATUS: 'game:status',
  GAME_DATA: 'game:data',

  // Main → Overlay : affichage
  OVERLAY_SHOW_ADVICE: 'overlay:show-advice',
  OVERLAY_SHOW_ALERT: 'overlay:show-alert',
  OVERLAY_TIMERS: 'overlay:timers',
  OVERLAY_TOGGLE: 'overlay:toggle',

  // Main → Renderer : abonnement
  SUBSCRIPTION_STATUS: 'subscription:status',

  // Main → Renderer : draft
  DRAFT_UPDATE: 'draft:update',

  // Renderer → Main : actions utilisateur
  STYLE_CHANGE: 'style:change',
  SUBSCRIPTION_CHECK: 'subscription:check',
  SETTINGS_UPDATE: 'settings:update',
  ROLE_CHANGE: 'role:change',

  // Renderer → Main : requêtes de données (invoke)
  ADVICE_HISTORY: 'advice:history',
  QUOTA_STATUS: 'quota:status',

  // Main → Overlay : runes et build
  OVERLAY_BUILD: 'overlay:build',
  OVERLAY_RUNES: 'overlay:runes',

  // Renderer → Main : import runes + refresh build
  IMPORT_RUNES: 'import:runes',
  REFRESH_BUILD: 'refresh:build',

  // Overlay → Main : contrôle des souris (pour les boutons interactifs)
  OVERLAY_MOUSE_IGNORE: 'overlay:mouse-ignore',

  // Renderer → Main : historique parties classées (invoke)
  RANKED_HISTORY: 'ranked:history',

  // Review mode (replay coaching)
  REPLAY_DETECTED: 'replay:detected',
  OVERLAY_REVIEW: 'overlay:review',
  LAUNCH_REPLAY: 'launch:replay',
  REVIEW_GENERATE: 'review:generate',

  // Import automatique de l'historique LCU au démarrage
  RANKED_IMPORT_DONE: 'ranked:import-done',

  // Déclencher manuellement l'import LCU (invoke → retourne le nb de parties importées)
  RANKED_HISTORY_IMPORT: 'ranked:history-import',
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
