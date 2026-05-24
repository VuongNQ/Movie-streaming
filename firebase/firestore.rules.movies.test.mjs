import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getFirestore, setDoc, updateDoc } from 'firebase/firestore'

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
})