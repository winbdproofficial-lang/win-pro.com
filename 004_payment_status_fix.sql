-- Align payment status constraints with the callback/admin lifecycle already used by the API.
ALTER TABLE payment_intents DROP CONSTRAINT IF EXISTS payment_intents_status_check;
ALTER TABLE payment_intents ADD CONSTRAINT payment_intents_status_check CHECK (status IN ('pending','approved','rejected','cancelled','paid','failed'));
