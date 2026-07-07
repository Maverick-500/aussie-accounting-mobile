import type { SQLiteDatabase } from 'expo-sqlite'
import { api } from './api'

/* ------------------------------------------------------------------ */
/* Sync-state helpers                                                  */
/* ------------------------------------------------------------------ */

const LAST_SYNC_KEY = 'last_sync_at'

export async function getLastSyncTime(
  db: SQLiteDatabase,
): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM sync_state WHERE key = ?',
    LAST_SYNC_KEY,
  )
  return row?.value ?? null
}

export async function setLastSyncTime(
  db: SQLiteDatabase,
  time: string,
): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)',
    LAST_SYNC_KEY,
    time,
  )
}

/* ------------------------------------------------------------------ */
/* Server  →  local sync                                               */
/* ------------------------------------------------------------------ */

interface SyncPayload {
  products?: Array<Record<string, unknown>>
  contacts?: Array<Record<string, unknown>>
  staff?: Array<Record<string, unknown>>
  syncedAt: string
}

/**
 * Pull changes from the server since the last successful sync,
 * upsert them into the local SQLite database, and update the
 * sync timestamp.
 */
export async function syncFromServer(db: SQLiteDatabase): Promise<void> {
  const since = await getLastSyncTime(db)
  const query = since ? `?since=${encodeURIComponent(since)}` : ''

  const data = await api<SyncPayload>(`/sync${query}`)

  // Upsert products
  if (data.products?.length) {
    for (const p of data.products) {
      await db.runAsync(
        `INSERT OR REPLACE INTO products
           (id, name, sale_price, cost_price, category, gst_treatment,
            track_inventory, current_stock, last_modified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        p.id as string,
        p.name as string,
        (p.sale_price as number) ?? null,
        (p.cost_price as number) ?? null,
        (p.category as string) ?? null,
        (p.gst_treatment as string) ?? 'GST',
        (p.track_inventory as number) ?? 0,
        (p.current_stock as number) ?? 0,
        (p.last_modified_at as string) ?? null,
      )
    }
  }

  // Upsert contacts
  if (data.contacts?.length) {
    for (const c of data.contacts) {
      await db.runAsync(
        `INSERT OR REPLACE INTO contacts
           (id, name, type, email, phone, abn, last_modified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        c.id as string,
        c.name as string,
        (c.type as string) ?? null,
        (c.email as string) ?? null,
        (c.phone as string) ?? null,
        (c.abn as string) ?? null,
        (c.last_modified_at as string) ?? null,
      )
    }
  }

  // Upsert staff
  if (data.staff?.length) {
    for (const s of data.staff) {
      await db.runAsync(
        `INSERT OR REPLACE INTO staff
           (id, name, pin_hash, role, active)
         VALUES (?, ?, ?, ?, ?)`,
        s.id as string,
        s.name as string,
        (s.pin_hash as string) ?? null,
        (s.role as string) ?? null,
        (s.active as number) ?? 1,
      )
    }
  }

  await setLastSyncTime(db, data.syncedAt)
}

/* ------------------------------------------------------------------ */
/* Pending orders  →  server                                           */
/* ------------------------------------------------------------------ */

interface PendingRow {
  id: string
  payload: string
}

/**
 * Push all unsynced orders to the server. On success each row is
 * marked synced; on failure the error is recorded against the row.
 * Returns the number of successfully synced orders.
 */
export async function syncPendingOrders(
  db: SQLiteDatabase,
): Promise<number> {
  const rows = await db.getAllAsync<PendingRow>(
    'SELECT id, payload FROM pending_orders WHERE synced = 0',
  )

  let syncedCount = 0

  for (const row of rows) {
    try {
      const body = JSON.parse(row.payload)
      await api('/orders', { method: 'POST', body })
      await db.runAsync(
        'UPDATE pending_orders SET synced = 1, sync_error = NULL WHERE id = ?',
        row.id,
      )
      syncedCount++
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown sync error'
      await db.runAsync(
        'UPDATE pending_orders SET sync_error = ? WHERE id = ?',
        message,
        row.id,
      )
    }
  }

  return syncedCount
}

/* ------------------------------------------------------------------ */
/* Helpers for the POS screen                                          */
/* ------------------------------------------------------------------ */

/**
 * Count the number of pending (unsynced) orders in the local queue.
 */
export async function getPendingOrderCount(
  db: SQLiteDatabase,
): Promise<number> {
  const row = await db.getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM pending_orders WHERE synced = 0',
  )
  return row?.cnt ?? 0
}
