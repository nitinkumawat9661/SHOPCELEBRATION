CREATE TABLE IF NOT EXISTS admin_passkey_settings (
  id smallint PRIMARY KEY CHECK (id = 1),
  user_handle text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_passkeys (
  credential_id text PRIMARY KEY,
  user_handle text NOT NULL,
  public_key_jwk jsonb NOT NULL,
  sign_count bigint NOT NULL DEFAULT 0 CHECK (sign_count >= 0),
  transports text[] NOT NULL DEFAULT '{}',
  backup_eligible boolean NOT NULL DEFAULT false,
  backup_state boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS admin_passkeys_active_idx
  ON admin_passkeys (created_at)
  WHERE revoked_at IS NULL;
