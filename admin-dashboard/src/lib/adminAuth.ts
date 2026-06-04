import { httpsCallable } from 'firebase/functions'
import { functionsClient } from './firebase'
import type {
  AdminDeleteAuthUserInput,
  AdminGeneratePasswordResetLinkInput,
  AdminSetUserDisabledInput,
} from '../types'

interface GeneratePasswordResetLinkResult {
  uid: string
  email: string
  reset_link: string
}

interface DeleteAuthUserResult {
  uid: string
  deleted_auth_user: boolean
  deleted_profile: boolean
  deleted_devices_count: number
}

function mapCallableError(error: unknown): Error {
  if (error instanceof Error) {
    return error
  }

  return new Error('Admin auth operation failed.')
}

export const adminAuth = {
  async setUserDisabled(payload: AdminSetUserDisabledInput): Promise<{ uid: string; disabled: boolean }> {
    try {
      const callable = httpsCallable<AdminSetUserDisabledInput, { uid: string; disabled: boolean }>(
        functionsClient,
        'adminSetUserDisabled',
      )
      const response = await callable(payload)
      return response.data
    } catch (error) {
      throw mapCallableError(error)
    }
  },

  async generatePasswordResetLink(payload: AdminGeneratePasswordResetLinkInput): Promise<GeneratePasswordResetLinkResult> {
    try {
      const callable = httpsCallable<AdminGeneratePasswordResetLinkInput, GeneratePasswordResetLinkResult>(
        functionsClient,
        'adminGeneratePasswordResetLink',
      )
      const response = await callable(payload)
      return response.data
    } catch (error) {
      throw mapCallableError(error)
    }
  },

  async deleteAuthUser(payload: AdminDeleteAuthUserInput): Promise<DeleteAuthUserResult> {
    try {
      const callable = httpsCallable<AdminDeleteAuthUserInput, DeleteAuthUserResult>(functionsClient, 'adminDeleteAuthUser')
      const response = await callable(payload)
      return response.data
    } catch (error) {
      throw mapCallableError(error)
    }
  },
}
