const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore } = require('firebase-admin/firestore')
const { HttpsError, onCall } = require('firebase-functions/v2/https')

initializeApp()

const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || 'moviestreaming'
const callableOptions = {
  region: 'us-central1',
  cors: true,
}

function getDb() {
  return getFirestore(undefined, DATABASE_ID)
}

async function deleteAllUserDevices(uid) {
  const devicesSnapshot = await getDb().collection('users').doc(uid).collection('devices').get()
  await Promise.all(devicesSnapshot.docs.map((entry) => entry.ref.delete()))
  return devicesSnapshot.size
}

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpsError('invalid-argument', `${fieldName} is required.`)
  }

  return value.trim()
}

async function assertAdminCaller(auth) {
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.')
  }

  const snapshot = await getDb().collection('users').doc(auth.uid).get()
  if (!snapshot.exists || snapshot.get('role') !== 'admin') {
    throw new HttpsError('permission-denied', 'Admin role is required.')
  }

  return auth.uid
}

exports.adminCreateUser = onCall(callableOptions, async (request) => {
  await assertAdminCaller(request.auth)

  const email = assertNonEmptyString(request.data?.email, 'email').toLowerCase()
  const password = request.data?.password
  if (typeof password !== 'string' || password.length < 6) {
    throw new HttpsError('invalid-argument', 'Password must contain at least 6 characters.')
  }
  const username = assertNonEmptyString(request.data?.username, 'username')
  const role = request.data?.role
  if (!['guest', 'user'].includes(role)) {
    throw new HttpsError('invalid-argument', 'Role must be guest or user.')
  }

  const user = await getAuth().createUser({ email, password, displayName: username })
  try {
    await getDb().collection('users').doc(user.uid).create({
      uid: user.uid,
      username,
      role,
      approved: false,
      account_status: 'active',
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    await getAuth().deleteUser(user.uid)
    throw new HttpsError('internal', 'Unable to create the user profile.', error.message)
  }

  return { uid: user.uid }
})

exports.adminSetUserDisabled = onCall(callableOptions, async (request) => {
  await assertAdminCaller(request.auth)

  const uid = assertNonEmptyString(request.data?.uid, 'uid')
  const disabled = Boolean(request.data?.disabled)

  await getAuth().updateUser(uid, { disabled })
  await getDb().collection('users').doc(uid).set(
    {
      account_status: disabled ? 'disabled' : 'active',
    },
    { merge: true },
  )

  return {
    uid,
    disabled,
  }
})

exports.adminGeneratePasswordResetLink = onCall(callableOptions, async (request) => {
  await assertAdminCaller(request.auth)

  const uid = assertNonEmptyString(request.data?.uid, 'uid')
  const userRecord = await getAuth().getUser(uid)

  if (!userRecord.email) {
    throw new HttpsError('failed-precondition', 'Target user does not have an email address.')
  }

  const resetLink = await getAuth().generatePasswordResetLink(userRecord.email)

  return {
    uid,
    email: userRecord.email,
    reset_link: resetLink,
  }
})

exports.adminDeleteAuthUser = onCall(callableOptions, async (request) => {
  await assertAdminCaller(request.auth)

  const uid = assertNonEmptyString(request.data?.uid, 'uid')
  let deletedAuthUser = false

  try {
    await getAuth().deleteUser(uid)
    deletedAuthUser = true
  } catch (error) {
    if (!error || error.code !== 'auth/user-not-found') {
      throw error
    }
  }

  const deletedDevicesCount = await deleteAllUserDevices(uid)
  await getDb().collection('users').doc(uid).delete()

  return {
    uid,
    deleted_auth_user: deletedAuthUser,
    deleted_profile: true,
    deleted_devices_count: deletedDevicesCount,
  }
})
