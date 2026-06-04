import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

function parseEnvLine(line) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) {
    return null
  }

  const index = trimmed.indexOf('=')
  if (index < 1) {
    return null
  }

  const key = trimmed.slice(0, index).trim()
  let value = trimmed.slice(index + 1).trim()

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1)
  }

  return { key, value }
}

function loadEnvFile(filePath) {
  const raw = readFileSync(filePath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const entry = parseEnvLine(line)
    if (!entry || process.env[entry.key] !== undefined) {
      continue
    }

    process.env[entry.key] = entry.value
  }
}

const moduleDir = dirname(fileURLToPath(import.meta.url))
const envPath = join(moduleDir, '..', '.env')

try {
  loadEnvFile(envPath)
} catch (_error) {
  // Missing .env is fine; the caller can still rely on shell-provided variables.
}
