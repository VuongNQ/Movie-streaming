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
import { db } from './firebase'
import type { Device, DeviceInput, Movie, MovieInput, User } from '../types'

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

export const firestore = {
  async getMovies(): Promise<Movie[]> {
    const snapshot = await getDocs(query(collection(db, 'movies'), orderBy('title', 'asc')))
    return snapshot.docs.map((entry) => ({ id: entry.id, ...(entry.data() as MovieInput) }))
  },

  async getMovieById(id: string): Promise<Movie> {
    const snapshot = await getDoc(doc(db, 'movies', id))

    if (!snapshot.exists()) {
      throw new Error('Movie not found')
    }

    return { id: snapshot.id, ...(snapshot.data() as MovieInput) }
  },

  async createMovie(payload: MovieInput): Promise<Movie> {
    const id = buildMovieId(payload.title)
    const firestorePayload = stripUndefinedValues({ ...payload, id })
    await setDoc(doc(db, 'movies', id), firestorePayload)
    return { ...payload, id }
  },

  async updateMovie(id: string, payload: Partial<MovieInput>): Promise<void> {
    const firestorePayload = stripUndefinedValues(payload)
    await updateDoc(doc(db, 'movies', id), firestorePayload)
  },

  async deleteMovie(id: string): Promise<void> {
    await deleteDoc(doc(db, 'movies', id))
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
}
