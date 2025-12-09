// src/db.ts
import 'dotenv/config';
import { Pool } from 'pg';

function buildDatabaseUrlFromParts(): string | null {
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD ?? process.env.DB_PASS;
  const dbName = process.env.DB_NAME;

  if (!host || !port || !user || !password || !dbName) {
    return null;
  }

  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(
    password,
  )}@${host}:${port}/${dbName}`;
}

const connectionString =
  process.env.DATABASE_URL ?? buildDatabaseUrlFromParts();

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set and could not be constructed from DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME',
  );
}

export const pool = new Pool({
  connectionString,
  // Тут можна додати ssl, max, idleTimeoutMillis тощо при потребі
});

// Проста перевірка підключення при старті (можна викликати окремо)
export async function checkDbConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    console.log('[DB] Connection OK');
  } finally {
    client.release();
  }
}
