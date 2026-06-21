import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg'
import mysql, { type ResultSetHeader } from 'mysql2/promise'
import { config } from './config.js'

// Type definitions for unified interface
export interface UnifiedQueryResult<T = any> {
  rows: T[]
  rowCount: number | null
}

export interface UnifiedClient {
  query<T = any>(text: string, values?: any[]): Promise<UnifiedQueryResult<T>>
  release?(): void
  commit?(): Promise<void>
  rollback?(): Promise<void>
}

export interface UnifiedPool {
  query<T = any>(text: string, values?: any[]): Promise<UnifiedQueryResult<T>>
  connect(): Promise<UnifiedClient>
}

// Determine which database driver to use
const DB_TYPE = (process.env.DB_TYPE || 'pg').toLowerCase()

// Helper function to convert PostgreSQL-style placeholders ($1, $2) to MySQL-style (?)
function convertPlaceholders(sql: string): string {
  if (DB_TYPE === 'mysql') {
    // Replace $1, $2, $3, etc. with ?
    return sql.replace(/\$\d+/g, '?')
  }
  return sql
}

// PostgreSQL Implementation
class PgPoolWrapper implements UnifiedPool {
  private pgPool: Pool

  constructor(pgPool: Pool) {
    this.pgPool = pgPool
  }

  async query<T = any>(text: string, values?: any[]): Promise<UnifiedQueryResult<T>> {
    // Cast to bypass strict pg type constraints
    const result = await (this.pgPool.query as any)(text, values)
    return {
      rows: result.rows,
      rowCount: result.rowCount,
    }
  }

  async connect(): Promise<UnifiedClient> {
    const pgClient = await this.pgPool.connect()
    return new PgClientWrapper(pgClient)
  }
}

class PgClientWrapper implements UnifiedClient {
  private pgClient: PoolClient

  constructor(pgClient: PoolClient) {
    this.pgClient = pgClient
  }

  async query<T = any>(text: string, values?: any[]): Promise<UnifiedQueryResult<T>> {
    // Cast to bypass strict pg type constraints
    const result = await (this.pgClient.query as any)(text, values)
    return {
      rows: result.rows,
      rowCount: result.rowCount,
    }
  }

  release(): void {
    this.pgClient.release()
  }

  async commit(): Promise<void> {
    await this.pgClient.query('COMMIT')
  }

  async rollback(): Promise<void> {
    await this.pgClient.query('ROLLBACK')
  }
}

// MySQL Implementation
class MysqlPoolWrapper implements UnifiedPool {
  private mysqlPool: mysql.Pool

  constructor(mysqlPool: mysql.Pool) {
    this.mysqlPool = mysqlPool
  }

  async query<T = any>(text: string, values?: any[]): Promise<UnifiedQueryResult<T>> {
    const convertedSql = convertPlaceholders(text)
    // Cast to bypass strict mysql2 type constraints
    const [rows] = await (this.mysqlPool.query as any)(convertedSql, values)
    return {
      rows: Array.isArray(rows) ? rows : [],
      rowCount: Array.isArray(rows) ? rows.length : 0,
    }
  }

  async connect(): Promise<UnifiedClient> {
    const connection = await this.mysqlPool.getConnection()
    return new MysqlClientWrapper(connection)
  }
}

class MysqlClientWrapper implements UnifiedClient {
  private connection: mysql.PoolConnection

  constructor(connection: mysql.PoolConnection) {
    this.connection = connection
  }

  async query<T = any>(text: string, values?: any[]): Promise<UnifiedQueryResult<T>> {
    const convertedSql = convertPlaceholders(text)
    // Cast to bypass strict mysql2 type constraints
    const [rows] = await (this.connection.query as any)(convertedSql, values)
    return {
      rows: Array.isArray(rows) ? rows : [],
      rowCount: Array.isArray(rows) ? rows.length : 0,
    }
  }

  async commit(): Promise<void> {
    await this.connection.commit()
  }

  async rollback(): Promise<void> {
    await this.connection.rollback()
  }

  release(): void {
    this.connection.release()
  }
}

// Global pool instance
let pool: UnifiedPool | undefined

// Factory function to create the appropriate pool
function createPool(): UnifiedPool {
  if (DB_TYPE === 'mysql') {
    const mysqlPool = mysql.createPool({
      host: config.dbHost,
      port: config.dbPort,
      database: config.dbName,
      user: config.dbUser,
      password: config.dbPassword,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    })
    return new MysqlPoolWrapper(mysqlPool)
  } else {
    // Default to PostgreSQL
    const pgPool = new Pool({
      host: config.dbHost,
      port: config.dbPort,
      database: config.dbName,
      user: config.dbUser,
      password: config.dbPassword,
    })
    return new PgPoolWrapper(pgPool)
  }
}

export function getPool(): UnifiedPool {
  if (!pool) {
    pool = createPool()
  }
  return pool
}

export async function withTransaction<T>(work: (client: UnifiedClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.commit?.()
    return result
  } catch (error) {
    await client.rollback?.()
    throw error
  } finally {
    client.release?.()
  }
}
