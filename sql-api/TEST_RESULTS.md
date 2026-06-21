# Auth Endpoint Test Results

**Status**: ✅ **ALL TESTS PASSED**
**Date**: 2026-06-21
**Database Backend**: MySQL
**Total Tests**: 19
**Passed**: 19
**Failed**: 0

## Test Summary

### Approach
- **Framework**: Custom Node.js test runner (`scripts/test-auth-endpoints.mjs`)
- **No external dependencies**: Uses native `fetch`, `mysql2`, `jwt`, and `bcryptjs`
- **Database**: Direct MySQL queries to insert/verify test data
- **API Testing**: HTTP requests to `http://localhost:4100`

### Test Coverage

#### POST /auth/login Endpoint (8 tests)
✅ Login with valid credentials
- Returns access_token
- Returns user object with uid, email, role
- Token is valid JWT

✅ Login with admin credentials
- Correctly returns admin role

✅ Case-insensitive email matching
- Email normalization works (uppercase → lowercase)

✅ Invalid email
- Returns 401 Unauthorized
- No token issued

✅ Invalid password
- Returns 401 Unauthorized
- No token issued for correct email + wrong password

✅ Disabled account
- Returns 403 Forbidden (AccountDisabledError)
- Active account status required for login

✅ Invalid email format
- Returns 400 Bad Request
- Email validation enforced by schema

✅ Password too short (<8 chars)
- Returns 400 Bad Request
- Password length requirement enforced

#### Token Generation & Verification (5 tests)
✅ Token contains uid, email, role claims
- All required fields present in JWT payload

✅ Token has expiration (iat and exp claims)
- JWT includes issued-at time
- JWT includes expiration time
- exp > iat (expiration is in future)

✅ Token has subject (sub) claim set to uid
- JWT subject matches user UID
- Compatible with token revocation flows

✅ Invalid token fails verification
- Malformed JWT rejected
- JsonWebTokenError thrown

✅ Expired token fails verification
- Expired JWT rejected immediately
- TokenExpiredError thrown (not a generic error)

#### GET /auth/me Endpoint (6 tests)
✅ Valid token returns user claims
- Authorization header with Bearer token accepted
- Returns uid, email, role
- Response status 200

✅ Admin token returns admin role
- Role preserved from token claims
- No additional auth checks beyond token validity

✅ Missing Authorization header
- Returns 401 Unauthorized
- Proper auth middleware enforcement

✅ Invalid token format (missing Bearer scheme)
- Returns 401 Unauthorized
- "Bearer " prefix required

✅ Malformed JWT token
- Returns 401 Unauthorized
- Invalid JWT structure rejected

✅ Expired token
- Returns 401 Unauthorized
- Expired tokens properly rejected by verifyAccessToken()

## Implementation Details

### Test Users Created
```javascript
- validUser: email@test.local, role: user, status: active
- adminUser: admin@test.local, role: admin, status: active
- disabledUser: disabled@test.local, role: user, status: disabled
```

### Cleanup
- All test users deleted from database after test completion
- No residual test data left in MySQL

### MySQL-Specific Fixes Applied
During implementation, the following MySQL schema compatibility issues were resolved:

1. **VARCHAR vs TEXT for Primary Keys**
   - MySQL requires VARCHAR with length for PRIMARY KEY
   - Changed: `uid TEXT PRIMARY KEY` → `uid VARCHAR(36) PRIMARY KEY`
   - Applied to: uid, id, reported_by_uid columns

2. **UNIQUE VARCHAR Columns**
   - MySQL requires length for VARCHAR in UNIQUE constraints
   - Changed: `email TEXT NOT NULL UNIQUE` → `email VARCHAR(255) NOT NULL UNIQUE`

3. **TIMESTAMP Defaults**
   - MySQL doesn't support `DEFAULT CURRENT_TIMESTAMP` with precision
   - Changed: `TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP` → `TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
   - Added: `ON UPDATE CURRENT_TIMESTAMP` for updated_at columns

4. **Index Syntax**
   - MySQL doesn't support `IF NOT EXISTS` in CREATE INDEX
   - Removed: `CREATE INDEX IF NOT EXISTS` → `CREATE INDEX`
   - Indexes now created without IF NOT EXISTS check

5. **Functional Indexes**
   - MySQL doesn't support functional indexes with CAST
   - Removed: `CREATE INDEX ... ON ... ((CAST(...AS CHAR(255))))`
   - Replaced with simple column indexes where appropriate

## Running the Tests

### Prerequisites
```bash
# Ensure MySQL is running on localhost:3306
# Ensure database movie_streaming exists
# Ensure sql-api/.env has DB_TYPE=mysql
```

### Commands
```bash
# Set up database schema
npm run migrate

# Start API server
npm run dev

# In another terminal, run tests
npm run test:auth
```

### Expected Output
```
🔵 Starting Auth Endpoint Test Suite
✅ Connected to MySQL database
📝 Setting up test users...
✅ API is ready
📝 === Testing POST /auth/login ===
✅ (19 tests pass)
🔵 === Test Results ===
✅ Total: 19 passed, 0 failed
```

## Notes

- The test script includes a 10-second retry loop for API readiness
- All test users are automatically cleaned up, even if tests fail
- Database connection is properly closed after tests complete
- The script uses environment variables from `.env` for configuration
- No test data persists after test execution
