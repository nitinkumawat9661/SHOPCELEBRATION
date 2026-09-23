CREATE TABLE IF NOT EXISTS catalog_drafts (
  id text PRIMARY KEY,
  payload jsonb NOT NULL,
  base_version integer NOT NULL CHECK (base_version > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_drafts_singleton CHECK (id = 'primary')
);
