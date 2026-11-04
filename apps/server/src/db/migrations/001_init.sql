CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS id_sequences (
  name TEXT PRIMARY KEY,
  value BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_intents (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  client_secret TEXT NOT NULL UNIQUE,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  payment_method_types JSONB NOT NULL,
  payment_method TEXT,
  receipt_email TEXT,
  capture_method TEXT,
  created INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS setup_intents (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  status TEXT NOT NULL,
  client_secret TEXT NOT NULL UNIQUE,
  usage TEXT NOT NULL,
  customer_email TEXT,
  payment_method TEXT,
  created INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS checkout_sessions (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  status TEXT NOT NULL,
  mode TEXT NOT NULL,
  ui_mode TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  line_items JSONB NOT NULL,
  success_url TEXT,
  cancel_url TEXT,
  client_secret TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  payment_intent TEXT,
  created INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tokens (
  token TEXT PRIMARY KEY,
  payment_method_id TEXT NOT NULL UNIQUE,
  merchant_id TEXT NOT NULL,
  type TEXT NOT NULL,
  brand TEXT,
  last4 TEXT,
  exp_month INTEGER,
  exp_year INTEGER,
  funding TEXT,
  country TEXT,
  outcome JSONB NOT NULL,
  pan_fingerprint TEXT,
  redirect_method JSONB,
  billing_details JSONB,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT NOT NULL,
  merchant_id TEXT NOT NULL,
  type TEXT NOT NULL,
  brand TEXT,
  last4 TEXT,
  exp_month INTEGER,
  exp_year INTEGER,
  billing_details JSONB,
  customer_email TEXT,
  PRIMARY KEY (merchant_id, id)
);

CREATE TABLE IF NOT EXISTS orders (
  merchant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  body JSONB NOT NULL,
  PRIMARY KEY (merchant_id, id)
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  merchant_id TEXT NOT NULL,
  idem_key TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_body JSONB,
  PRIMARY KEY (merchant_id, idem_key)
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS encryption_keys (
  key_id TEXT PRIMARY KEY,
  private_key_pem TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
