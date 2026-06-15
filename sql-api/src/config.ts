import dotenv from 'dotenv'

dotenv.config()

function readEnv(name: string, fallback?: string): string | undefined {
  const value = process.env[name]
  if (typeof value === 'string' && value.trim().length > 0) {
    return value
  }

  return fallback
}

export const config = {
  port: Number(readEnv('PORT', '4100')),
  dbHost: readEnv('DB_HOST', 'localhost') ?? 'localhost',
  dbPort: Number(readEnv('DB_PORT', '5432') ?? '5432'),
  dbName: readEnv('DB_NAME', 'movie_streaming') ?? 'movie_streaming',
  dbUser: readEnv('DB_USER', '') ?? '',
  dbPassword: readEnv('DB_PASSWORD', '') ?? '',
  jwtSecret: readEnv('JWT_SECRET', '') ?? '',
  jwtExpiresIn: readEnv('JWT_EXPIRES_IN', '2h') ?? '2h',
  passwordResetLinkBase: readEnv('PASSWORD_RESET_LINK_BASE', 'http://localhost:5173/reset-password') ?? 'http://localhost:5173/reset-password',
}

export function assertRuntimeConfig(): void {
  const missing: string[] = []

  if (!config.dbHost) missing.push('DB_HOST')
  if (!Number.isFinite(config.dbPort) || config.dbPort <= 0) missing.push('DB_PORT')
  if (!config.dbName) missing.push('DB_NAME')
  if (!config.dbUser) missing.push('DB_USER')
  if (!config.dbPassword) missing.push('DB_PASSWORD')

  if (!config.jwtSecret) {
    missing.push('JWT_SECRET')
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}
