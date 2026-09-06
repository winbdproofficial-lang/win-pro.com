// WINBD-PRO remote database configuration reference.
//
// The production backend does NOT read this file directly. Render should store
// the real values as environment variables. Never commit a database password,
// service-role key, JWT secret, or payment credentials.

module.exports = {
  // Supabase project URL (safe/public reference value).
  SUPABASE_URL: 'https://YOUR_PROJECT_REF.supabase.co',

  // Supabase publishable key is optional for this Express/PostgreSQL backend.
  // Keep it here only for integrations that explicitly use the Supabase client.
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_YOUR_PUBLIC_KEY',

  // The backend actually connects to PostgreSQL through DATABASE_URL.
  // Put the real connection string in Render Environment Variables, not here.
  DATABASE_URL: 'postgresql://postgres.YOUR_PROJECT_REF:YOUR_DB_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres',

  // Required by the backend JWT auth layer.
  JWT_SECRET: 'GENERATE_A_LONG_RANDOM_SECRET_AT_LEAST_32_CHARS'
};
