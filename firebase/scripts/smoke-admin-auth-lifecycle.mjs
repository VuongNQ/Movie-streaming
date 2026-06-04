import { initializeApp as initializeAdminApp } from 'firebase-admin/app'
import { getAuth as getAdminAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions'

const projectId = process.env.GCLOUD_PROJECT || 'movie-streaming-rules-tests'

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }

  return value
}

function parseHostPort(rawValue) {
  const [host, port] = rawValue.split(':')
  return { host, port: Number(port) }
}

async function main() {
  const authEmulator = parseHostPort(requireEnv('FIREBASE_AUTH_EMULATOR_HOST'))
  const firestoreHost = requireEnv('FIRESTORE_EMULATOR_HOST')
  const functionsEmulator = { host: '127.0.0.1', port: 5001 }

  const adminApp = initializeAdminApp({ projectId })
  const adminAuth = getAdminAuth(adminApp)
  const adminDb = getFirestore(adminApp, 'moviestreaming')

  // Bootstrap caller identity with admin privileges in Firestore.
  await adminAuth.createUser({
    uid: 'admin-smoke',
    email: 'admin-smoke@example.com',
    password: 'SmokePass#123',
    displayName: 'Smoke Admin',
  })

  await adminDb.collection('users').doc('admin-smoke').set({
    uid: 'admin-smoke',
    username: 'smoke-admin',
    role: 'admin',
    created_at: new Date().toISOString(),
    account_status: 'active',
  })

  const clientApp = initializeApp({
    apiKey: 'demo-key',
    authDomain: `${projectId}.firebaseapp.com`,
    projectId,
    appId: '1:1234567890:web:smoke',
  }, 'smoke-client')

  const clientAuth = getAuth(clientApp)
  connectAuthEmulator(clientAuth, `http://${authEmulator.host}:${authEmulator.port}`, { disableWarnings: true })
  await signInWithEmailAndPassword(clientAuth, 'admin-smoke@example.com', 'SmokePass#123')

  const clientFunctions = getFunctions(clientApp, 'us-central1')
  connectFunctionsEmulator(clientFunctions, functionsEmulator.host, functionsEmulator.port)

  const disableCallable = httpsCallable(clientFunctions, 'adminSetUserDisabled')
  const resetCallable = httpsCallable(clientFunctions, 'adminGeneratePasswordResetLink')
  const deleteCallable = httpsCallable(clientFunctions, 'adminDeleteAuthUser')

  const createdUid = 'target-smoke'
  await adminAuth.createUser({
    uid: createdUid,
    email: 'target-smoke@example.com',
    password: 'TargetPass#123',
    displayName: 'Target Smoke',
  })

  await adminDb.collection('users').doc(createdUid).set({
    uid: createdUid,
    username: 'target-user',
    role: 'user',
    created_at: new Date().toISOString(),
    account_status: 'active',
  })

  const disabled = await disableCallable({ uid: createdUid, disabled: true })
  if (disabled.data.disabled !== true) {
    throw new Error('adminSetUserDisabled did not set disabled=true')
  }

  const enabled = await disableCallable({ uid: createdUid, disabled: false })
  if (enabled.data.disabled !== false) {
    throw new Error('adminSetUserDisabled did not set disabled=false')
  }

  const reset = await resetCallable({ uid: createdUid })
  if (typeof reset.data.reset_link !== 'string' || reset.data.reset_link.length === 0) {
    throw new Error('adminGeneratePasswordResetLink did not return reset_link')
  }

  await adminDb.collection('users').doc(createdUid).collection('devices').doc('device-1').set({
    device_name: 'Smoke Device',
    playlist: [],
    tracking_history: [],
  })

  const deleted = await deleteCallable({ uid: createdUid })
  if (!deleted.data.deleted_profile) {
    throw new Error('adminDeleteAuthUser did not report deleted_profile=true')
  }

  if (deleted.data.deleted_devices_count !== 1) {
    throw new Error(`Expected deleted_devices_count=1, received ${deleted.data.deleted_devices_count}`)
  }

  let stillExists = false
  try {
    await adminAuth.getUser(createdUid)
    stillExists = true
  } catch (error) {
    if (!error || error.code !== 'auth/user-not-found') {
      throw error
    }
  }

  if (stillExists) {
    throw new Error('Target auth user still exists after adminDeleteAuthUser')
  }

  const profileSnapshot = await adminDb.collection('users').doc(createdUid).get()
  if (profileSnapshot.exists) {
    throw new Error('Target Firestore profile still exists after adminDeleteAuthUser')
  }

  console.log('SMOKE PASS: admin disable/reset/delete callable endpoints are working on emulators')
  console.log(`Firestore emulator host: ${firestoreHost}`)
}

main().catch((error) => {
  console.error('SMOKE FAIL:', error)
  process.exitCode = 1
})
