import * as SQLite from 'expo-sqlite'

const DB_NAME = 'apex.db'

let dbInstance: SQLite.SQLiteDatabase | null = null

/**
 * Open (or return the cached handle for) the local SQLite database
 * and ensure all required tables exist.
 */
export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance

  const db = await SQLite.openDatabaseAsync(DB_NAME)

  // Create tables if they do not already exist.
  // Each statement is separated by a semicolon so execAsync
  // processes them as a batch.
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sale_price REAL,
      cost_price REAL,
      category TEXT,
      gst_treatment TEXT DEFAULT 'GST',
      track_inventory INTEGER DEFAULT 0,
      current_stock INTEGER DEFAULT 0,
      last_modified_at TEXT
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT,
      email TEXT,
      phone TEXT,
      abn TEXT,
      last_modified_at TEXT
    );

    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pin_hash TEXT,
      role TEXT,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS pending_orders (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      synced INTEGER DEFAULT 0,
      sync_error TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  dbInstance = db
  return db
}
