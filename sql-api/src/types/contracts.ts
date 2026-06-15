export type UserRole = 'guest' | 'user' | 'admin'

export interface AuthenticatedUser {
  uid: string
  email: string
  username: string
  role: UserRole
}

export interface AccessTokenClaims {
  uid: string
  email: string
  role: UserRole
}

export class AccountDisabledError extends Error {
  constructor() {
    super('Account is disabled')
    this.name = 'AccountDisabledError'
  }
}
