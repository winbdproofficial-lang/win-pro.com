require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

// Render instances may not have an IPv6 route to Supabase's direct database host.
// If a direct Supabase URL is supplied, transparently use the project's IPv4
// Session Pooler instead. Existing pooler URLs are left unchanged.
function normalizeDatabaseUrl(raw) {
  try {
    const url = new URL(raw);
    const directHost = /^db\.[a-z0-9]+\.supabase\.co$/i.test(url.hostname);
    if (!directHost) return raw;

    const projectRef = url.hostname.slice(3, -'.supabase.co'.length);
    url.hostname = 'aws-0-ap-south-1.pooler.supabase.com';
    url.port = '6543';
    url.username = `postgres.${projectRef}`;
    return url.toString();
  } catch (err) {
    throw new Error('DATABASE_URL is invalid: ' + err.message);
  }
}

const connectionString = normalizeDatabaseUrl(process.env.DATABASE_URL);

const pool = new Pool({
  connectionString,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  family: 4
});

pool.on('error', err => console.error('[DB] Unexpected idle client error:', err));

module.exports = { pool };
