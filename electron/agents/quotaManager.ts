import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

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
  `)

  // Migration : ajouter priority si la table existait sans cette colonne
  try {
    db.exec(`ALTER TABLE advice_log ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium'`)
  } catch {
    // Colonne déjà présente, on ignore
  }

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
