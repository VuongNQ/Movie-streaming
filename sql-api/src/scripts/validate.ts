async function main(): Promise<void> {
  await import('../config.js')
  await import('../db.js')
  await import('../auth.js')
  await import('../app.js')
  await import('../routes/authRoutes.js')
  await import('../routes/adminRoutes.js')
  await import('../migrations/runMigrations.js')

  console.log('sql-api module validation passed.')
}

main().catch((error) => {
  console.error('sql-api module validation failed.')
  console.error(error)
  process.exit(1)
})
