import type { NextFunction, Request, Response } from 'express'
import { verifyAccessToken } from '../auth.js'

function readBearerToken(headerValue?: string): string | null {
  if (!headerValue || typeof headerValue !== 'string') {
    return null
  }

  const [scheme, token] = headerValue.split(' ')
  if (scheme !== 'Bearer' || !token) {
    return null
  }

  return token
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = readBearerToken(req.headers.authorization)
  if (!token) {
    res.status(401).json({ message: 'Authentication is required.' })
    return
  }

  try {
    const claims = verifyAccessToken(token)
    req.auth = {
      uid: claims.uid,
      role: claims.role,
      email: claims.email,
    }
    next()
  } catch {
    res.status(401).json({ message: 'Invalid or expired token.' })
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth || req.auth.role !== 'admin') {
    res.status(403).json({ message: 'Admin role is required.' })
    return
  }

  next()
}
