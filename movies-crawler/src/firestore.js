import './env.js'
import { readFile } from 'node:fs/promises'
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || 'moviestreaming'
const PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.FIRESTORE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  null

function buildMovieId(titleRaw) {
  const slug = titleRaw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'movie'

  const randomSuffix = Math.random().toString(36).slice(2, 10)
  return `${slug}-${randomSuffix}`
}

async function loadCredential() {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!serviceAccountPath) {
    return {
      credential: applicationDefault(),
      projectId: PROJECT_ID,
    }
  }

  const raw = await readFile(serviceAccountPath, 'utf8')
  const serviceAccount = JSON.parse(raw)

  return {
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id || PROJECT_ID,
  }
}

async function getDb() {
  let app = getApps()[0]
  if (getApps().length === 0) {
    const { credential, projectId } = await loadCredential()
    app = initializeApp({
      credential,
      ...(projectId ? { projectId } : {}),
    })
  }

  return getFirestore(app, DATABASE_ID)
}

function nowIso() {
  return new Date().toISOString()
}

function ensureArray(values) {
  return Array.isArray(values) ? values.filter((value) => typeof value === 'string' && value.trim().length > 0) : []
}

function sanitizeNumber(value, fallbackValue) {
  return Number.isInteger(value) ? value : fallbackValue
}

function normalizeNewMoviePayload(scrapedMovie, streamConnection) {
  const timestamp = nowIso()
  const titleRaw = typeof scrapedMovie.title_raw === 'string' && scrapedMovie.title_raw.trim().length > 0
    ? scrapedMovie.title_raw.trim()
    : 'Untitled movie'

  const titleVietnamese =
    typeof scrapedMovie.title_vietnamese === 'string' && scrapedMovie.title_vietnamese.trim().length > 0
      ? scrapedMovie.title_vietnamese.trim()
      : null

  const youtubeTrailerLink =
    typeof scrapedMovie.youtube_trailer_link === 'string' && scrapedMovie.youtube_trailer_link.trim().length > 0
      ? scrapedMovie.youtube_trailer_link.trim()
      : null

  return {
    id: scrapedMovie.id ?? buildMovieId(titleRaw),
    title: titleRaw,
    title_raw: titleRaw,
    description: typeof scrapedMovie.description === 'string' ? scrapedMovie.description.trim() : '',
    thumbnail_link: typeof scrapedMovie.thumbnail_link === 'string' ? scrapedMovie.thumbnail_link.trim() : '',
    background_link: typeof scrapedMovie.background_link === 'string' ? scrapedMovie.background_link.trim() : '',
    type: scrapedMovie.type === 'tv_series' || scrapedMovie.type === 'franchise' ? scrapedMovie.type : 'single_movie',
    year: sanitizeNumber(scrapedMovie.year, new Date().getUTCFullYear()),
    episode_count: sanitizeNumber(scrapedMovie.episode_count, 1),
    actors: ensureArray(scrapedMovie.actors),
    audio_types: ensureArray(scrapedMovie.audio_types).filter((value) => value === 'dubbing' || value === 'subtitle'),
    genres: ensureArray(scrapedMovie.genres),
    franchise_movie_ids: ensureArray(scrapedMovie.franchise_movie_ids),
    stream_connections: streamConnection ? [streamConnection] : [],
    created_at: timestamp,
    last_updated: timestamp,
    ...(titleVietnamese ? { title_vietnamese: titleVietnamese } : {}),
    ...(youtubeTrailerLink ? { youtube_trailer_link: youtubeTrailerLink } : {}),
  }
}

function mergeStreamConnections(existingConnections, incomingStream) {
  if (!incomingStream) {
    return Array.isArray(existingConnections) ? existingConnections : []
  }

  const currentConnections = Array.isArray(existingConnections) ? [...existingConnections] : []
  const existingIndex = currentConnections.findIndex((entry) => entry?.server_name === incomingStream.server_name)

  if (existingIndex === -1) {
    currentConnections.push(incomingStream)
    return currentConnections
  }

  const existing = currentConnections[existingIndex] ?? {}
  currentConnections[existingIndex] = {
    ...existing,
    ...incomingStream,
    metadata: {
      ...(existing.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}),
      ...(incomingStream.metadata && typeof incomingStream.metadata === 'object' ? incomingStream.metadata : {}),
    },
  }

  return currentConnections
}

async function findMovie(db, scrapedMovie) {
  if (typeof scrapedMovie.id === 'string' && scrapedMovie.id.trim().length > 0) {
    const byId = await db.collection('movies').doc(scrapedMovie.id.trim()).get()
    if (byId.exists) {
      return byId
    }
  }

  if (typeof scrapedMovie.title_raw === 'string' && scrapedMovie.title_raw.trim().length > 0) {
    const snapshot = await db.collection('movies').where('title_raw', '==', scrapedMovie.title_raw.trim()).limit(1).get()
    return snapshot.docs[0] ?? null
  }

  return null
}

export async function upsertMovieStream(scrapedMovie, streamConnection) {
  const db = await getDb()
  const existingMovie = await findMovie(db, scrapedMovie)

  if (!existingMovie) {
    const payload = normalizeNewMoviePayload(scrapedMovie, streamConnection)
    await db.collection('movies').doc(payload.id).set(payload)
    return {
      action: 'created',
      id: payload.id,
    }
  }

  const data = existingMovie.data() ?? {}
  const nextConnections = mergeStreamConnections(data.stream_connections, streamConnection)
  const patch = {
    stream_connections: nextConnections,
    last_updated: nowIso(),
  }

  await existingMovie.ref.set(patch, { merge: true })
  return {
    action: 'updated',
    id: existingMovie.id,
  }
}
