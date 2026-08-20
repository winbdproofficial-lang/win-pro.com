-- Provider-neutral catalogue/session storage.
-- No wager/bet settlement logic is included here.
CREATE TABLE IF NOT EXISTS provider_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(80) NOT NULL,
  external_game_id VARCHAR(160) NOT NULL,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(80),
  thumbnail_url TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, external_game_id)
);

CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(80) NOT NULL,
  external_game_id VARCHAR(160) NOT NULL,
  session_reference VARCHAR(160),
  status VARCHAR(24) NOT NULL DEFAULT 'started' CHECK (status IN ('started','completed','cancelled','failed')),
  launched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_provider_games_enabled ON provider_games(enabled, provider);
CREATE INDEX IF NOT EXISTS idx_game_sessions_user_time ON game_sessions(user_id, launched_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_sessions_provider_game ON game_sessions(provider, external_game_id, launched_at DESC);
