-- Additive only: no changes to games, library revision or authentication secrets.
CREATE TABLE IF NOT EXISTS my_games_login_attempts (
  bucket TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  reset_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS my_games_login_attempts_reset_idx
  ON my_games_login_attempts (reset_at);
