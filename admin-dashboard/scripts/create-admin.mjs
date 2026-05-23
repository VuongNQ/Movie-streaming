#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return
  }

  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split(/\r?\n/)

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (!line || line.startsWith('#')) {
      continue
    }

    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    let value = line.slice(separatorIndex + 1).trim()

    if (!key) {
      continue
    }

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

function parseArgs(argv) {
  const args = {}

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index]

    if (token === '--help' || token === '-h') {
      args.help = true
      continue
    }

    if (!token.startsWith('--')) {
      continue
    }

    const key = token.slice(2)
    const next = argv[index + 1]

    if (!next || next.startsWith('--')) {
      args[key] = true
      continue
    }

    args[key] = next
    index += 1
  }

  return args
}

function printHelp() {
  console.log(`\nCreate or promote an admin account for Movie-streaming.\n
Usage:
  npm run create-admin -- --email <email> --password <password> --username <username> [options]

Required:
  --email <email>          Login email for Firebase Auth user
  --password <password>    Password for Firebase Auth user
  --username <username>    Username stored in users/{uid}

Options:
  --uid <uid>                              Use custom UID when creating a new auth user
  --project-id <projectId>                 Firebase project id for Admin SDK
  --database-id <databaseId>               Firestore database id (default: moviestreaming)
  --service-account <path-to-json>         Service account JSON file path

Environment defaults from .env:
  ADMIN_BOOTSTRAP_EMAIL
  ADMIN_BOOTSTRAP_PASSWORD
  ADMIN_BOOTSTRAP_USERNAME
  ADMIN_BOOTSTRAP_UID
  ADMIN_BOOTSTRAP_PROJECT_ID (or VITE_FIREBASE_PROJECT_ID)
  ADMIN_BOOTSTRAP_DATABASE_ID (or VITE_FIREBASE_DATABASE_ID)
  ADMIN_BOOTSTRAP_SERVICE_ACCOUNT (or GOOGLE_APPLICATION_CREDENTIALS)

Auth for admin script:
  1) Preferred: --service-account <path>
  2) Or set GOOGLE_APPLICATION_CREDENTIALS to a service account file\n`)
}

function assertRequired(args, key) {
  if (!args[key] || args[key] === true) {
    throw new Error(`Missing required argument --${key}`)
  }
}

function resolveCredentials(args) {
  const serviceAccountPath =
    (args['service-account'] && args['service-account'] !== true && args['service-account']) ||
    process.env.ADMIN_BOOTSTRAP_SERVICE_ACCOUNT ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS

  if (serviceAccountPath) {
    const absolutePath = path.resolve(process.cwd(), serviceAccountPath)

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Service account file not found: ${absolutePath}`)
    }

    const content = fs.readFileSync(absolutePath, 'utf8')
    const parsed = JSON.parse(content)

    return cert(parsed)
  }

  return applicationDefault()
}

async function ensureAuthUser(auth, args) {
  const email = args.email
  const password = args.password
  const uid =
    (args.uid && args.uid !== true && args.uid) ||
    process.env.ADMIN_BOOTSTRAP_UID ||
    undefined

  try {
    const existing = await auth.getUserByEmail(email)

    await auth.updateUser(existing.uid, {
      password,
      displayName: args.username,
    })

    return {
      uid: existing.uid,
      created: false,
    }
  } catch (error) {
    if (!error || error.code !== 'auth/user-not-found') {
      throw error
    }
  }

  const created = await auth.createUser({
    uid,
    email,
    password,
    displayName: args.username,
  })

  return {
    uid: created.uid,
    created: true,
  }
}

async function upsertAdminDoc(db, uid, username) {
  const userRef = db.collection('users').doc(uid)
  const snapshot = await userRef.get()

  if (!snapshot.exists) {
    await userRef.set({
      uid,
      username,
      role: 'admin',
      created_at: FieldValue.serverTimestamp(),
    })

    return 'created'
  }

  await userRef.set(
    {
      uid,
      username,
      role: 'admin',
      created_at: snapshot.get('created_at') ?? FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  return 'updated'
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), '.env'))

  const args = parseArgs(process.argv)

  args.email = (args.email && args.email !== true ? args.email : undefined) || process.env.ADMIN_BOOTSTRAP_EMAIL
  args.password =
    (args.password && args.password !== true ? args.password : undefined) || process.env.ADMIN_BOOTSTRAP_PASSWORD
  args.username =
    (args.username && args.username !== true ? args.username : undefined) || process.env.ADMIN_BOOTSTRAP_USERNAME

  if (!args.uid || args.uid === true) {
    args.uid = process.env.ADMIN_BOOTSTRAP_UID
  }

  if (!args['service-account'] || args['service-account'] === true) {
    args['service-account'] = process.env.ADMIN_BOOTSTRAP_SERVICE_ACCOUNT
  }

  if (args.help) {
    printHelp()
    return
  }

  assertRequired(args, 'email')
  assertRequired(args, 'password')
  assertRequired(args, 'username')

  const projectId =
    (args['project-id'] && args['project-id'] !== true && args['project-id']) ||
    process.env.ADMIN_BOOTSTRAP_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT

  if (!projectId) {
    throw new Error(
      'Missing project id. Set --project-id, ADMIN_BOOTSTRAP_PROJECT_ID, or VITE_FIREBASE_PROJECT_ID in .env',
    )
  }

  const databaseId =
    (args['database-id'] && args['database-id'] !== true && args['database-id']) ||
    process.env.ADMIN_BOOTSTRAP_DATABASE_ID ||
    process.env.VITE_FIREBASE_DATABASE_ID ||
    'moviestreaming'

  const app = initializeApp({
    projectId,
    credential: resolveCredentials(args),
  })

  const auth = getAuth(app)
  const db = getFirestore(app, databaseId)

  const authResult = await ensureAuthUser(auth, args)
  const docResult = await upsertAdminDoc(db, authResult.uid, args.username)

  console.log('\nAdmin account ready:')
  console.log(`- uid: ${authResult.uid}`)
  console.log(`- auth: ${authResult.created ? 'created' : 'updated existing user'}`)
  console.log(`- users/{uid}: ${docResult}`)
}

main().catch((error) => {
  console.error('\nFailed to create admin account.')
  console.error(error?.message ?? error)
  process.exit(1)
})
