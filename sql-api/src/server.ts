import { app } from './app.js'
import { assertRuntimeConfig, config } from './config.js'
import { getPool } from './db.js'

async function main(): Promise<void> {
  assertRuntimeConfig()
  await getPool().query('SELECT 1')

  app.listen(config.port, () => {
    console.log(`sql-api listening on http://localhost:${config.port}`)
  })
}

main().catch((error) => {
  console.error('Failed to start sql-api.')
  console.error(error)
  process.exit(1)
})
