import dotenv from 'dotenv'

dotenv.config()

function readEnv(name: string, fallback?: string): string | undefined {
  const value = process.env[name]
  if (typeof value === 'string' && value.trim().length > 0) {
    return value
  }

  return fallback
}

// Validate and normalize dbType
const dbTypeEnv = (readEnv('DB_TYPE', 'pg') ?? 'pg').toLowerCase()
if (!['pg', 'mysql'].includes(dbTypeEnv)) {
  throw new Error(`Invalid DB_TYPE: "${dbTypeEnv}". Must be "pg" or "mysql".`)
}

// Determine default port based on database type
const defaultPort = dbTypeEnv === 'mysql' ? '3306' : '5432'

export const config = {
  port: Number(readEnv('PORT', '4100')),
  dbHost: readEnv('DB_HOST', 'localhost') ?? 'localhost',
  dbPort: Number(readEnv('DB_PORT', defaultPort) ?? defaultPort),
  dbName: readEnv('DB_NAME', 'movie_streaming') ?? 'movie_streaming',
  dbUser: readEnv('DB_USER', '') ?? '',
  dbPassword: readEnv('DB_PASSWORD', '') ?? '',
  dbType: dbTypeEnv as 'pg' | 'mysql',
  jwtSecret: readEnv('JWT_SECRET', '') ?? '',
  jwtExpiresIn: readEnv('JWT_EXPIRES_IN', '2h') ?? '2h',
  passwordResetLinkBase: readEnv('PASSWORD_RESET_LINK_BASE', 'http://localhost:5173/reset-password') ?? 'http://localhost:5173/reset-password',
}

/**
 * Logs a warning if the port seems mismatched with the selected database type.
 * (Helpful for debugging configuration issues.)
 */
function warnIfPortMismatched(): void {
  const standardPorts: Record<'pg' | 'mysql', number> = { pg: 5432, mysql: 3306 }
  const expectedPort = standardPorts[config.dbType]
  if (config.dbPort !== expectedPort) {
    console.warn(
      `Warning: DB_TYPE is "${config.dbType}" but DB_PORT is ${config.dbPort} ` +
      `(standard: ${expectedPort}). Using custom port if intentional.`,
    )
  }
}

export function assertRuntimeConfig(): void {
  const missing: string[] = []

  if (!config.dbHost) missing.push('DB_HOST')
  if (!config.dbName) missing.push('DB_NAME')
  if (!config.dbUser) missing.push('DB_USER')
  if (!config.dbPassword) missing.push('DB_PASSWORD')

  if (!config.jwtSecret) {
    missing.push('JWT_SECRET')
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  // Log warnings for configuration insights (does not throw)
  warnIfPortMismatched()
}
