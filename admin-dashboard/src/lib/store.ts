import { create } from 'zustand'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import type { Unsubscribe } from 'firebase/auth'
import { auth, db } from './firebase'
import type { UserRole } from '../types'

interface AuthUser {
  uid: string
  email: string | null
  role: UserRole
}

interface AuthState {
  user: AuthUser | null
  loading: boolean
  initialized: boolean
  hasUnsavedMovieChanges: boolean
  init: () => Unsubscribe
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  setHasUnsavedMovieChanges: (value: boolean) => void
}

async function fetchRole(uid: string): Promise<UserRole> {
  const snapshot = await getDoc(doc(db, 'users', uid))

  if (!snapshot.exists()) {
    return 'guest'
  }

  const role = snapshot.data().role
  if (role === 'admin' || role === 'user' || role === 'guest') {
    return role
  }

  return 'guest'
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialized: false,
  hasUnsavedMovieChanges: false,

  init: () =>
    onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        set({ user: null, loading: false, initialized: true, hasUnsavedMovieChanges: false })
        return
      }

      set({ loading: true })
      const role = await fetchRole(currentUser.uid)

      set({
        user: {
          uid: currentUser.uid,
          email: currentUser.email,
          role,
        },
        loading: false,
        initialized: true,
      })
    }),

  login: async (email, password) => {
    set({ loading: true })
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },

  logout: async () => {
    set({ loading: true })
    try {
      await signOut(auth)
    } finally {
      set({ loading: false, hasUnsavedMovieChanges: false })
    }
  },

  setHasUnsavedMovieChanges: (value) => {
    set({ hasUnsavedMovieChanges: value })
  },
}))
