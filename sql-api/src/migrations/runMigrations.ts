import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { QueryResultRow } from 'pg'
import { assertRuntimeConfig } from '../config.js'
import { getPool } from '../db.js'

interface MigrationRow extends QueryResultRow {
  id: string
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function ensureMigrationTable(): Promise<void> {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

async function loadAppliedMigrationIds(): Promise<Set<string>> {
  const { rows } = await getPool().query<MigrationRow>('SELECT id FROM schema_migrations')
  return new Set(rows.map((row) => row.id))
}

async function loadMigrationFiles(): Promise<string[]> {
  const files = await fs.readdir(__dirname)
  return files
    .filter((name) => /^\d+_.+\.sql$/i.test(name))
    .sort((left, right) => left.localeCompare(right))
}

async function applyMigration(fileName: string): Promise<void> {
  const migrationId = fileName.replace(/\.sql$/i, '')
  const sql = await fs.readFile(path.join(__dirname, fileName), 'utf8')

  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [migrationId])
    await client.query('COMMIT')
    console.log(`Applied migration: ${migrationId}`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function runMigrations(): Promise<void> {
  assertRuntimeConfig()
  await ensureMigrationTable()
  const applied = await loadAppliedMigrationIds()
  const files = await loadMigrationFiles()

  for (const fileName of files) {
    const migrationId = fileName.replace(/\.sql$/i, '')
    if (applied.has(migrationId)) {
      continue
    }

    await applyMigration(fileName)
  }

  console.log('Migrations are up to date.')
  await getPool().end()
}

const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === __filename

if (isDirectExecution) {
  runMigrations().catch(async (error) => {
    console.error('Migration failed.')
    console.error(error)
    try {
      await getPool().end()
    } catch {
      // noop
    }
    process.exit(1)
  })
}
