import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore'
import { Timestamp } from 'firebase/firestore'
import { db, firebaseRuntimeConfig } from './firebase'
import type { AuthPreflightDiagnostic, Device, DeviceInput, Movie, MovieInput, User } from '../types'

function mapFirestoreWriteError(error: unknown): Error {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'permission-denied'
  ) {
    return new Error(
      `Missing or insufficient permissions. Verify Firestore rules for movies writes and confirm admin role in users/{uid}. Runtime target: project=${firebaseRuntimeConfig.projectId}, database=${firebaseRuntimeConfig.databaseId}.`,
    )
  }

  if (error instanceof Error) {
    return error
  }

  return new Error('Firestore write failed.')
}

function buildMovieId(title: string): string {
  const randomSuffix = doc(collection(db, 'movies')).id
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  return `${slug || 'movie'}-${randomSuffix}`
}

function toIsoString(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (value instanceof Timestamp) {
    return value.toDate().toISOString()
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  return new Date().toISOString()
}

function stripUndefinedValues<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedValues(item)) as T
  }

  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {}
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (nestedValue === undefined) {
        continue
      }

      output[key] = stripUndefinedValues(nestedValue)
    }

    return output as T
  }

  return value
}

function normalizeMovieFromSnapshot(id: string, data: MovieInput): Movie {
  return {
    id,
    ...data,
    created_at: data.created_at ? toIsoString(data.created_at) : undefined,
    last_updated: data.last_updated ? toIsoString(data.last_updated) : undefined,
  }
}

export const firestore = {
  async getMovies(): Promise<Movie[]> {
    const snapshot = await getDocs(query(collection(db, 'movies'), orderBy('title', 'asc')))
    return snapshot.docs.map((entry) => normalizeMovieFromSnapshot(entry.id, entry.data() as MovieInput))
  },

  async getMovieById(id: string): Promise<Movie> {
    const snapshot = await getDoc(doc(db, 'movies', id))

    if (!snapshot.exists()) {
      throw new Error('Movie not found')
    }

    return normalizeMovieFromSnapshot(snapshot.id, snapshot.data() as MovieInput)
  },

  async createMovie(payload: MovieInput): Promise<Movie> {
    const now = new Date().toISOString()
    const id = buildMovieId(payload.title)
    const firestorePayload = stripUndefinedValues({
      ...payload,
      id,
      created_at: payload.created_at ?? now,
      last_updated: now,
    })
    try {
      await setDoc(doc(db, 'movies', id), firestorePayload)
    } catch (error) {
      throw mapFirestoreWriteError(error)
    }
    return normalizeMovieFromSnapshot(id, firestorePayload as MovieInput)
  },

  async updateMovie(id: string, payload: Partial<MovieInput>): Promise<void> {
    const restPayload = { ...payload }
    delete restPayload.created_at
    // Keep doc id in the stored payload so strict movie rules can validate updates.
    const firestorePayload = stripUndefinedValues({
      ...restPayload,
      id,
      last_updated: new Date().toISOString(),
    })
    try {
      await updateDoc(doc(db, 'movies', id), firestorePayload)
    } catch (error) {
      throw mapFirestoreWriteError(error)
    }
  },

  async deleteMovie(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'movies', id))
    } catch (error) {
      throw mapFirestoreWriteError(error)
    }
  },

  async getUsers(): Promise<User[]> {
    const snapshot = await getDocs(query(collection(db, 'users'), orderBy('created_at', 'desc')))

    return snapshot.docs.map((entry) => {
      const data = entry.data() as Omit<User, 'uid'>
      return {
        uid: entry.id,
        username: data.username,
        role: data.role,
        created_at: toIsoString(data.created_at),
      }
    })
  },

  async getUserById(uid: string): Promise<User> {
    const snapshot = await getDoc(doc(db, 'users', uid))

    if (!snapshot.exists()) {
      throw new Error('User not found')
    }

    const data = snapshot.data() as Omit<User, 'uid'>

    return {
      uid,
      username: data.username,
      role: data.role,
      created_at: toIsoString(data.created_at),
    }
  },

  async getDevices(uid: string): Promise<Device[]> {
    const snapshot = await getDocs(collection(db, `users/${uid}/devices`))

    return snapshot.docs.map((entry) => ({
      id: entry.id,
      ...(entry.data() as DeviceInput),
    }))
  },

  async getAuthPreflight(uid: string): Promise<AuthPreflightDiagnostic> {
    const snapshot = await getDoc(doc(db, 'users', uid))

    if (!snapshot.exists()) {
      return {
        uid,
        user_doc_exists: false,
        role_in_user_doc: null,
        is_admin_by_user_doc: false,
      }
    }

    const roleValue = snapshot.data().role
    const role = typeof roleValue === 'string' ? roleValue : null

    return {
      uid,
      user_doc_exists: true,
      role_in_user_doc: role,
      is_admin_by_user_doc: role === 'admin',
    }
  },
}
