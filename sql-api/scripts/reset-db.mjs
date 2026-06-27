import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'khoikhung',
  database: 'movie_streaming'
});

try {
  // Drop all tables
  await conn.query('SET FOREIGN_KEY_CHECKS=0');
  await conn.query('DROP TABLE IF EXISTS password_reset_tokens');
  await conn.query('DROP TABLE IF EXISTS reports');
  await conn.query('DROP TABLE IF EXISTS devices');
  await conn.query('DROP TABLE IF EXISTS movies');
  await conn.query('DROP TABLE IF EXISTS users');
  await conn.query('DROP TABLE IF EXISTS schema_migrations');
  await conn.query('SET FOREIGN_KEY_CHECKS=1');
  console.log('Dropped all tables');
} finally {
  await conn.end();
}
