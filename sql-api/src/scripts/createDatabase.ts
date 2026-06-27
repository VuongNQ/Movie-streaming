import { Client as PgClient } from 'pg'
import { createConnection } from 'mysql2/promise'
import { config, assertRuntimeConfig } from '../config.js'

async function main(): Promise<void> {
  assertRuntimeConfig()

  if (config.dbType === 'mysql') {
    console.log(`Using MySQL driver to create database...`)
    
    const connection = await createConnection({
      host: config.dbHost,
      port: config.dbPort,
      user: config.dbUser,
      password: config.dbPassword,
      database: 'mysql',
    })

    try {
      const [rows] = await connection.query<any>(
        'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
        [config.dbName],
      )

      const exists = Array.isArray(rows) && rows.length > 0
      if (exists) {
        console.log(`Database already exists: ${config.dbName}`)
        return
      }

      await connection.query(`CREATE DATABASE \`${config.dbName.replace(/`/g, '``')}\``)
      console.log(`Database created: ${config.dbName}`)
    } finally {
      await connection.end()
    }
  } else {
    // PostgreSQL implementation (default)
    console.log(`Using PostgreSQL driver to create database...`)
    
    const client = new PgClient({
      host: config.dbHost,
      port: config.dbPort,
      user: config.dbUser,
      password: config.dbPassword,
      database: 'postgres',
    })

    await client.connect()
    try {
      const existsResult = await client.query<{ exists: boolean }>(
        'SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists',
        [config.dbName],
      )

      const exists = existsResult.rows[0]?.exists === true
      if (exists) {
        console.log(`Database already exists: ${config.dbName}`)
        return
      }

      await client.query(`CREATE DATABASE "${config.dbName.replace(/"/g, '""')}"`)
      console.log(`Database created: ${config.dbName}`)
    } finally {
      await client.end()
    }
  }
}

main().catch((error) => {
  console.error('Failed to create database.')
  console.error(error)
  process.exit(1)
})
