-- My Games cloud source of truth.
-- Safe to run more than once. It does not alter or delete existing game data.

CREATE TABLE IF NOT EXISTS my_games_games (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS my_games_state (
  id TEXT PRIMARY KEY,
  initialized BOOLEAN NOT NULL DEFAULT FALSE,
  revision BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ,
  last_write_id TEXT
);

INSERT INTO my_games_state (id)
VALUES ('library')
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS my_games_games_updated_at_idx
ON my_games_games (updated_at DESC);
