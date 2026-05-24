import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectId = 'movie-streaming-rules-tests'

function buildUserPayload(uid, role = 'user') {
  return {
    uid,
    username: `${uid}-name`,
    role,
    created_at: '2026-05-24T00:00:00.000Z',
  }
}

function buildDevicePayload() {
  return {
    device_name: 'Living Room TV',
    playlist: ['movie-1'],
    tracking_history: [
      {
        movie_id: 'movie-1',
        last_watched_at: '2026-05-24T00:00:00.000Z',
        current_position_seconds: 120,
      },
    ],
  }
}

describe('firestore.rules users/devices policy', () => {
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
      const seededDb = context.firestore()
      await setDoc(doc(seededDb, 'users/admin-1'), buildUserPayload('admin-1', 'admin'))
      await setDoc(doc(seededDb, 'users/user-1'), buildUserPayload('user-1', 'user'))
      await setDoc(doc(seededDb, 'users/user-2'), buildUserPayload('user-2', 'user'))
      await setDoc(doc(seededDb, 'users/user-1/devices/device-1'), buildDevicePayload())
    })
  })

  it('denies guest reads on users', async () => {
    const guestDb = testEnv.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(guestDb, 'users/user-1')))
  })

  it('allows admin to list users', async () => {
    const adminDb = testEnv.authenticatedContext('admin-1').firestore()
    await assertSucceeds(getDocs(collection(adminDb, 'users')))
  })

  it('allows user to read own user document and denies cross-user read', async () => {
    const ownDb = testEnv.authenticatedContext('user-1').firestore()
    const otherDb = testEnv.authenticatedContext('user-2').firestore()

    await assertSucceeds(getDoc(doc(ownDb, 'users/user-1')))
    await assertFails(getDoc(doc(otherDb, 'users/user-1')))
  })

  it('allows user to create own profile only', async () => {
    const user3Db = testEnv.authenticatedContext('user-3').firestore()
    const user1Db = testEnv.authenticatedContext('user-1').firestore()

    await assertSucceeds(setDoc(doc(user3Db, 'users/user-3'), buildUserPayload('user-3', 'user')))
    await assertFails(setDoc(doc(user1Db, 'users/user-4'), buildUserPayload('user-4', 'user')))
  })

  it('denies non-admin update of protected user fields', async () => {
    const userDb = testEnv.authenticatedContext('user-1').firestore()

    await assertFails(updateDoc(doc(userDb, 'users/user-1'), { role: 'admin' }))
    await assertFails(updateDoc(doc(userDb, 'users/user-1'), { uid: 'changed' }))
    await assertFails(updateDoc(doc(userDb, 'users/user-1'), { created_at: '2026-05-25T00:00:00.000Z' }))
  })

  it('allows non-admin to update username only', async () => {
    const userDb = testEnv.authenticatedContext('user-1').firestore()
    await assertSucceeds(updateDoc(doc(userDb, 'users/user-1'), { username: 'new-name' }))
  })

  it('allows admin to create and delete any user', async () => {
    const adminDb = testEnv.authenticatedContext('admin-1').firestore()

    await assertSucceeds(setDoc(doc(adminDb, 'users/user-9'), buildUserPayload('user-9', 'guest')))
    await assertSucceeds(deleteDoc(doc(adminDb, 'users/user-9')))
  })

  it('denies non-admin user deletion', async () => {
    const userDb = testEnv.authenticatedContext('user-1').firestore()
    await assertFails(deleteDoc(doc(userDb, 'users/user-1')))
  })

  it('allows user to read and write own devices only', async () => {
    const userDb = testEnv.authenticatedContext('user-1').firestore()
    const otherUserDb = testEnv.authenticatedContext('user-2').firestore()

    await assertSucceeds(getDocs(collection(userDb, 'users/user-1/devices')))
    await assertFails(getDocs(collection(otherUserDb, 'users/user-1/devices')))
    await assertSucceeds(setDoc(doc(userDb, 'users/user-1/devices/device-2'), buildDevicePayload()))
    await assertFails(setDoc(doc(otherUserDb, 'users/user-1/devices/device-3'), buildDevicePayload()))
  })

  it('denies device writes with invalid playlist or tracking_history type', async () => {
    const userDb = testEnv.authenticatedContext('user-1').firestore()

    await assertFails(
      setDoc(doc(userDb, 'users/user-1/devices/device-4'), {
        device_name: 'Device 4',
        playlist: 'movie-1',
        tracking_history: [],
      }),
    )

    await assertFails(
      setDoc(doc(userDb, 'users/user-1/devices/device-5'), {
        device_name: 'Device 5',
        playlist: ['movie-1'],
        tracking_history: 'invalid',
      }),
    )
  })

  it('allows admin full access on devices', async () => {
    const adminDb = testEnv.authenticatedContext('admin-1').firestore()

    await assertSucceeds(getDoc(doc(adminDb, 'users/user-1/devices/device-1')))
    await assertSucceeds(updateDoc(doc(adminDb, 'users/user-1/devices/device-1'), { device_name: 'Updated by admin' }))
    await assertSucceeds(deleteDoc(doc(adminDb, 'users/user-1/devices/device-1')))
  })

  it('denies guest reads and writes on devices', async () => {
    const guestDb = testEnv.unauthenticatedContext().firestore()

    await assertFails(getDoc(doc(guestDb, 'users/user-1/devices/device-1')))
    await assertFails(setDoc(doc(guestDb, 'users/user-1/devices/device-6'), buildDevicePayload()))
  })
})
