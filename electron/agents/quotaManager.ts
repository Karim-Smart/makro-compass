import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import type { RankedQueueType, RankedGame, GameData } from '../../shared/types'

// ─── Initialisation SQLite ────────────────────────────────────────────────────

let db: Database.Database | null = null

function getDb(): Database.Database {
  if (db) return db

  const dbPath = join(app.getPath('userData'), 'quota.db')
  db = new Database(dbPath)

  // Création de la table si elle n'existe pas
  db.exec(`
    CREATE TABLE IF NOT EXISTS quota (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      used INTEGER NOT NULL DEFAULT 0,
      reset_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS advice_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      style TEXT NOT NULL,
      game_time INTEGER NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      text TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ranked_games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      queue_type TEXT NOT NULL,
      champion TEXT NOT NULL,
      kills INTEGER NOT NULL,
      deaths INTEGER NOT NULL,
      assists INTEGER NOT NULL,
      cs INTEGER NOT NULL,
      gold INTEGER NOT NULL,
      game_time INTEGER NOT NULL,
      team_kills INTEGER NOT NULL,
      enemy_kills INTEGER NOT NULL,
      ward_score INTEGER NOT NULL,
      level INTEGER NOT NULL,
      items TEXT NOT NULL,
      allies TEXT NOT NULL,
      enemies TEXT NOT NULL,
      result TEXT NOT NULL,
      roast TEXT NOT NULL
    );
  `)

  // Migration : ajouter priority si la table existait sans cette colonne
  try {
    db.exec(`ALTER TABLE advice_log ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium'`)
  } catch {
    // Colonne déjà présente, on ignore
  }

  // Migration : ajouter game_id pour déduplication des imports LCU
  try {
    db.exec(`ALTER TABLE ranked_games ADD COLUMN game_id TEXT`)
  } catch {
    // Colonne déjà présente, on ignore
  }
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ranked_game_id
    ON ranked_games(game_id)
    WHERE game_id IS NOT NULL
  `)

  // Insérer la ligne de quota si elle n'existe pas
  const tomorrow = Date.now() + 86_400_000
  db.prepare(`
    INSERT OR IGNORE INTO quota (id, used, reset_at)
    VALUES (1, 0, ?)
  `).run(tomorrow)

  return db
}

// ─── Interface publique ───────────────────────────────────────────────────────

export interface QuotaStatus {
  used: number
  resetAt: number
}

/**
 * Retourne le nombre de conseils utilisés aujourd'hui.
 * Remet à zéro automatiquement si la date de reset est dépassée.
 */
export function getQuotaStatus(): QuotaStatus {
  try {
    const database = getDb()
    const row = database.prepare('SELECT used, reset_at FROM quota WHERE id = 1').get() as
      | { used: number; reset_at: number }
      | undefined

    if (!row) {
      return { used: 0, resetAt: Date.now() + 86_400_000 }
    }

    // Reset automatique si la date est dépassée
    if (Date.now() > row.reset_at) {
      const nextReset = Date.now() + 86_400_000
      database.prepare('UPDATE quota SET used = 0, reset_at = ? WHERE id = 1').run(nextReset)
      return { used: 0, resetAt: nextReset }
    }

    return { used: row.used, resetAt: row.reset_at }
  } catch (err) {
    console.error('[QuotaManager] Erreur lecture quota:', (err as Error).message)
    return { used: 0, resetAt: Date.now() + 86_400_000 }
  }
}

/**
 * Incrémente le compteur de quota de 1.
 */
export function incrementQuota(): void {
  try {
    getDb().prepare('UPDATE quota SET used = used + 1 WHERE id = 1').run()
  } catch (err) {
    console.error('[QuotaManager] Erreur incrément quota:', (err as Error).message)
  }
}

/**
 * Enregistre un conseil dans le log historique.
 */
export function logAdvice(style: string, gameTime: number, priority: string, text: string): void {
  try {
    getDb().prepare(`
      INSERT INTO advice_log (timestamp, style, game_time, priority, text)
      VALUES (?, ?, ?, ?, ?)
    `).run(Date.now(), style, gameTime, priority, text)
  } catch (err) {
    console.error('[QuotaManager] Erreur log advice:', (err as Error).message)
  }
}

/**
 * Retourne l'historique des conseils (les 100 derniers).
 */
export function getAdviceHistory(): Array<{
  timestamp: number
  style: string
  gameTime: number
  priority: string
  text: string
}> {
  try {
    return getDb()
      .prepare('SELECT timestamp, style, game_time as gameTime, priority, text FROM advice_log ORDER BY timestamp DESC LIMIT 100')
      .all() as Array<{ timestamp: number; style: string; gameTime: number; priority: string; text: string }>
  } catch (err) {
    console.error('[QuotaManager] Erreur lecture historique:', (err as Error).message)
    return []
  }
}

// ─── Parties classées ────────────────────────────────────────────────────────

/**
 * Génère une phrase de tacle ou compliment basée sur les stats.
 */
function generateRoast(
  result: 'win' | 'loss',
  kills: number,
  deaths: number,
  assists: number,
  cs: number,
  gameTime: number,
  teamKills: number,
  wardScore: number,
): string {
  const kda = deaths === 0 ? kills + assists : (kills + assists) / deaths
  const csPerMin = gameTime > 0 ? cs / (gameTime / 60) : 0
  const kp = teamKills > 0 ? ((kills + assists) / teamKills) * 100 : 0

  // ── Win ──
  if (result === 'win') {
    if (kda >= 8 && deaths <= 1)
      return 'Tu l\'as 1v9 celle-la, monstre absolu. Diff totale.'
    if (kda >= 5)
      return 'Clean ! Meme Faker serait jaloux de cette perf.'
    if (deaths === 0)
      return 'Pas une seule mort ? Respect... ou tu campais sous tour ?'
    if (kp >= 70)
      return 'T\'etais partout sur la map, vrai MVP de cette game.'
    if (csPerMin >= 8)
      return 'Farm de psychopathe, t\'as aspire toute la map.'
    if (deaths >= 8)
      return 'T\'as win mais avec ce nombre de morts, remercie ton equipe.'
    if (kda < 1.5)
      return 'Win is win, mais avoue t\'etais poids mort la.'
    return 'GG propre, continue comme ca.'
  }

  // ── Loss ──
  if (kda >= 5 && kp >= 50)
    return 'Diff jungle/bot, c\'est pas ta faute... enfin presque.'
  if (kda >= 3)
    return 'T\'as bien joue mais tes mates ont decide de int. Classique.'
  if (deaths >= 10)
    return 'T\'offrais des kills comme des cadeaux de Noel.'
  if (deaths >= 7 && kills <= 2)
    return 'T\'etais vraiment un noob dans cette game, pas d\'excuse.'
  if (csPerMin < 4 && gameTime > 600)
    return 'Meme un minion aurait mieux farm que toi.'
  if (kp < 20 && teamKills > 5)
    return 'T\'etais ou pendant les fights ? AFK farming ?'
  if (wardScore <= 2 && gameTime > 900)
    return 'Zero vision, zero macro. Achete des wards, c\'est gratuit.'
  if (kills >= 5 && deaths >= 8)
    return 'Beaucoup de kills mais encore plus de morts. Le bouton B existe.'
  return 'C\'est en forgeant qu\'on devient forgeron. Ou pas.'
}

/**
 * Sauvegarde une partie classée dans la base locale.
 */
export function saveRankedGame(
  gameData: GameData,
  queueType: RankedQueueType,
  result: 'win' | 'loss',
): void {
  try {
    const roast = generateRoast(
      result,
      gameData.kda.kills,
      gameData.kda.deaths,
      gameData.kda.assists,
      gameData.cs,
      gameData.gameTime,
      gameData.teamKills,
      gameData.wardScore,
    )

    getDb().prepare(`
      INSERT INTO ranked_games (
        timestamp, queue_type, champion, kills, deaths, assists,
        cs, gold, game_time, team_kills, enemy_kills,
        ward_score, level, items, allies, enemies, result, roast
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      Date.now(),
      queueType,
      gameData.champion,
      gameData.kda.kills,
      gameData.kda.deaths,
      gameData.kda.assists,
      gameData.cs,
      gameData.gold,
      Math.floor(gameData.gameTime),
      gameData.teamKills,
      gameData.enemyKills,
      gameData.wardScore,
      gameData.level,
      JSON.stringify(gameData.items),
      JSON.stringify(gameData.allies),
      JSON.stringify(gameData.enemies),
      result,
      roast,
    )

    console.log(`[QuotaManager] Partie classée sauvegardée — ${gameData.champion} ${result} (${queueType})`)
  } catch (err) {
    console.error('[QuotaManager] Erreur sauvegarde ranked:', (err as Error).message)
  }
}

/**
 * Sauvegarde directe d'une partie à partir de données brutes (import LCU).
 * Utilise INSERT OR IGNORE sur game_id pour éviter les doublons.
 * Retourne true si la partie a été insérée, false si elle existait déjà.
 */
export function saveRankedGameDirect(data: {
  gameId: string
  timestamp: number
  queueType: RankedQueueType
  champion: string
  kills: number
  deaths: number
  assists: number
  cs: number
  gold: number
  gameTime: number
  teamKills: number
  enemyKills: number
  wardScore: number
  level: number
  items: string[]
  allies: string[]
  enemies: string[]
  result: 'win' | 'loss'
}): boolean {
  try {
    const roast = generateRoast(
      data.result, data.kills, data.deaths, data.assists,
      data.cs, data.gameTime, data.teamKills, data.wardScore,
    )

    const stmt = getDb().prepare(`
      INSERT OR IGNORE INTO ranked_games (
        game_id, timestamp, queue_type, champion, kills, deaths, assists,
        cs, gold, game_time, team_kills, enemy_kills,
        ward_score, level, items, allies, enemies, result, roast
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const res = stmt.run(
      data.gameId,
      data.timestamp,
      data.queueType,
      data.champion,
      data.kills, data.deaths, data.assists,
      data.cs, data.gold, Math.floor(data.gameTime),
      data.teamKills, data.enemyKills,
      data.wardScore, data.level,
      JSON.stringify(data.items),
      JSON.stringify(data.allies),
      JSON.stringify(data.enemies),
      data.result,
      roast,
    )

    if (res.changes > 0) {
      console.log(`[QuotaManager] Partie importée — ${data.champion} ${data.result} (${data.queueType})`)
      return true
    }
    return false  // déjà présente
  } catch (err) {
    console.error('[QuotaManager] Erreur import direct:', (err as Error).message)
    return false
  }
}

/**
 * Retourne l'historique des parties classées (les 50 dernières).
 * Filtré par type de queue si spécifié.
 */
export function getRankedHistory(queueType?: RankedQueueType): RankedGame[] {
  try {
    const database = getDb()
    let rows: unknown[]

    if (queueType) {
      rows = database.prepare(
        'SELECT * FROM ranked_games WHERE queue_type = ? ORDER BY timestamp DESC LIMIT 50'
      ).all(queueType)
    } else {
      rows = database.prepare(
        'SELECT * FROM ranked_games ORDER BY timestamp DESC LIMIT 50'
      ).all()
    }

    return (rows as Array<Record<string, unknown>>).map((row) => ({
      id: row.id as number,
      timestamp: row.timestamp as number,
      queueType: row.queue_type as RankedQueueType,
      champion: row.champion as string,
      kills: row.kills as number,
      deaths: row.deaths as number,
      assists: row.assists as number,
      cs: row.cs as number,
      gold: row.gold as number,
      gameTime: row.game_time as number,
      teamKills: row.team_kills as number,
      enemyKills: row.enemy_kills as number,
      wardScore: row.ward_score as number,
      level: row.level as number,
      items: JSON.parse(row.items as string) as string[],
      allies: JSON.parse(row.allies as string) as string[],
      enemies: JSON.parse(row.enemies as string) as string[],
      result: row.result as 'win' | 'loss',
      roast: row.roast as string,
    }))
  } catch (err) {
    console.error('[QuotaManager] Erreur lecture ranked:', (err as Error).message)
    return []
  }
}
