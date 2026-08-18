require('dotenv').config();
const { Pool } = require('pg');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});
pool.on('error', err => console.error('[DB] Unexpected idle client error:', err));
module.exports = { pool };
