require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

// Use the exact PostgreSQL connection URL supplied in DATABASE_URL.
// `family: 4` asks Node's DNS resolver to prefer IPv4, which is useful on
// Render when connecting to external managed Postgres providers.
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  family: 4
});

pool.on('error', err => console.error('[DB] Unexpected idle client error:', err));

module.exports = { pool };
