import type { UserRole } from './contracts.js'

declare global {
  namespace Express {
    interface Request {
      auth?: {
        uid: string
        role: UserRole
        email: string
      }
    }
  }
}

export {}
