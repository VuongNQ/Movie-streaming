import {
  collection,
  deleteField,
  doc,
  documentId,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  deleteDoc,
} from 'firebase/firestore'
import { Timestamp } from 'firebase/firestore'
import { db, firebaseRuntimeConfig } from './firebase'
import type { AuthPreflightDiagnostic, Device, DeviceInput, Movie, MovieInput, MovieSearchFilters, User } from '../types'

const movieTitleCollator = new Intl.Collator('vi', { sensitivity: 'base' })
const FIRESTORE_QUERY_OPERAND_LIMIT = 10

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenizeSearchText(value: string): string[] {
  return normalizeSearchText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
}

function buildSearchKeywords(value?: string): string[] | undefined {
  if (!value) {
    return undefined
  }

  const keywords = new Set<string>()

  for (const token of tokenizeSearchText(value)) {
    for (let index = 1; index <= token.length; index += 1) {
      keywords.add(token.slice(0, index))
    }
  }

  return keywords.size > 0 ? Array.from(keywords) : undefined
}

function enrichMovieSearchFields<T extends Pick<MovieInput, 'title_raw' | 'title_vietnamese'>>(payload: T): T & Pick<MovieInput, 'title_search_keywords' | 'title_vietnamese_search_keywords'> {
  return {
    ...payload,
    title_search_keywords: buildSearchKeywords(payload.title_raw),
    title_vietnamese_search_keywords: buildSearchKeywords(payload.title_vietnamese),
  }
}

function getMovieDisplayTitle(movie: Pick<Movie, 'title_raw' | 'title_vietnamese'>): string {
  return movie.title_vietnamese && movie.title_vietnamese.trim().length > 0 ? movie.title_vietnamese : movie.title_raw
}

function sortMovies(movies: Movie[]): Movie[] {
  return [...movies].sort((left, right) => movieTitleCollator.compare(getMovieDisplayTitle(left), getMovieDisplayTitle(right)))
}

function normalizeYearFilter(year?: number): number | undefined {
  return typeof year === 'number' && Number.isInteger(year) ? year : undefined
}

function normalizeMovieFilters(filters?: Partial<MovieSearchFilters>): MovieSearchFilters {
  return {
    title: filters?.title?.trim() ?? '',
    genres: Array.isArray(filters?.genres)
      ? Array.from(new Set(filters.genres.map((genre) => genre.trim()).filter((genre) => genre.length > 0))).sort()
      : [],
    year: normalizeYearFilter(filters?.year),
  }
}

function matchesTitleTokens(movie: Movie, titleQuery: string): boolean {
  const tokens = tokenizeSearchText(titleQuery)
  if (tokens.length === 0) {
    return true
  }

  const searchSources = [movie.title_search_keywords, movie.title_vietnamese_search_keywords]
    .flatMap((keywords) => keywords ?? [])

  if (searchSources.length > 0) {
    return tokens.every((token) => searchSources.includes(token))
  }

  const fallbackText = normalizeSearchText([movie.title_raw, movie.title_vietnamese].filter(Boolean).join(' '))
  return tokens.every((token) => fallbackText.split(' ').some((word) => word.startsWith(token)))
}

function matchesFilters(movie: Movie, filters: MovieSearchFilters): boolean {
  const hasGenreMatch = filters.genres.length === 0 || filters.genres.some((genre) => movie.genres.includes(genre))
  const hasYearMatch = filters.year === undefined || movie.year === filters.year
  return hasGenreMatch && hasYearMatch && matchesTitleTokens(movie, filters.title)
}

async function fetchMoviesByDocumentIds(ids: string[]): Promise<Movie[]> {
  if (ids.length === 0) {
    return []
  }

  const chunks: string[][] = []
  for (let index = 0; index < ids.length; index += FIRESTORE_QUERY_OPERAND_LIMIT) {
    chunks.push(ids.slice(index, index + FIRESTORE_QUERY_OPERAND_LIMIT))
  }

  const snapshots = await Promise.all(
    chunks.map((chunk) => getDocs(query(collection(db, 'movies'), where(documentId(), 'in', chunk)))),
  )

  return snapshots.flatMap((snapshot) => snapshot.docs.map((entry) => normalizeMovieFromSnapshot(entry.id, entry.data() as MovieInput)))
}

async function fetchMovieIdsForTitleToken(token: string): Promise<string[]> {
  const keywordQueries = [
    query(collection(db, 'movies'), where('title_search_keywords', 'array-contains', token)),
    query(collection(db, 'movies'), where('title_vietnamese_search_keywords', 'array-contains', token)),
  ]

  const snapshots = await Promise.all(keywordQueries.map((constraint) => getDocs(constraint)))
  return Array.from(new Set(snapshots.flatMap((snapshot) => snapshot.docs.map((entry) => entry.id))))
}

async function fetchMoviesByStructuredFilters(filters: MovieSearchFilters): Promise<Movie[]> {
  const genreChunks: string[][] =
    filters.genres.length > 0
      ? Array.from({ length: Math.ceil(filters.genres.length / FIRESTORE_QUERY_OPERAND_LIMIT) }, (_value, index) =>
          filters.genres.slice(index * FIRESTORE_QUERY_OPERAND_LIMIT, (index + 1) * FIRESTORE_QUERY_OPERAND_LIMIT),
        )
      : [[]]

  const snapshots = await Promise.all(
    genreChunks.map((genreChunk) => {
      const constraints = [] as Array<ReturnType<typeof where>>

      if (genreChunk.length > 0) {
        constraints.push(where('genres', 'array-contains-any', genreChunk))
      }

      if (filters.year !== undefined) {
        constraints.push(where('year', '==', filters.year))
      }

      return getDocs(query(collection(db, 'movies'), ...constraints))
    }),
  )

  const moviesById = new Map<string, Movie>()
  for (const snapshot of snapshots) {
    for (const entry of snapshot.docs) {
      moviesById.set(entry.id, normalizeMovieFromSnapshot(entry.id, entry.data() as MovieInput))
    }
  }

  return Array.from(moviesById.values())
}

function normalizeOptionalTitleVietnamese(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

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

function buildMovieId(titleRaw: string): string {
  const randomSuffix = doc(collection(db, 'movies')).id
  const slug = titleRaw
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
  const normalizedTitleRaw =
    typeof data.title_raw === 'string' && data.title_raw.trim().length > 0
      ? data.title_raw
      : typeof data.title === 'string' && data.title.trim().length > 0
        ? data.title
        : id

  const franchiseMovieIds = Array.isArray(data.franchise_movie_ids)
    ? data.franchise_movie_ids.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : undefined

  return {
    id,
    ...data,
    title: normalizedTitleRaw,
    title_raw: normalizedTitleRaw,
    title_vietnamese:
      typeof data.title_vietnamese === 'string' && data.title_vietnamese.trim().length > 0 ? data.title_vietnamese : undefined,
    title_search_keywords: Array.isArray(data.title_search_keywords)
      ? data.title_search_keywords.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : buildSearchKeywords(normalizedTitleRaw),
    title_vietnamese_search_keywords: Array.isArray(data.title_vietnamese_search_keywords)
      ? data.title_vietnamese_search_keywords.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : buildSearchKeywords(typeof data.title_vietnamese === 'string' ? data.title_vietnamese : undefined),
    franchise_movie_ids: franchiseMovieIds,
    created_at: data.created_at ? toIsoString(data.created_at) : undefined,
    last_updated: data.last_updated ? toIsoString(data.last_updated) : undefined,
  }
}

export const firestore = {
  async getMovies(filters?: Partial<MovieSearchFilters>): Promise<Movie[]> {
    const normalizedFilters = normalizeMovieFilters(filters)
    const hasGenreFilter = normalizedFilters.genres.length > 0
    const hasYearFilter = normalizedFilters.year !== undefined
    const titleTokens = tokenizeSearchText(normalizedFilters.title)

    if (!hasGenreFilter && !hasYearFilter && titleTokens.length === 0) {
      const snapshot = await getDocs(collection(db, 'movies'))
      return sortMovies(snapshot.docs.map((entry) => normalizeMovieFromSnapshot(entry.id, entry.data() as MovieInput)))
    }

    if (!hasGenreFilter && !hasYearFilter && titleTokens.length > 0) {
      const candidateIds = await fetchMovieIdsForTitleToken(titleTokens[0])
      return sortMovies((await fetchMoviesByDocumentIds(candidateIds)).filter((movie) => matchesFilters(movie, normalizedFilters)))
    }
    return sortMovies(
      (await fetchMoviesByStructuredFilters(normalizedFilters)).filter((movie) => matchesFilters(movie, normalizedFilters)),
    )
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
    const id = buildMovieId(payload.title_raw)
    const titleVietnamese = normalizeOptionalTitleVietnamese(payload.title_vietnamese)
    const firestorePayload = stripUndefinedValues({
      ...enrichMovieSearchFields({
        ...payload,
        title_vietnamese: titleVietnamese,
      }),
      // Keep legacy title mirror during migration.
      title: payload.title_raw,
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
    const hasRawTitleUpdate = typeof restPayload.title_raw === 'string'
    const hasVietnameseTitleUpdate = typeof restPayload.title_vietnamese === 'string'
    const normalizedVietnameseTitle = normalizeOptionalTitleVietnamese(restPayload.title_vietnamese)
    const payloadWithDerivedKeywords = hasRawTitleUpdate
      ? enrichMovieSearchFields({
          title_raw: restPayload.title_raw!,
          title_vietnamese: hasVietnameseTitleUpdate ? normalizedVietnameseTitle : undefined,
        })
      : {}
    // Keep doc id in the stored payload so strict movie rules can validate updates.
    const firestorePayload = stripUndefinedValues({
      ...restPayload,
      ...payloadWithDerivedKeywords,
      id,
      ...(typeof restPayload.title_raw === 'string' ? { title: restPayload.title_raw } : {}),
      ...(hasVietnameseTitleUpdate
        ? {
            title_vietnamese: normalizedVietnameseTitle ?? deleteField(),
            ...(hasRawTitleUpdate
              ? {}
              : {
                  title_vietnamese_search_keywords:
                    normalizedVietnameseTitle !== undefined
                      ? buildSearchKeywords(normalizedVietnameseTitle)
                      : deleteField(),
                }),
          }
        : {}),
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
