#!/usr/bin/env node
/**
 * Auth Endpoint Test Suite for SQL API (MySQL Backend)
 * Tests login, token generation, and GET /auth/me endpoints
 * 
 * Requires: MySQL running on DB_HOST:DB_PORT with credentials in .env
 * Prerequisite: npm run migrate (to set up schema)
 */

import mysql from 'mysql2/promise'
import * as crypto from 'crypto'
import bcrypt from 'bcryptjs'
import * as dotenv from 'dotenv'
import jwtPackage from 'jsonwebtoken'

// Load env vars
dotenv.config()

const JWT_SECRET = process.env.JWT_SECRET || 'change-me'
const API_BASE_URL = `http://localhost:${process.env.PORT || 4100}`
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME || 'movie_streaming',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'khoikhung',
}

// Test fixtures
const TEST_USERS = {
  validUser: {
    uid: crypto.randomUUID(),
    email: 'valid-user@test.local',
    username: 'valid_user',
    password: 'ValidPassword123!',
    role: 'user',
    account_status: 'active',
  },
  adminUser: {
    uid: crypto.randomUUID(),
    email: 'admin@test.local',
    username: 'admin_user',
    password: 'AdminPassword123!',
    role: 'admin',
    account_status: 'active',
  },
  disabledUser: {
    uid: crypto.randomUUID(),
    email: 'disabled@test.local',
    username: 'disabled_user',
    password: 'DisabledPassword123!',
    role: 'user',
    account_status: 'disabled',
  },
}

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: [],
}

// Helper functions
function log(message, type = 'info') {
  const prefix = {
    info: '🔵',
    success: '✅',
    error: '❌',
    test: '📝',
  }[type] || '⏵'
  console.log(`${prefix} ${message}`)
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`)
  }
}

async function recordTest(name, fn) {
  try {
    await fn()
    results.passed++
    results.tests.push({ name, status: 'PASS' })
    log(`${name}`, 'success')
  } catch (error) {
    results.failed++
    results.tests.push({ name, status: 'FAIL', error: error.message })
    log(`${name}: ${error.message}`, 'error')
  }
}

async function setupTestUsers(connection) {
  log('Setting up test users...', 'test')
  
  for (const [key, user] of Object.entries(TEST_USERS)) {
    const passwordHash = await bcrypt.hash(user.password, 12)
    
    try {
      await connection.execute(
        `
          INSERT INTO users (uid, email, username, role, account_status, password_hash, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `,
        [user.uid, user.email, user.username, user.role, user.account_status, passwordHash]
      )
      log(`Test user created: ${user.email} (${key})`)
    } catch (error) {
      // User might already exist, try to update
      if (error.code === 'ER_DUP_ENTRY') {
        await connection.execute(
          `
            UPDATE users 
            SET password_hash = ?, account_status = ?, role = ?
            WHERE email = ?
          `,
          [passwordHash, user.account_status, user.role, user.email]
        )
        log(`Test user updated: ${user.email} (${key})`)
      } else {
        throw error
      }
    }
  }
}

async function cleanupTestUsers(connection) {
  log('Cleaning up test users...', 'test')
  
  const emails = Object.values(TEST_USERS).map(u => u.email)
  for (const email of emails) {
    await connection.execute('DELETE FROM users WHERE email = ?', [email])
  }
  
  log('Test users removed')
}

async function makeRequest(method, path, body = null, token = null) {
  const url = new URL(path, API_BASE_URL)
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  }

  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(url.toString(), options)
  const data = response.ok ? await response.json() : { error: response.statusText, status: response.status }
  
  return { status: response.status, data, ok: response.ok }
}

// Test Suites
async function testLoginEndpoint() {
  log('\n=== Testing POST /auth/login ===', 'test')

  // Test 1: Valid credentials
  await recordTest('Login with valid credentials', async () => {
    const { status, data, ok } = await makeRequest(
      'POST',
      '/auth/login',
      {
        email: TEST_USERS.validUser.email,
        password: TEST_USERS.validUser.password,
      }
    )

    assert(ok, `Expected 200, got ${status}`)
    assert(data.access_token, 'Missing access_token in response')
    assert(data.user, 'Missing user in response')
    assert(data.user.uid === TEST_USERS.validUser.uid, 'UID mismatch')
    assert(data.user.email === TEST_USERS.validUser.email, 'Email mismatch')
    assert(data.user.role === TEST_USERS.validUser.role, 'Role mismatch')
  })

  // Test 2: Admin credentials
  await recordTest('Login with admin credentials', async () => {
    const { status, data, ok } = await makeRequest(
      'POST',
      '/auth/login',
      {
        email: TEST_USERS.adminUser.email,
        password: TEST_USERS.adminUser.password,
      }
    )

    assert(ok, `Expected 200, got ${status}`)
    assert(data.user.role === 'admin', 'Admin role not returned')
  })

  // Test 3: Case-insensitive email
  await recordTest('Login is case-insensitive for email', async () => {
    const { status, data, ok } = await makeRequest(
      'POST',
      '/auth/login',
      {
        email: TEST_USERS.validUser.email.toUpperCase(),
        password: TEST_USERS.validUser.password,
      }
    )

    assert(ok, `Expected 200, got ${status}`)
    assert(data.access_token, 'Token not issued for uppercase email')
  })

  // Test 4: Invalid email
  await recordTest('Login with invalid email returns 401', async () => {
    const { status, ok } = await makeRequest(
      'POST',
      '/auth/login',
      {
        email: 'nonexistent@test.local',
        password: 'SomePassword123!',
      }
    )

    assert(status === 401, `Expected 401, got ${status}`)
    assert(!ok, 'Should not be OK')
  })

  // Test 5: Invalid password
  await recordTest('Login with invalid password returns 401', async () => {
    const { status, ok } = await makeRequest(
      'POST',
      '/auth/login',
      {
        email: TEST_USERS.validUser.email,
        password: 'WrongPassword123!',
      }
    )

    assert(status === 401, `Expected 401, got ${status}`)
    assert(!ok, 'Should not be OK')
  })

  // Test 6: Disabled account
  await recordTest('Login with disabled account returns 403', async () => {
    const { status, ok } = await makeRequest(
      'POST',
      '/auth/login',
      {
        email: TEST_USERS.disabledUser.email,
        password: TEST_USERS.disabledUser.password,
      }
    )

    assert(status === 403, `Expected 403, got ${status}`)
    assert(!ok, 'Should not be OK')
  })

  // Test 7: Invalid email format
  await recordTest('Login with invalid email format returns 400', async () => {
    const { status, ok } = await makeRequest(
      'POST',
      '/auth/login',
      {
        email: 'not-an-email',
        password: 'Password123!',
      }
    )

    assert(status === 400, `Expected 400, got ${status}`)
    assert(!ok, 'Should not be OK')
  })

  // Test 8: Password too short
  await recordTest('Login with password < 8 chars returns 400', async () => {
    const { status, ok } = await makeRequest(
      'POST',
      '/auth/login',
      {
        email: TEST_USERS.validUser.email,
        password: 'short',
      }
    )

    assert(status === 400, `Expected 400, got ${status}`)
    assert(!ok, 'Should not be OK')
  })
}

async function testTokenGeneration() {
  log('\n=== Testing Token Generation ===', 'test')

  let loginToken = null

  // Get a valid token first
  const { data: loginData } = await makeRequest(
    'POST',
    '/auth/login',
    {
      email: TEST_USERS.validUser.email,
      password: TEST_USERS.validUser.password,
    }
  )
  loginToken = loginData.access_token

  // Test 1: Token contains required claims
  await recordTest('Token contains uid, email, and role claims', async () => {
    const decoded = jwtPackage.verify(loginToken, JWT_SECRET)
    assert(decoded.uid === TEST_USERS.validUser.uid, 'UID claim mismatch')
    assert(decoded.email === TEST_USERS.validUser.email, 'Email claim mismatch')
    assert(decoded.role === 'user', 'Role claim mismatch')
  })

  // Test 2: Token has expiration
  await recordTest('Token has expiration (iat and exp)', async () => {
    const decoded = jwtPackage.verify(loginToken, JWT_SECRET)
    assert(typeof decoded.iat === 'number', 'Missing iat claim')
    assert(typeof decoded.exp === 'number', 'Missing exp claim')
    assert(decoded.exp > decoded.iat, 'Expiration should be after issued time')
  })

  // Test 3: Token has subject (sub) claim
  await recordTest('Token has subject (sub) claim set to uid', async () => {
    const decoded = jwtPackage.verify(loginToken, JWT_SECRET)
    assert(decoded.sub === TEST_USERS.validUser.uid, 'Subject (sub) claim mismatch')
  })

  // Test 4: Invalid token verification
  await recordTest('Invalid token fails verification', async () => {
    try {
      jwtPackage.verify('invalid.token.here', JWT_SECRET)
      throw new Error('Should have thrown')
    } catch (error) {
      assert(error.name === 'JsonWebTokenError', `Expected JsonWebTokenError, got ${error.name}`)
    }
  })

  // Test 5: Expired token
  await recordTest('Expired token fails verification', async () => {
    try {
      const expiredToken = jwtPackage.sign(
        {
          uid: TEST_USERS.validUser.uid,
          email: TEST_USERS.validUser.email,
          role: 'user',
        },
        JWT_SECRET,
        { expiresIn: '-1h' } // Expired
      )
      jwtPackage.verify(expiredToken, JWT_SECRET)
      throw new Error('Should have thrown')
    } catch (error) {
      assert(error.name === 'TokenExpiredError', `Expected TokenExpiredError, got ${error.name}`)
    }
  })
}

async function testGetMeEndpoint() {
  log('\n=== Testing GET /auth/me ===', 'test')

  // Get valid tokens first
  const validLoginResponse = await makeRequest(
    'POST',
    '/auth/login',
    {
      email: TEST_USERS.validUser.email,
      password: TEST_USERS.validUser.password,
    }
  )
  const validToken = validLoginResponse.data.access_token

  const adminLoginResponse = await makeRequest(
    'POST',
    '/auth/login',
    {
      email: TEST_USERS.adminUser.email,
      password: TEST_USERS.adminUser.password,
    }
  )
  const adminToken = adminLoginResponse.data.access_token

  // Test 1: Valid token returns user claims
  await recordTest('GET /auth/me with valid token returns user claims', async () => {
    const { status, data, ok } = await makeRequest('GET', '/auth/me', null, validToken)

    assert(ok, `Expected 200, got ${status}`)
    assert(data.uid === TEST_USERS.validUser.uid, 'UID mismatch')
    assert(data.email === TEST_USERS.validUser.email, 'Email mismatch')
    assert(data.role === 'user', 'Role mismatch')
  })

  // Test 2: Admin token returns admin role
  await recordTest('GET /auth/me with admin token returns admin role', async () => {
    const { status, data, ok } = await makeRequest('GET', '/auth/me', null, adminToken)

    assert(ok, `Expected 200, got ${status}`)
    assert(data.role === 'admin', 'Role should be admin')
  })

  // Test 3: No authorization header
  await recordTest('GET /auth/me without Authorization header returns 401', async () => {
    const { status, ok } = await makeRequest('GET', '/auth/me')

    assert(status === 401, `Expected 401, got ${status}`)
    assert(!ok, 'Should not be OK')
  })

  // Test 4: Invalid token format (missing Bearer scheme)
  await recordTest('GET /auth/me with invalid token format returns 401', async () => {
    const url = new URL('/auth/me', API_BASE_URL)
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': 'InvalidToken abc123',
      },
    })

    assert(response.status === 401, `Expected 401, got ${response.status}`)
  })

  // Test 5: Invalid token (malformed JWT)
  await recordTest('GET /auth/me with malformed token returns 401', async () => {
    const { status, ok } = await makeRequest('GET', '/auth/me', null, 'invalid.jwt.token')

    assert(status === 401, `Expected 401, got ${status}`)
    assert(!ok, 'Should not be OK')
  })

  // Test 6: Expired token
  await recordTest('GET /auth/me with expired token returns 401', async () => {
    const expiredToken = jwtPackage.sign(
      {
        uid: TEST_USERS.validUser.uid,
        email: TEST_USERS.validUser.email,
        role: 'user',
      },
      JWT_SECRET,
      { expiresIn: '-1h' } // Expired
    )

    const { status, ok } = await makeRequest('GET', '/auth/me', null, expiredToken)

    assert(status === 401, `Expected 401, got ${status}`)
    assert(!ok, 'Should not be OK')
  })
}

async function main() {
  let connection

  try {
    log('Starting Auth Endpoint Test Suite', 'info')
    log(`API Base URL: ${API_BASE_URL}`, 'info')
    log(`DB: ${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`, 'info')

    // Connect to database
    connection = await mysql.createConnection(DB_CONFIG)
    log('Connected to MySQL database', 'success')

    // Setup test data
    await setupTestUsers(connection)

    // Wait for API to be ready
    log('Waiting for API to be ready...', 'test')
    let apiReady = false
    for (let i = 0; i < 10; i++) {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@test.com', password: 'test12345' }),
        })
        apiReady = true
        break
      } catch {
        await new Promise(r => setTimeout(r, 500))
      }
    }

    if (!apiReady) {
      throw new Error(`API not responding at ${API_BASE_URL}`)
    }
    log('API is ready', 'success')

    // Run test suites
    await testLoginEndpoint()
    await testTokenGeneration()
    await testGetMeEndpoint()

    // Print results
    log('\n=== Test Results ===', 'info')
    results.tests.forEach(test => {
      const symbol = test.status === 'PASS' ? '✅' : '❌'
      const details = test.error ? ` (${test.error})` : ''
      log(`${symbol} ${test.name}${details}`, test.status === 'PASS' ? 'success' : 'error')
    })

    log(`\nTotal: ${results.passed} passed, ${results.failed} failed`, 
        results.failed === 0 ? 'success' : 'error')

    // Exit code
    process.exit(results.failed === 0 ? 0 : 1)

  } catch (error) {
    log(`Fatal error: ${error.message}`, 'error')
    process.exit(1)
  } finally {
    // Cleanup
    try {
      if (connection) {
        await cleanupTestUsers(connection)
        await connection.end()
        log('Database connection closed', 'success')
      }
    } catch (error) {
      log(`Cleanup error: ${error.message}`, 'error')
    }
  }
}

main()
