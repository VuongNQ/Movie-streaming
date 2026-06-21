import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'khoikhung',
  database: 'movie_streaming'
});

try {
  await conn.query('DROP TABLE IF EXISTS schema_migrations');
  console.log('Cleared migration record');
} finally {
  await conn.end();
}
