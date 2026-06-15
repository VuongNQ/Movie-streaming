import { Client } from 'pg'
import { config, assertRuntimeConfig } from '../config.js'

async function main(): Promise<void> {
  assertRuntimeConfig()

  const client = new Client({
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

main().catch((error) => {
  console.error('Failed to create database.')
  console.error(error)
  process.exit(1)
})
