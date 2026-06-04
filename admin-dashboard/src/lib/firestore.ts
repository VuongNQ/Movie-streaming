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
import { auth, db, firebaseRuntimeConfig } from './firebase'
import type {
  AuthPreflightDiagnostic,
  Device,
  DeviceInput,
  DeviceTrackingHistory,
  Movie,
  MovieInput,
  MovieSearchFilters,
  Report,
  ReportCreateInput,
  ReportsQueryFilters,
  ReportStatusUpdateInput,
  User,
  UserCreateInput,
  UserInput,
} from '../types'

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

function normalizeAccountStatus(value: unknown): 'active' | 'disabled' {
  return value === 'disabled' ? 'disabled' : 'active'
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

function normalizeTrackingHistoryEntries(value: unknown): DeviceTrackingHistory[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map((entry) => ({
      movie_id: typeof entry.movie_id === 'string' ? entry.movie_id : '',
      last_watched_at: toIsoString(entry.last_watched_at),
      current_position_seconds:
        typeof entry.current_position_seconds === 'number' && Number.isFinite(entry.current_position_seconds)
          ? Math.max(0, Math.trunc(entry.current_position_seconds))
          : 0,
    }))
    .filter((entry) => entry.movie_id.length > 0)
}

function normalizeDeviceFromSnapshot(id: string, data: Record<string, unknown>): Device {
  return {
    id,
    device_name: typeof data.device_name === 'string' ? data.device_name : 'Unknown device',
    playlist: Array.isArray(data.playlist) ? data.playlist.filter((movieId): movieId is string => typeof movieId === 'string') : [],
    tracking_history: normalizeTrackingHistoryEntries(data.tracking_history),
  }
}

function normalizeDeviceInput(payload: Partial<DeviceInput>): Partial<DeviceInput> {
  const normalizedPayload: Partial<DeviceInput> = {}

  if (typeof payload.device_name === 'string') {
    normalizedPayload.device_name = payload.device_name.trim()
  }

  if (Array.isArray(payload.playlist)) {
    normalizedPayload.playlist = payload.playlist.filter((movieId): movieId is string => typeof movieId === 'string')
  }

  if (Array.isArray(payload.tracking_history)) {
    normalizedPayload.tracking_history = normalizeTrackingHistoryEntries(payload.tracking_history)
  }

  return normalizedPayload
}

function normalizeReportFromSnapshot(id: string, data: Record<string, unknown>): Report {
  return {
    id,
    movie_id: typeof data.movie_id === 'string' ? data.movie_id : '',
    movie_title_raw: typeof data.movie_title_raw === 'string' ? data.movie_title_raw : '',
    report_type: data.report_type === 'broken_stream' ? 'broken_stream' : 'broken_image',
    issue_field:
      data.issue_field === 'background_link' || data.issue_field === 'stream_link' ? data.issue_field : 'thumbnail_link',
    issue_link: typeof data.issue_link === 'string' ? data.issue_link : '',
    status:
      data.status === 'in_progress' || data.status === 'resolved'
        ? data.status
        : 'open',
    reported_by_uid: typeof data.reported_by_uid === 'string' ? data.reported_by_uid : '',
    note: typeof data.note === 'string' ? data.note : undefined,
    admin_note: typeof data.admin_note === 'string' ? data.admin_note : undefined,
    preview_status: data.preview_status === 'dead' ? 'dead' : data.preview_status === 'live' ? 'live' : undefined,
    preview_error_message: typeof data.preview_error_message === 'string' ? data.preview_error_message : undefined,
    preview_metadata:
      data.preview_metadata && typeof data.preview_metadata === 'object' && !Array.isArray(data.preview_metadata)
        ? (data.preview_metadata as Record<string, unknown>)
        : undefined,
    created_at: toIsoString(data.created_at),
    updated_at: toIsoString(data.updated_at),
    resolved_at:
      typeof data.resolved_at === 'string' || data.resolved_at instanceof Timestamp || data.resolved_at instanceof Date
        ? toIsoString(data.resolved_at)
        : undefined,
  }
}

function getPrimaryReportFilter(filters: ReportsQueryFilters):
  | { field: 'movie_id' | 'status' | 'report_type'; value: string }
  | null {
  if (typeof filters.movie_id === 'string' && filters.movie_id.trim().length > 0) {
    return {
      field: 'movie_id',
      value: filters.movie_id.trim(),
    }
  }

  if (filters.status) {
    return {
      field: 'status',
      value: filters.status,
    }
  }

  if (filters.report_type) {
    return {
      field: 'report_type',
      value: filters.report_type,
    }
  }

  return null
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

    const users = snapshot.docs.map((entry) => {
      const data = entry.data() as Omit<User, 'uid'>
      return {
        uid: entry.id,
        username: data.username,
        role: data.role,
        created_at: toIsoString(data.created_at),
        account_status: normalizeAccountStatus(data.account_status),
      }
    })

    const deviceCountByUser = new Map<string, number>()
    await Promise.all(
      users.map(async (user) => {
        const devicesSnapshot = await getDocs(collection(db, `users/${user.uid}/devices`))
        deviceCountByUser.set(user.uid, devicesSnapshot.size)
      }),
    )

    return users.map((user) => ({
      ...user,
      device_count: deviceCountByUser.get(user.uid) ?? 0,
    }))
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
      account_status: normalizeAccountStatus(data.account_status),
    }
  },

  async getDevices(uid: string): Promise<Device[]> {
    const snapshot = await getDocs(collection(db, `users/${uid}/devices`))

    return snapshot.docs.map((entry) => normalizeDeviceFromSnapshot(entry.id, entry.data() as Record<string, unknown>))
  },

  async getDeviceById(uid: string, deviceId: string): Promise<Device> {
    const snapshot = await getDoc(doc(db, `users/${uid}/devices`, deviceId))

    if (!snapshot.exists()) {
      throw new Error('Device not found')
    }

    return normalizeDeviceFromSnapshot(snapshot.id, snapshot.data() as Record<string, unknown>)
  },

  async createUser(payload: UserCreateInput): Promise<User> {
    const created_at = new Date().toISOString()
    const userPayload = {
      uid: payload.uid.trim(),
      username: payload.username.trim(),
      role: payload.role,
      created_at,
    }

    try {
      await setDoc(doc(db, 'users', userPayload.uid), userPayload)
    } catch (error) {
      throw mapFirestoreWriteError(error)
    }

    return userPayload
  },

  async updateUser(uid: string, payload: Partial<UserInput>): Promise<void> {
    const updatePayload = stripUndefinedValues({
      ...(typeof payload.username === 'string' ? { username: payload.username.trim() } : {}),
      ...(payload.role ? { role: payload.role } : {}),
    })

    try {
      await updateDoc(doc(db, 'users', uid), updatePayload)
    } catch (error) {
      throw mapFirestoreWriteError(error)
    }
  },

  async deleteUser(uid: string): Promise<void> {
    try {
      const devicesSnapshot = await getDocs(collection(db, `users/${uid}/devices`))
      await Promise.all(devicesSnapshot.docs.map((entry) => deleteDoc(entry.ref)))
      await deleteDoc(doc(db, 'users', uid))
    } catch (error) {
      throw mapFirestoreWriteError(error)
    }
  },

  async createDevice(uid: string, payload: DeviceInput): Promise<Device> {
    const normalizedPayload = normalizeDeviceInput(payload)
    const id = doc(collection(db, `users/${uid}/devices`)).id
    const firestorePayload: DeviceInput = {
      device_name: normalizedPayload.device_name ?? 'New device',
      playlist: normalizedPayload.playlist ?? [],
      tracking_history: normalizedPayload.tracking_history ?? [],
    }

    try {
      await setDoc(doc(db, `users/${uid}/devices`, id), firestorePayload)
    } catch (error) {
      throw mapFirestoreWriteError(error)
    }

    return {
      id,
      ...firestorePayload,
    }
  },

  async updateDevice(uid: string, deviceId: string, payload: Partial<DeviceInput>): Promise<void> {
    const normalizedPayload = normalizeDeviceInput(payload)
    const updatePayload = stripUndefinedValues({
      ...(typeof normalizedPayload.device_name === 'string' ? { device_name: normalizedPayload.device_name } : {}),
      ...(Array.isArray(normalizedPayload.playlist) ? { playlist: normalizedPayload.playlist } : {}),
      ...(Array.isArray(normalizedPayload.tracking_history) ? { tracking_history: normalizedPayload.tracking_history } : {}),
    })

    try {
      await updateDoc(doc(db, `users/${uid}/devices`, deviceId), updatePayload)
    } catch (error) {
      throw mapFirestoreWriteError(error)
    }
  },

  async deleteDevice(uid: string, deviceId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, `users/${uid}/devices`, deviceId))
    } catch (error) {
      throw mapFirestoreWriteError(error)
    }
  },

  async getReports(filters: ReportsQueryFilters = {}): Promise<Report[]> {
    const primaryFilter = getPrimaryReportFilter(filters)
    const reportsQuery = primaryFilter
      ? query(collection(db, 'reports'), where(primaryFilter.field, '==', primaryFilter.value), orderBy('created_at', 'desc'))
      : query(collection(db, 'reports'), orderBy('created_at', 'desc'))

    const snapshot = await getDocs(reportsQuery)
    const reports = snapshot.docs.map((entry) => normalizeReportFromSnapshot(entry.id, entry.data()))

    return reports.filter((report) => {
      if (filters.movie_id && report.movie_id !== filters.movie_id) {
        return false
      }

      if (filters.status && report.status !== filters.status) {
        return false
      }

      if (filters.report_type && report.report_type !== filters.report_type) {
        return false
      }

      return true
    })
  },

  async createReport(payload: ReportCreateInput): Promise<Report> {
    const currentUser = auth.currentUser
    if (!currentUser) {
      throw new Error('You must be signed in to submit a report.')
    }

    const id = doc(collection(db, 'reports')).id
    const now = new Date().toISOString()
    const reportPayload = stripUndefinedValues({
      ...payload,
      status: 'open',
      reported_by_uid: currentUser.uid,
      created_at: now,
      updated_at: now,
    })

    try {
      await setDoc(doc(db, 'reports', id), reportPayload)
    } catch (error) {
      throw mapFirestoreWriteError(error)
    }

    return normalizeReportFromSnapshot(id, reportPayload as Record<string, unknown>)
  },

  async updateReportStatus(payload: ReportStatusUpdateInput): Promise<void> {
    const updatePayload = stripUndefinedValues({
      status: payload.status,
      admin_note: payload.admin_note?.trim().length ? payload.admin_note.trim() : deleteField(),
      updated_at: new Date().toISOString(),
      resolved_at: payload.status === 'resolved' ? new Date().toISOString() : deleteField(),
    })

    try {
      await updateDoc(doc(db, 'reports', payload.id), updatePayload)
    } catch (error) {
      throw mapFirestoreWriteError(error)
    }
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
