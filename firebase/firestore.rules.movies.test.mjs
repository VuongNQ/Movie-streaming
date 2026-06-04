import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, getFirestore, setDoc, updateDoc } from 'firebase/firestore'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectId = 'movie-streaming-rules-tests'

function buildMoviePayload(id) {
  return {
    id,
    title: 'Dragon Hunter',
    title_raw: 'Dragon Hunter',
    title_vietnamese: 'Tho San Rong',
    title_search_keywords: ['d', 'dr', 'dra', 'drag', 'drago', 'dragon', 'h', 'hu', 'hun', 'hunt', 'hunte', 'hunter'],
    title_vietnamese_search_keywords: ['t', 'th', 'tho', 's', 'sa', 'san', 'r', 'ro', 'ron', 'rong'],
    description: 'Adventure fantasy movie',
    thumbnail_link: 'https://example.com/thumb.jpg',
    background_link: 'https://example.com/background.jpg',
    type: 'single_movie',
    year: 2025,
    episode_count: 1,
    actors: ['Actor A'],
    audio_types: ['subtitle'],
    genres: ['Adventure'],
    stream_connections: [],
    created_at: '2026-05-24T00:00:00.000Z',
    last_updated: '2026-05-24T00:00:00.000Z',
  }
}

function buildReportPayload(overrides = {}) {
  return {
    movie_id: 'dragon-hunter-1',
    movie_title_raw: 'Dragon Hunter',
    report_type: 'broken_stream',
    issue_field: 'stream_link',
    issue_link: 'https://example.com/movie.m3u8',
    status: 'open',
    reported_by_uid: 'user-1',
    note: 'Segment loading failed',
    preview_status: 'dead',
    preview_error_message: 'Manifest could not be loaded or parsed.',
    preview_metadata: {
      detected_by: 'hls.js',
    },
    created_at: '2026-05-24T00:00:00.000Z',
    updated_at: '2026-05-24T00:00:00.000Z',
    ...overrides,
  }
}

describe('firestore.rules movies policy', () => {
  let testEnv

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId,
      firestore: {
        rules: await fs.readFile(path.resolve(__dirname, '../firestore.rules'), 'utf8'),
      },
    })
  })

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup()
    }
  })

  beforeEach(async () => {
    await testEnv.clearFirestore()

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore()
      await setDoc(doc(adminDb, 'users/admin-1'), {
        uid: 'admin-1',
        username: 'admin',
        role: 'admin',
        created_at: '2026-05-24T00:00:00.000Z',
      })
      await setDoc(doc(adminDb, 'users/user-1'), {
        uid: 'user-1',
        username: 'user',
        role: 'user',
        created_at: '2026-05-24T00:00:00.000Z',
      })
      await setDoc(doc(adminDb, 'users/user-2'), {
        uid: 'user-2',
        username: 'user2',
        role: 'user',
        created_at: '2026-05-24T00:00:00.000Z',
      })
    })
  })

  it('allows admin to create a movie with generated search keyword fields', async () => {
    const adminDb = testEnv.authenticatedContext('admin-1').firestore()
    const movieId = 'dragon-hunter-1'

    await assertSucceeds(setDoc(doc(adminDb, 'movies', movieId), buildMoviePayload(movieId)))
  })

  it('denies non-admin movie creation even when payload has valid search keyword fields', async () => {
    const userDb = testEnv.authenticatedContext('user-1').firestore()
    const movieId = 'dragon-hunter-2'

    await assertFails(setDoc(doc(userDb, 'movies', movieId), buildMoviePayload(movieId)))
  })

  it('denies admin movie writes when stored id is not aligned with the document id', async () => {
    const adminDb = testEnv.authenticatedContext('admin-1').firestore()

    await assertFails(setDoc(doc(adminDb, 'movies', 'dragon-hunter-3'), buildMoviePayload('wrong-id')))
  })

  it('allows admin updates that refresh the generated search keyword fields', async () => {
    const adminDb = testEnv.authenticatedContext('admin-1').firestore()
    const movieId = 'dragon-hunter-4'

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const seededDb = context.firestore()
      await setDoc(doc(seededDb, 'movies', movieId), buildMoviePayload(movieId))
    })

    await assertSucceeds(
      updateDoc(doc(adminDb, 'movies', movieId), {
        id: movieId,
        title_raw: 'Dragon Hunt Returns',
        title: 'Dragon Hunt Returns',
        title_search_keywords: ['d', 'dr', 'dra', 'drag', 'drago', 'dragon', 'h', 'hu', 'hun', 'hunt'],
        last_updated: '2026-05-24T01:00:00.000Z',
      }),
    )
  })

  it('allows authenticated users to create reports with valid payload', async () => {
    const userDb = testEnv.authenticatedContext('user-1').firestore()
    await assertSucceeds(setDoc(doc(userDb, 'reports', 'report-1'), buildReportPayload()))
  })

  it('denies report creation when reported_by_uid does not match auth uid', async () => {
    const userDb = testEnv.authenticatedContext('user-1').firestore()
    await assertFails(
      setDoc(
        doc(userDb, 'reports', 'report-2'),
        buildReportPayload({
          reported_by_uid: 'user-2',
        }),
      ),
    )
  })

  it('denies unauthenticated report creation', async () => {
    const guestDb = testEnv.unauthenticatedContext().firestore()
    await assertFails(setDoc(doc(guestDb, 'reports', 'report-3'), buildReportPayload()))
  })

  it('allows admin to update report status and admin note', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const seededDb = context.firestore()
      await setDoc(doc(seededDb, 'reports', 'report-4'), buildReportPayload())
    })

    const adminDb = testEnv.authenticatedContext('admin-1').firestore()
    await assertSucceeds(
      updateDoc(doc(adminDb, 'reports', 'report-4'), {
        status: 'resolved',
        admin_note: 'Verified and fixed source link.',
        resolved_at: '2026-05-24T01:00:00.000Z',
        updated_at: '2026-05-24T01:00:00.000Z',
      }),
    )
  })

  it('denies non-admin report status updates', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const seededDb = context.firestore()
      await setDoc(doc(seededDb, 'reports', 'report-5'), buildReportPayload())
    })

    const userDb = testEnv.authenticatedContext('user-1').firestore()
    await assertFails(
      updateDoc(doc(userDb, 'reports', 'report-5'), {
        status: 'in_progress',
        updated_at: '2026-05-24T01:00:00.000Z',
      }),
    )
  })

  it('denies updating immutable report fields even for admin', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const seededDb = context.firestore()
      await setDoc(doc(seededDb, 'reports', 'report-6'), buildReportPayload())
    })

    const adminDb = testEnv.authenticatedContext('admin-1').firestore()
    await assertFails(
      updateDoc(doc(adminDb, 'reports', 'report-6'), {
        issue_link: 'https://example.com/changed.m3u8',
        updated_at: '2026-05-24T01:00:00.000Z',
      }),
    )
  })

  it('denies report create with mismatched report_type and issue_field', async () => {
    const userDb = testEnv.authenticatedContext('user-1').firestore()
    await assertFails(
      setDoc(
        doc(userDb, 'reports', 'report-7'),
        buildReportPayload({
          report_type: 'broken_image',
          issue_field: 'stream_link',
        }),
      ),
    )
  })

  it('allows report owner read while denying other non-admin users', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const seededDb = context.firestore()
      await setDoc(doc(seededDb, 'reports', 'report-8'), buildReportPayload())
    })

    const ownerDb = testEnv.authenticatedContext('user-1').firestore()
    const otherUserDb = testEnv.authenticatedContext('user-2').firestore()

    await assertSucceeds(getDoc(doc(ownerDb, 'reports', 'report-8')))
    await assertFails(getDoc(doc(otherUserDb, 'reports', 'report-8')))
  })

  it('allows admin to list reports', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const seededDb = context.firestore()
      await setDoc(doc(seededDb, 'reports', 'report-9'), buildReportPayload())
    })

    const adminDb = testEnv.authenticatedContext('admin-1').firestore()
    await assertSucceeds(getDocs(collection(adminDb, 'reports')))
  })
})