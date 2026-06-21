import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertRuntimeConfig, config } from '../config.js'
import { getPool } from '../db.js'

interface MigrationRow {
  id: string
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Creates the schema_migrations table for tracking applied migrations.
 * Uses database-agnostic SQL that works with both PostgreSQL and MySQL.
 *
 * - PostgreSQL: CURRENT_TIMESTAMP(6) works natively
 * - MySQL: CURRENT_TIMESTAMP(6) with microsecond precision, uses VARCHAR for TEXT primary key
 * - Both databases support standard SQL syntax used here
 */
async function ensureMigrationTable(): Promise<void> {
  // MySQL requires VARCHAR with length for PRIMARY KEY; PostgreSQL accepts TEXT
  const sql = config.dbType === 'mysql'
    ? `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
      )
    `
    : `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
      )
    `
  
  await getPool().query(sql)
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

/**
 * Applies a single migration file within a transaction.
 * Uses parameterized queries via db.ts which handles driver-specific placeholders.
 *
 * Flow:
 * 1. BEGIN transaction
 * 2. Execute migration SQL file
 * 3. Record migration ID in schema_migrations using parameterized query ($1 PostgreSQL-style)
 * 4. COMMIT on success, ROLLBACK on error
 * 5. Ensure client is released back to pool
 *
 * Note: db.ts.convertPlaceholders converts $1, $2... to ? for MySQL automatically.
 */
async function applyMigration(fileName: string): Promise<void> {
  const migrationId = fileName.replace(/\.sql$/i, '')
  const sqlContent = await fs.readFile(path.join(__dirname, fileName), 'utf8')

  // Remove line comments (--) and split statements by semicolon
  const lines = sqlContent.split('\n')
  const cleanedLines = lines
    .map(line => {
      // Remove line comments starting with --
      const commentIndex = line.indexOf('--')
      return commentIndex >= 0 ? line.substring(0, commentIndex) : line
    })
    .join('\n')

  // Split by semicolon and filter empty statements
  const statements = cleanedLines
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0)

  const client = await getPool().connect()
  try {
    // Start transaction
    await client.query('BEGIN')

    // Execute each migration SQL statement separately
    for (const statement of statements) {
      if (statement.trim().length > 0) {
        await client.query(statement)
      }
    }

    // Record the applied migration using parameterized query
    // Uses PostgreSQL-style $1 placeholder; db.ts converts to ? for MySQL
    await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [migrationId])

    // Commit the transaction
    await client.commit?.()
    console.log(`Applied migration: ${migrationId}`)
  } catch (error) {
    // Rollback on error
    await client.rollback?.()
    throw error
  } finally {
    // Always release the client back to the pool
    client.release?.()
  }
}

export async function runMigrations(): Promise<void> {
  assertRuntimeConfig()

  // Log database type for debugging
  console.log(`Running migrations for database: ${config.dbType}`)

  await ensureMigrationTable()
  const applied = await loadAppliedMigrationIds()
  const files = await loadMigrationFiles()

  if (files.length === 0) {
    console.log('No migration files found.')
    return
  }

  console.log(`Found ${files.length} migration file(s).`)

  for (const fileName of files) {
    const migrationId = fileName.replace(/\.sql$/i, '')
    if (applied.has(migrationId)) {
      console.log(`Skipping already-applied migration: ${migrationId}`)
      continue
    }

    await applyMigration(fileName)
  }

  console.log('Migrations are up to date.')
}

const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === __filename

if (isDirectExecution) {
  runMigrations().catch(async (error) => {
    console.error('Migration failed.')
    console.error(error)
    process.exit(1)
  })
}
