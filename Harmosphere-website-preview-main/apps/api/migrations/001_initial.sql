CREATE TABLE users (
  id uuid PRIMARY KEY, email text UNIQUE NOT NULL, password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id),
  refresh_hash text UNIQUE NOT NULL, expires_at timestamptz NOT NULL,
  revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE used_refresh_tokens (
  token_hash text PRIMARY KEY, session_id uuid NOT NULL REFERENCES sessions(id),
  expires_at timestamptz NOT NULL
);
CREATE TABLE quiz_versions (
  id text PRIMARY KEY, definition jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE attempts (
  id uuid PRIMARY KEY, version_id text NOT NULL REFERENCES quiz_versions(id),
  anonymous_hash text UNIQUE, anonymous_expires_at timestamptz NOT NULL,
  user_id uuid REFERENCES users(id), answers jsonb NOT NULL DEFAULT '{}',
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  status text NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED')),
  result jsonb, completed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,user_id),
  CHECK (user_id IS NOT NULL OR anonymous_hash IS NOT NULL),
  CHECK ((status = 'COMPLETED' AND result IS NOT NULL AND completed_at IS NOT NULL) OR (status = 'IN_PROGRESS' AND result IS NULL))
);
CREATE INDEX attempts_user ON attempts(user_id, created_at DESC);
CREATE TABLE orders (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id),
  attempt_id uuid NOT NULL UNIQUE REFERENCES attempts(id),
  provider text NOT NULL CHECK (provider IN ('stripe', 'mercadopago')),
  amount_minor integer NOT NULL CHECK (amount_minor > 0), currency text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'REVOKED')),
  checkout_id text, checkout_url text, payment_id text,
  checkout_state text NOT NULL DEFAULT 'NEW' CHECK (checkout_state IN ('NEW','CREATING','READY','UNCERTAIN')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, checkout_id), UNIQUE(provider, payment_id), UNIQUE(id,user_id,attempt_id),
  FOREIGN KEY(attempt_id,user_id) REFERENCES attempts(id,user_id)
);
CREATE TABLE entitlements (
  attempt_id uuid PRIMARY KEY REFERENCES attempts(id), user_id uuid NOT NULL REFERENCES users(id),
  order_id uuid UNIQUE NOT NULL REFERENCES orders(id), revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(order_id,user_id,attempt_id) REFERENCES orders(id,user_id,attempt_id)
);
CREATE TABLE payment_events (
  provider text NOT NULL, event_id text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(provider, event_id)
);
CREATE TABLE rate_limits (
  key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL
);
