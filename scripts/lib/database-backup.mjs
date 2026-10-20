import { createHash } from "node:crypto";

function canonical(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  }
  return value;
}

export function digest(value) {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

export async function captureBackup(sql, projectId) {
  const [games, state, schema, database] = await sql.transaction((tx) => [
    tx`SELECT id, data, created_at, updated_at FROM public.my_games_games ORDER BY id`,
    tx`SELECT id, initialized, revision, updated_at, last_write_id FROM public.my_games_state ORDER BY id`,
    tx`SELECT table_name, column_name, data_type, is_nullable, column_default
       FROM information_schema.columns WHERE table_schema = 'public'
       AND table_name IN ('my_games_games', 'my_games_state') ORDER BY table_name, ordinal_position`,
    tx`SELECT current_database() AS name`,
  ], { isolationLevel: "RepeatableRead", readOnly: true });
  if (state.length !== 1 || state[0].id !== "library" || !state[0].initialized) throw new Error("cloud_not_initialized");
  const backup = canonical({
    format: "my-games-database-backup", version: 1, createdAt: new Date().toISOString(),
    source: { app: "ps-game-library", projectId, database: database[0].name },
    rows: { games, state }, schema,
  });
  return { ...backup, checksum: digest(backup) };
}

export function validateDatabaseBackup(backup) {
  if (!backup || backup.format !== "my-games-database-backup" || backup.version !== 1
    || !Array.isArray(backup.rows?.games) || !Array.isArray(backup.rows?.state)) throw new Error("invalid_backup");
  const { checksum, ...content } = backup;
  if (typeof checksum !== "string" || checksum !== digest(content)) throw new Error("backup_checksum_mismatch");
  if (new Set(backup.rows.games.map((row) => row.id)).size !== backup.rows.games.length) throw new Error("duplicate_backup_ids");
  return backup;
}

export async function verifyBackupRestore(sql, value) {
  const backup = validateDatabaseBackup(value);
  // All writes are transaction-local TEMP tables, never public collection tables.
  const result = await sql.transaction((tx) => [
    tx`CREATE TEMP TABLE my_games_restore_check_games
       (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL) ON COMMIT DROP`,
    tx`CREATE TEMP TABLE my_games_restore_check_state
       (id TEXT PRIMARY KEY, initialized BOOLEAN NOT NULL, revision BIGINT NOT NULL, updated_at TIMESTAMPTZ, last_write_id TEXT) ON COMMIT DROP`,
    tx`INSERT INTO pg_temp.my_games_restore_check_games SELECT * FROM jsonb_populate_recordset(
       NULL::pg_temp.my_games_restore_check_games, ${JSON.stringify(backup.rows.games)}::jsonb)`,
    tx`INSERT INTO pg_temp.my_games_restore_check_state SELECT * FROM jsonb_populate_recordset(
       NULL::pg_temp.my_games_restore_check_state, ${JSON.stringify(backup.rows.state)}::jsonb)`,
    tx`SELECT id, data, created_at, updated_at FROM pg_temp.my_games_restore_check_games ORDER BY id`,
    tx`SELECT id, initialized, revision, updated_at, last_write_id FROM pg_temp.my_games_restore_check_state ORDER BY id`,
  ]);
  if (digest({ games: result[4], state: result[5] }) !== digest(backup.rows)) throw new Error("restored_data_mismatch");
  return { restoredGames: result[4].length, verified: true, checksum: backup.checksum };
}

export async function verifyApiMatchesBackup(baseUrl, token, backup) {
  const ids = [];
  let offset = 0;
  for (;;) {
    const url = new URL("/api/games", baseUrl);
    url.search = new URLSearchParams({ fields: "id", limit: "100", offset: String(offset) }).toString();
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`api_verification_http_${response.status}`);
    const page = await response.json();
    if (!Array.isArray(page.games) || !Number.isSafeInteger(page.total)) throw new Error("invalid_api_page");
    ids.push(...page.games.map((game) => game.id));
    if (ids.length > backup.rows.games.length || new Set(ids).size !== ids.length) throw new Error("api_pagination_mismatch");
    if (!page.hasMore) {
      if (page.total !== ids.length) throw new Error("api_pagination_mismatch");
      break;
    }
    if (!page.games.length) throw new Error("api_pagination_stalled");
    offset += page.games.length;
  }
  const expected = backup.rows.games.map((row) => row.id).sort();
  if (digest(ids.sort()) !== digest(expected)) throw new Error("api_database_mismatch");
  return { total: ids.length, apiMatchesDatabase: true };
}
