import bcrypt from 'bcryptjs'
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken'
import { config } from './config.js'
import { getPool } from './db.js'
import { AccountDisabledError, type AccessTokenClaims, type AuthenticatedUser, type UserRole } from './types/contracts.js'

interface UserWithPasswordRow {
  uid: string
  email: string
  username: string
  role: UserRole
  account_status: 'active' | 'disabled'
  password_hash: string
}

export async function authenticateWithPassword(email: string, password: string): Promise<AuthenticatedUser | null> {
  const normalizedEmail = email.trim().toLowerCase()
  const { rows } = await getPool().query<UserWithPasswordRow>(
    `
      SELECT uid, email, username, role, account_status, password_hash
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [normalizedEmail],
  )

  const user = rows[0]
  if (!user) {
    return null
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash)
  if (!isPasswordValid) {
    return null
  }

  if (user.account_status === 'disabled') {
    throw new AccountDisabledError()
  }

  return {
    uid: user.uid,
    email: user.email,
    username: user.username,
    role: user.role,
  }
}

export function issueAccessToken(user: AuthenticatedUser): string {
  const options: SignOptions = {
    expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'],
    subject: user.uid,
  }

  return jwt.sign(
    {
      uid: user.uid,
      email: user.email,
      role: user.role,
    },
    config.jwtSecret,
    options,
  )
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const claims = jwt.verify(token, config.jwtSecret)
  if (typeof claims === 'string') {
    throw new Error('Invalid token payload format')
  }

  const payload = claims as JwtPayload
  if (typeof payload.uid !== 'string' || typeof payload.email !== 'string' || typeof payload.role !== 'string') {
    throw new Error('Token payload missing required fields')
  }

  if (payload.role !== 'guest' && payload.role !== 'user' && payload.role !== 'admin') {
    throw new Error('Token payload has invalid role')
  }

  return {
    uid: payload.uid,
    email: payload.email,
    role: payload.role,
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}
