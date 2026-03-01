/**
 * Interfaces TypeScript partagées entre le main process et les renderers.
 */

// Styles de coaching disponibles
export type CoachingStyle = 'LCK' | 'LEC' | 'LCS' | 'LPL'

// Rôles joueur
export type PlayerRole = 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT'

// État du champion select (draft)
export interface DraftState {
  phase: 'BAN_PICK' | 'FINALIZATION' | 'NONE'
  myTeam: DraftPick[]
  theirTeam: DraftPick[]
  assignedPosition: string
}

export interface DraftPick {
  championId: number
  championName: string
  assignedPosition: string
  completed: boolean
}

// Recommandation de pick
export interface ChampionRecommendation {
  champion: string
  reason: string
  detailedReason: string   // Explication riche et contextuelle pour le carrousel
  score: number
  runes: RuneSetup
}

export interface RuneSetup {
  keystone: string
  primary: string
  secondary: string
  tip: string
}

// Tiers d'abonnement
export type SubscriptionTier = 'free' | 'pro' | 'elite'

// Données brutes d'une partie League of Legends
export interface GameData {
  isInGame: boolean
  champion: string
  level: number
  kda: {
    kills: number
    deaths: number
    assists: number
  }
  cs: number
  gold: number
  gameTime: number // en secondes
  teamGold: number
  enemyGold: number
  objectives: {
    dragonStacks: number
    enemyDragonStacks: number
    baronActive: boolean
    heraldActive: boolean
    dragonSoul: string | null       // 'Infernal' | 'Mountain' | 'Ocean' | 'Cloud' | 'Hextech' | 'Chemtech' | null
    elderActive: boolean
  }
  // Tours détruites
  towers: {
    allyDestroyed: number
    enemyDestroyed: number
  }
  // Items du joueur (noms)
  items: string[]
  // Kills par équipe
  teamKills: number
  enemyKills: number
  // Composition des équipes (champions, pas les noms de joueurs)
  allies: string[]
  enemies: string[]
  // Mode de jeu : CLASSIC, ARAM, PRACTICETOOL, URF, etc.
  gameMode: string
  // Ward score du joueur
  wardScore: number
  // Matchup de lane (adversaire direct)
  matchup: {
    champion: string
    level: number
    levelDiff: number   // positif = on est ahead, négatif = behind
    position: string    // TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY
    isDead: boolean
    respawnTimer: number // secondes avant respawn (0 si vivant)
  } | null
}

// Alerte courte (3s) pour événements in-game
export interface GameAlert {
  text: string
  type: 'info' | 'warning' | 'danger' | 'success'
}

// Statut de la partie (résumé léger)
export interface GameStatus {
  isInGame: boolean
  champion?: string
  gameTime?: number
}

// Conseil généré par l'IA
export interface CoachAdvice {
  text: string
  style: CoachingStyle
  priority: 'low' | 'medium' | 'high'
  timestamp: number
  gameTime: number
}

// Timers des objectifs
export interface ObjectiveTimers {
  dragon: {
    nextSpawn: number | null  // timestamp Unix
    isDead: boolean
    type?: string            // Infernal, Cloud, etc.
  }
  baron: {
    nextSpawn: number | null
    isDead: boolean
    available: boolean  // false avant 20 min de jeu (Baron n'existe pas encore)
  }
  herald: {
    nextSpawn: number | null
    isDead: boolean
    available: boolean       // herald disparaît à 20 min
  }
}

// Statut de l'abonnement
export interface SubscriptionStatus {
  tier: SubscriptionTier
  isActive: boolean
  expiresAt: number | null  // timestamp Unix
  quotaUsed: number
  quotaMax: number | null   // null = illimité (elite)
  nextResetAt: number       // timestamp Unix (reset quotidien)
}

// Paramètres utilisateur
export interface UserSettings {
  hotkey: string            // Par défaut 'F9'
  overlayOpacity: number    // 0 à 1
  overlayPosition: { x: number; y: number }
  region: string            // 'EUW', 'NA', 'KR', etc.
  selectedStyle: CoachingStyle
  apiKey?: string
}

// ─── Runes complètes ─────────────────────────────────────────────────────────

export interface FullRunePage {
  name: string
  primaryTreeId: number
  subTreeId: number
  selectedPerkIds: number[]  // 9 perk IDs : 4 primary + 2 secondary + 3 stat shards
  variant: 'standard' | 'offensive' | 'defensive'
}

export interface RunePageSet {
  standard: FullRunePage
  offensive: FullRunePage
  defensive: FullRunePage
}

// ─── Build recommandé ────────────────────────────────────────────────────────

export interface EnemyDamageProfile {
  apCount: number
  adCount: number
  tankCount: number
  healCount: number
  assassinCount: number
  dominantType: 'ap' | 'ad' | 'mixed' | 'tank'
}

export interface RecommendedItem {
  name: string
  itemId: number
  reason: string
  situational: boolean
}

export interface ChampionBuild {
  champion: string
  coreItems: RecommendedItem[]
  boots: RecommendedItem
  situationalItems: RecommendedItem[]
  tip: string
}

export interface BuildRecommendations {
  myBuild: ChampionBuild
  enemyProfile: EnemyDamageProfile
  gamePhase: 'early' | 'mid' | 'late'
  style: CoachingStyle
}

// ─── Partie classée enregistrée ──────────────────────────────────────────────

export type RankedQueueType = 'RANKED_SOLO' | 'RANKED_FLEX'

export interface RankedGame {
  id: number
  timestamp: number
  queueType: RankedQueueType
  champion: string
  kills: number
  deaths: number
  assists: number
  cs: number
  gold: number
  gameTime: number          // secondes
  teamKills: number
  enemyKills: number
  wardScore: number
  level: number
  items: string[]           // JSON parsé
  allies: string[]          // JSON parsé
  enemies: string[]         // JSON parsé
  result: 'win' | 'loss'
  roast: string             // phrase de tacle/compliment
}

// Événement IPC générique
export interface IpcPayload<T> {
  data: T
  timestamp: number
}
