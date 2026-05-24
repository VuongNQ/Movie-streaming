#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const DEFAULT_BATCH_SIZE = 100

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
  console.log(`\nBackfill movie search keyword fields for Movie-streaming.\n
Usage:
  npm run backfill-movie-search -- [options]

Options:
  --project-id <projectId>                 Firebase project id for Admin SDK
  --database-id <databaseId>               Firestore database id (default: moviestreaming)
  --service-account <path-to-json>         Service account JSON file path
  --batch-size <number>                    Documents per page (default: 100)
  --dry-run                                Print the planned updates without writing

Environment defaults from .env:
  ADMIN_BOOTSTRAP_PROJECT_ID (or VITE_FIREBASE_PROJECT_ID)
  ADMIN_BOOTSTRAP_DATABASE_ID (or VITE_FIREBASE_DATABASE_ID)
  ADMIN_BOOTSTRAP_SERVICE_ACCOUNT (or GOOGLE_APPLICATION_CREDENTIALS)

Auth for admin script:
  1) Preferred: --service-account <path>
  2) Or set GOOGLE_APPLICATION_CREDENTIALS to a service account file\n`)
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
    return cert(JSON.parse(content))
  }

  return applicationDefault()
}

function normalizeSearchText(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildSearchKeywords(value) {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = normalizeSearchText(value)
  if (!normalized) {
    return undefined
  }

  const keywords = new Set()

  for (const token of normalized.split(' ')) {
    if (!token) {
      continue
    }

    for (let index = 1; index <= token.length; index += 1) {
      keywords.add(token.slice(0, index))
    }
  }

  return keywords.size > 0 ? Array.from(keywords) : undefined
}

function arraysEqual(left, right) {
  if (left === right) {
    return true
  }

  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false
  }

  return left.every((value, index) => value === right[index])
}

function toComparableArray(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string') : undefined
}

function buildBackfillPayload(data) {
  const nextTitleKeywords = buildSearchKeywords(data.title_raw ?? data.title)
  const nextVietnameseKeywords = buildSearchKeywords(data.title_vietnamese)
  const currentTitleKeywords = toComparableArray(data.title_search_keywords)
  const currentVietnameseKeywords = toComparableArray(data.title_vietnamese_search_keywords)

  const payload = {}

  if (!arraysEqual(currentTitleKeywords, nextTitleKeywords)) {
    payload.title_search_keywords = nextTitleKeywords ?? []
  }

  if (!arraysEqual(currentVietnameseKeywords, nextVietnameseKeywords)) {
    payload.title_vietnamese_search_keywords = nextVietnameseKeywords ?? []
  }

  return payload
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), '.env'))

  const args = parseArgs(process.argv)

  if (args.help) {
    printHelp()
    return
  }

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

  const batchSize = Number.parseInt(String(args['batch-size'] ?? DEFAULT_BATCH_SIZE), 10)
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error('batch-size must be a positive integer')
  }

  const dryRun = Boolean(args['dry-run'])
  const app = initializeApp({
    projectId,
    credential: resolveCredentials(args),
  })
  const db = getFirestore(app, databaseId)

  let lastDocument = null
  let scanned = 0
  let changed = 0

  while (true) {
    let moviesQuery = db.collection('movies').orderBy('__name__').limit(batchSize)

    if (lastDocument) {
      moviesQuery = moviesQuery.startAfter(lastDocument)
    }

    const snapshot = await moviesQuery.get()
    if (snapshot.empty) {
      break
    }

    const batch = db.batch()
    let batchChanges = 0

    for (const documentSnapshot of snapshot.docs) {
      scanned += 1
      const payload = buildBackfillPayload(documentSnapshot.data())
      const changedKeys = Object.keys(payload)

      if (changedKeys.length === 0) {
        continue
      }

      batchChanges += 1
      changed += 1

      if (dryRun) {
        console.log(`[dry-run] ${documentSnapshot.id}: ${changedKeys.join(', ')}`)
      } else {
        batch.set(documentSnapshot.ref, payload, { merge: true })
      }
    }

    if (!dryRun && batchChanges > 0) {
      await batch.commit()
    }

    lastDocument = snapshot.docs.at(-1) ?? null

    if (snapshot.size < batchSize) {
      break
    }
  }

  console.log(`\nBackfill complete for database ${databaseId}.`)
  console.log(`- scanned movies: ${scanned}`)
  console.log(`- updated movies: ${changed}`)
  console.log(`- mode: ${dryRun ? 'dry-run' : 'write'}`)
}

main().catch((error) => {
  console.error('\nMovie search backfill failed.')
  console.error(error?.message ?? error)
  process.exit(1)
})