-- GitSlotPark callback transaction ledger.
-- Stores every provider transaction so callbacks remain idempotent and rollbacks are reversible.
CREATE TABLE IF NOT EXISTS provider_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(80) NOT NULL,
  transaction_id VARCHAR(160) NOT NULL,
  ref_transaction_id VARCHAR(160),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation VARCHAR(32) NOT NULL,
  delta NUMERIC(18,2) NOT NULL,
  balance_before NUMERIC(18,2) NOT NULL,
  balance_after NUMERIC(18,2) NOT NULL,
  rolled_back BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, transaction_id)
);
CREATE INDEX IF NOT EXISTS idx_provider_transactions_user_time ON provider_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_provider_transactions_ref ON provider_transactions(provider, ref_transaction_id);
