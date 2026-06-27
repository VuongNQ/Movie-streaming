#!/usr/bin/env node

/**
 * Admin Endpoints Test Script
 * 
 * Tests the following admin management endpoints with MySQL database:
 * 1. PATCH /users/:uid/disabled - Disable/enable user accounts
 * 2. POST /users/:uid/reset-link - Generate password reset links
 * 3. DELETE /users/:uid - Delete user with CASCADE DELETE validation
 * 
 * Prerequisites:
 * - npm run build (compile TypeScript)
 * - npm run dev or npm start (run the server on PORT=4100)
 * - MySQL database running
 * - .env configured for MySQL
 * 
 * Run: node scripts/test-admin-endpoints.mjs
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'node:url';

// Load .env file
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');
try {
  const envContent = await fs.readFile(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
} catch {
  // .env file not found, use defaults
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE = process.env.API_BASE || 'http://localhost:4100';
const JWT_SECRET = process.env.JWT_SECRET || 'change-me';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 3306;
const DB_NAME = process.env.DB_NAME || 'movie_streaming';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logTest(testName) {
  log(`\n▶ ${testName}`, colors.cyan);
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green);
}

function logError(message) {
  log(`✗ ${message}`, colors.red);
}

function logInfo(message) {
  log(`ℹ ${message}`, colors.blue);
}

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

function generateAccessToken(user) {
  return jwt.sign(
    {
      uid: user.uid,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    {
      expiresIn: '2h',
      subject: user.uid,
    }
  );
}

/**
 * Create a MySQL connection pool for database operations
 */
async function createDatabaseConnection() {
  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  });
  return connection;
}

/**
 * Make HTTP requests to the API
 */
async function makeRequest(method, path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json();
  return {
    status: response.status,
    data,
  };
}

// ============================================================================
// DATABASE HELPERS
// ============================================================================

async function insertUser(conn, user) {
  const query = `
    INSERT INTO users (uid, email, username, role, password_hash, account_status)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  const passwordHash = await hashPassword(user.password || 'test-password-123');
  await conn.execute(query, [
    user.uid,
    user.email,
    user.username,
    user.role || 'user',
    passwordHash,
    user.account_status || 'active',
  ]);
}

async function insertDevice(conn, device) {
  const query = `
    INSERT INTO devices (id, uid, device_name, playlist, tracking_history)
    VALUES (?, ?, ?, ?, ?)
  `;
  await conn.execute(query, [
    device.id,
    device.uid,
    device.device_name,
    device.playlist || JSON.stringify([]),
    device.tracking_history || JSON.stringify([]),
  ]);
}

async function insertPasswordResetToken(conn, token) {
  const query = `
    INSERT INTO password_reset_tokens (id, uid, token_hash, expires_at)
    VALUES (?, ?, ?, ?)
  `;
  await conn.execute(query, [
    token.id,
    token.uid,
    token.token_hash,
    token.expires_at,
  ]);
}

async function getUserByUid(conn, uid) {
  const [rows] = await conn.execute('SELECT * FROM users WHERE uid = ?', [uid]);
  return rows[0] || null;
}

async function getDevicesByUid(conn, uid) {
  const [rows] = await conn.execute('SELECT * FROM devices WHERE uid = ?', [uid]);
  return rows;
}

async function getPasswordResetTokensByUid(conn, uid) {
  const [rows] = await conn.execute('SELECT * FROM password_reset_tokens WHERE uid = ?', [uid]);
  return rows;
}

async function deleteUser(conn, uid) {
  await conn.execute('DELETE FROM users WHERE uid = ?', [uid]);
}

async function deleteDevice(conn, deviceId) {
  await conn.execute('DELETE FROM devices WHERE id = ?', [deviceId]);
}

// ============================================================================
// TEST SETUP & CLEANUP
// ============================================================================

async function setupTestData(conn) {
  logInfo('Setting up test data...');

  // Create admin user
  const adminUid = uuidv4();
  const adminUser = {
    uid: adminUid,
    email: 'admin@test.local',
    username: 'admin_test',
    role: 'admin',
    password: 'admin-password-123',
    account_status: 'active',
  };
  await insertUser(conn, adminUser);
  logSuccess(`Created admin user: ${adminUid}`);

  // Create regular user for disabling test
  const disabledTestUid = uuidv4();
  const disabledTestUser = {
    uid: disabledTestUid,
    email: 'disable-test@test.local',
    username: 'disable_test_user',
    role: 'user',
    password: 'user-password-123',
    account_status: 'active',
  };
  await insertUser(conn, disabledTestUser);
  logSuccess(`Created test user for disable test: ${disabledTestUid}`);

  // Create user for reset link test
  const resetLinkTestUid = uuidv4();
  const resetLinkTestUser = {
    uid: resetLinkTestUid,
    email: 'reset-link-test@test.local',
    username: 'reset_link_test_user',
    role: 'user',
    password: 'user-password-123',
  };
  await insertUser(conn, resetLinkTestUser);
  logSuccess(`Created test user for reset link test: ${resetLinkTestUid}`);

  // Create user for delete test with multiple devices
  const deleteTestUid = uuidv4();
  const deleteTestUser = {
    uid: deleteTestUid,
    email: 'delete-test@test.local',
    username: 'delete_test_user',
    role: 'user',
    password: 'user-password-123',
  };
  await insertUser(conn, deleteTestUser);
  logSuccess(`Created test user for delete test: ${deleteTestUid}`);

  // Add devices to delete test user
  const device1 = {
    id: uuidv4(),
    uid: deleteTestUid,
    device_name: 'TV Room',
    playlist: JSON.stringify([{ movie_id: 'movie-1', position: 0 }]),
    tracking_history: JSON.stringify([]),
  };
  await insertDevice(conn, device1);
  logSuccess(`Created device 1 for delete test user: ${device1.id}`);

  const device2 = {
    id: uuidv4(),
    uid: deleteTestUid,
    device_name: 'Bedroom',
    playlist: JSON.stringify([]),
    tracking_history: JSON.stringify([{ movie_id: 'movie-2', timestamp: Date.now() }]),
  };
  await insertDevice(conn, device2);
  logSuccess(`Created device 2 for delete test user: ${device2.id}`);

  // Add password reset tokens for delete test user
  const formatTimestamp = (date) => {
    // Convert to MySQL TIMESTAMP format (YYYY-MM-DD HH:MM:SS)
    return date.toISOString().replace('T', ' ').substring(0, 19);
  };

  const token1 = {
    id: uuidv4(),
    uid: deleteTestUid,
    token_hash: crypto.createHash('sha256').update('token1').digest('hex'),
    expires_at: formatTimestamp(new Date(Date.now() + 30 * 60 * 1000)),
  };
  await insertPasswordResetToken(conn, token1);
  logSuccess(`Created password reset token 1 for delete test user: ${token1.id}`);

  const token2 = {
    id: uuidv4(),
    uid: deleteTestUid,
    token_hash: crypto.createHash('sha256').update('token2').digest('hex'),
    expires_at: formatTimestamp(new Date(Date.now() + 30 * 60 * 1000)),
  };
  await insertPasswordResetToken(conn, token2);
  logSuccess(`Created password reset token 2 for delete test user: ${token2.id}`);

  return {
    adminUser: { ...adminUser, uid: adminUid },
    disabledTestUser: { ...disabledTestUser, uid: disabledTestUid },
    resetLinkTestUser: { ...resetLinkTestUser, uid: resetLinkTestUid },
    deleteTestUser: { ...deleteTestUser, uid: deleteTestUid },
    deleteTestDevices: [device1, device2],
    deleteTestTokens: [token1, token2],
  };
}

async function cleanupTestData(conn, testData) {
  logInfo('Cleaning up test data...');

  try {
    // Clean up any remaining test users
    const users = [
      testData.adminUser.uid,
      testData.disabledTestUser.uid,
      testData.resetLinkTestUser.uid,
      testData.deleteTestUser.uid,
    ];

    for (const uid of users) {
      await deleteUser(conn, uid).catch(() => {});
    }

    logSuccess('Test data cleaned up');
  } catch (error) {
    logError(`Error during cleanup: ${error.message}`);
  }
}

// ============================================================================
// TEST SCENARIOS
// ============================================================================

/**
 * Test 1: Disable User Endpoint
 */
async function testDisableUserEndpoint(conn, testData) {
  logTest('Disable User Endpoint (PATCH /users/:uid/disabled)');
  const adminToken = generateAccessToken(testData.adminUser);
  const targetUid = testData.disabledTestUser.uid;

  // Test 1.1: Admin can disable active user
  logInfo('Test 1.1: Admin can disable active user');
  let response = await makeRequest('PATCH', `/admin/users/${targetUid}/disabled`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { disabled: true },
  });

  if (response.status === 200 && response.data.disabled === true) {
    logSuccess('User disabled successfully');
  } else {
    logError(`Failed to disable user: ${JSON.stringify(response.data)}`);
    return false;
  }

  // Verify in database
  let user = await getUserByUid(conn, targetUid);
  if (user && user.account_status === 'disabled') {
    logSuccess('Database verified: account_status = disabled');
  } else {
    logError('Database verification failed: account_status not updated');
    return false;
  }

  // Test 1.2: Admin can re-enable user
  logInfo('Test 1.2: Admin can re-enable user');
  response = await makeRequest('PATCH', `/admin/users/${targetUid}/disabled`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { disabled: false },
  });

  if (response.status === 200 && response.data.disabled === false) {
    logSuccess('User re-enabled successfully');
  } else {
    logError(`Failed to re-enable user: ${JSON.stringify(response.data)}`);
    return false;
  }

  // Verify in database
  user = await getUserByUid(conn, targetUid);
  if (user && user.account_status === 'active') {
    logSuccess('Database verified: account_status = active');
  } else {
    logError('Database verification failed: account_status not updated');
    return false;
  }

  // Test 1.3: Non-existent user returns 404
  logInfo('Test 1.3: Non-existent user returns 404');
  const nonExistentUid = uuidv4();
  response = await makeRequest('PATCH', `/admin/users/${nonExistentUid}/disabled`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { disabled: true },
  });

  if (response.status === 404) {
    logSuccess('Non-existent user returns 404');
  } else {
    logError(`Expected 404, got ${response.status}: ${JSON.stringify(response.data)}`);
    return false;
  }

  return true;
}

/**
 * Test 2: Password Reset Link Endpoint
 */
async function testPasswordResetLinkEndpoint(conn, testData) {
  logTest('Password Reset Link Endpoint (POST /users/:uid/reset-link)');
  const adminToken = generateAccessToken(testData.adminUser);
  const targetUid = testData.resetLinkTestUser.uid;

  // Test 2.1: UUID token generated in CHAR(36) format
  logInfo('Test 2.1: UUID token generated and stored');
  let response = await makeRequest('POST', `/admin/users/${targetUid}/reset-link`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  if (response.status === 200 && response.data.reset_link) {
    logSuccess(`Reset link generated: ${response.data.reset_link.substring(0, 50)}...`);
  } else {
    logError(`Failed to generate reset link: ${JSON.stringify(response.data)}`);
    return false;
  }

  // Extract token from reset link
  const resetLinkUrl = new URL(response.data.reset_link);
  const tokenParam = resetLinkUrl.searchParams.get('token');
  if (!tokenParam) {
    logError('Token parameter missing from reset link');
    return false;
  }
  logSuccess(`Token extracted from reset link: ${tokenParam.substring(0, 20)}...`);

  // Test 2.2: Token hash stored in database
  logInfo('Test 2.2: Token hash stored in database');
  const tokens = await getPasswordResetTokensByUid(conn, targetUid);
  if (tokens.length > 0) {
    const token = tokens[tokens.length - 1]; // Most recent token
    logSuccess(`Token stored in database with ID: ${token.id}`);
    logInfo(`Token hash (first 20 chars): ${token.token_hash.substring(0, 20)}...`);
  } else {
    logError('No tokens found in database');
    return false;
  }

  // Test 2.3: Expiry timestamp set correctly
  logInfo('Test 2.3: Expiry timestamp set correctly (30 minutes)');
  const expiryDate = new Date(tokens[tokens.length - 1].expires_at);
  const now = new Date();
  const diffMinutes = (expiryDate - now) / (1000 * 60);
  if (diffMinutes > 25 && diffMinutes < 31) {
    logSuccess(`Token expiry set correctly: ${diffMinutes.toFixed(2)} minutes from now`);
  } else {
    logError(`Token expiry appears incorrect: ${diffMinutes.toFixed(2)} minutes`);
    return false;
  }

  // Test 2.4: Multiple reset links can be generated
  logInfo('Test 2.4: Multiple reset links can be generated');
  response = await makeRequest('POST', `/admin/users/${targetUid}/reset-link`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  if (response.status === 200) {
    const tokensAfter = await getPasswordResetTokensByUid(conn, targetUid);
    if (tokensAfter.length === tokens.length + 1) {
      logSuccess(`Multiple tokens can be generated: ${tokensAfter.length} total tokens`);
    } else {
      logError(`Expected ${tokens.length + 1} tokens, got ${tokensAfter.length}`);
      return false;
    }
  } else {
    logError(`Failed to generate second reset link: ${JSON.stringify(response.data)}`);
    return false;
  }

  // Test 2.5: Non-existent user returns 404
  logInfo('Test 2.5: Non-existent user returns 404');
  const nonExistentUid = uuidv4();
  response = await makeRequest('POST', `/admin/users/${nonExistentUid}/reset-link`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  if (response.status === 404) {
    logSuccess('Non-existent user returns 404');
  } else {
    logError(`Expected 404, got ${response.status}: ${JSON.stringify(response.data)}`);
    return false;
  }

  return true;
}

/**
 * Test 3: Delete User Endpoint (with CASCADE DELETE validation)
 */
async function testDeleteUserEndpoint(conn, testData) {
  logTest('Delete User Endpoint (DELETE /users/:uid) - CASCADE DELETE Validation');
  const adminToken = generateAccessToken(testData.adminUser);
  const targetUid = testData.deleteTestUser.uid;

  // Verify initial state
  logInfo('Verifying initial state...');
  let user = await getUserByUid(conn, targetUid);
  let devices = await getDevicesByUid(conn, targetUid);
  let tokens = await getPasswordResetTokensByUid(conn, targetUid);

  logInfo(`Initial state: 1 user, ${devices.length} devices, ${tokens.length} password reset tokens`);
  if (devices.length !== 2) {
    logError(`Expected 2 devices, found ${devices.length}`);
    return false;
  }
  if (tokens.length !== 2) {
    logError(`Expected 2 password reset tokens, found ${tokens.length}`);
    return false;
  }

  // Test 3.1: Delete user
  logInfo('Test 3.1: Delete user from users table');
  let response = await makeRequest('DELETE', `/admin/users/${targetUid}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  if (response.status === 200) {
    logSuccess(`User deleted: ${response.data.uid}`);
    logInfo(`Deleted devices count: ${response.data.deleted_devices_count}`);
  } else {
    logError(`Failed to delete user: ${JSON.stringify(response.data)}`);
    return false;
  }

  // Test 3.2: Verify user deleted from users table
  logInfo('Test 3.2: Verify user deleted from users table');
  user = await getUserByUid(conn, targetUid);
  if (!user) {
    logSuccess('User successfully deleted from users table');
  } else {
    logError('User still exists in users table (cascade delete failed)');
    return false;
  }

  // Test 3.3: Verify CASCADE DELETE - devices removed
  logInfo('Test 3.3: Verify CASCADE DELETE - all devices removed');
  devices = await getDevicesByUid(conn, targetUid);
  if (devices.length === 0) {
    logSuccess('All devices CASCADE DELETEd successfully');
  } else {
    logError(`Expected 0 devices, found ${devices.length} (CASCADE DELETE failed)`);
    return false;
  }

  // Test 3.4: Verify CASCADE DELETE - password reset tokens removed
  logInfo('Test 3.4: Verify CASCADE DELETE - all password_reset_tokens removed');
  tokens = await getPasswordResetTokensByUid(conn, targetUid);
  if (tokens.length === 0) {
    logSuccess('All password_reset_tokens CASCADE DELETEd successfully');
  } else {
    logError(`Expected 0 password_reset_tokens, found ${tokens.length} (CASCADE DELETE failed)`);
    return false;
  }

  // Test 3.5: Non-existent user returns 404
  logInfo('Test 3.5: Non-existent user returns 404');
  const nonExistentUid = uuidv4();
  response = await makeRequest('DELETE', `/admin/users/${nonExistentUid}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  if (response.status === 404) {
    logSuccess('Non-existent user returns 404');
  } else {
    logError(`Expected 404, got ${response.status}: ${JSON.stringify(response.data)}`);
    return false;
  }

  return true;
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function main() {
  log('\n╔════════════════════════════════════════════════════════════════╗', colors.cyan);
  log('║           ADMIN ENDPOINTS TEST SUITE - MySQL Validation         ║', colors.cyan);
  log('╚════════════════════════════════════════════════════════════════╝\n', colors.cyan);

  let conn;
  let testData;
  let allTestsPassed = true;

  try {
    // Connect to database
    logInfo('Connecting to MySQL database...');
    conn = await createDatabaseConnection();
    logSuccess(`Connected to ${DB_NAME} at ${DB_HOST}:${DB_PORT}`);

    // Setup test data
    testData = await setupTestData(conn);

    // Allow server to register test users
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Run tests
    log('\n--- Running Tests ---\n', colors.yellow);

    if (!(await testDisableUserEndpoint(conn, testData))) {
      allTestsPassed = false;
    }

    if (!(await testPasswordResetLinkEndpoint(conn, testData))) {
      allTestsPassed = false;
    }

    if (!(await testDeleteUserEndpoint(conn, testData))) {
      allTestsPassed = false;
    }

    // Cleanup
    log('\n--- Cleaning Up ---\n', colors.yellow);
    if (testData) {
      // For successful delete test, we already cleaned up that user
      // Just clean up the others that might still exist
      const remainingUsers = [
        testData.adminUser.uid,
        testData.disabledTestUser.uid,
        testData.resetLinkTestUser.uid,
      ];

      for (const uid of remainingUsers) {
        try {
          await deleteUser(conn, uid);
        } catch {
          // User might already be deleted
        }
      }
      logSuccess('Remaining test data cleaned up');
    }

    // Summary
    log('\n╔════════════════════════════════════════════════════════════════╗', colors.cyan);
    if (allTestsPassed) {
      log('║              ✓ ALL TESTS PASSED                               ║', colors.green);
    } else {
      log('║              ✗ SOME TESTS FAILED                              ║', colors.red);
    }
    log('╚════════════════════════════════════════════════════════════════╝\n', colors.cyan);

    process.exit(allTestsPassed ? 0 : 1);
  } catch (error) {
    logError(`Fatal error: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    if (conn) {
      await conn.end();
      logInfo('Database connection closed');
    }
  }
}

// Run the test suite
main();
