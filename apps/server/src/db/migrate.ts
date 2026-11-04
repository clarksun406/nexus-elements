import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Pool, PoolClient } from 'pg'

const MIGRATION_ID = '001_init.sql'

export async function migrate(pool: Pool): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`)
    const existing = await client.query('SELECT 1 FROM schema_migrations WHERE id = $1', [MIGRATION_ID])
    if ((existing.rowCount ?? 0) > 0) return
    const sqlPath = fileURLToPath(new URL('./migrations/001_init.sql', import.meta.url))
    const sql = readFileSync(sqlPath, 'utf8')
    await applyMigration(client, sql)
  } finally {
    client.release()
  }
}

export async function applyMigration(client: PoolClient, sql: string): Promise<void> {
  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [MIGRATION_ID])
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}
