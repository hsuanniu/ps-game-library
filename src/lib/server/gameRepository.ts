import { randomUUID } from "node:crypto";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { Game } from "@/types/game";
import type { StoredGamesSnapshot } from "@/types/gameApi";

type SqlClient = NeonQueryFunction<false, false>;

interface GameRow {
  data: Game | string;
}

interface StateRow {
  initialized: boolean;
  revision: number | string;
  updated_at: string | Date | null;
}

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not configured");
    this.name = "DatabaseNotConfiguredError";
  }
}

export class GameSyncConflictError extends Error {
  constructor() {
    super("The game library changed in another session");
    this.name = "GameSyncConflictError";
  }
}

export class EmptyLibraryInitializationError extends Error {
  constructor() {
    super("An empty library cannot initialize cloud storage");
    this.name = "EmptyLibraryInitializationError";
  }
}

let sqlClient: SqlClient | undefined;
let schemaPromise: Promise<void> | undefined;

export function isGameDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export async function getStoredGamesForApi(includeCover = false): Promise<Game[]> {
  const sql = getSqlClient();
  await ensureSchema(sql);

  const rows = includeCover
    ? await sql`SELECT data FROM my_games_games ORDER BY created_at DESC, id ASC`
    : await sql`SELECT data - 'coverUrl' AS data FROM my_games_games ORDER BY created_at DESC, id ASC`;

  return (rows as GameRow[])
    .map((row) => parseStoredGame(row.data))
    .filter((game): game is Game => game !== undefined);
}

export async function getStoredGames(): Promise<StoredGamesSnapshot> {
  const sql = getSqlClient();
  await ensureSchema(sql);

  const [gameRows, stateRows] = await Promise.all([
    sql`SELECT data FROM my_games_games ORDER BY created_at DESC, id ASC`,
    sql`SELECT initialized, revision, updated_at FROM my_games_state WHERE id = 'library'`,
  ]);

  const games = (gameRows as GameRow[])
    .map((row) => parseStoredGame(row.data))
    .filter((game): game is Game => game !== undefined);
  const state = (stateRows as StateRow[])[0];

  return {
    games,
    initialized: state?.initialized ?? false,
    revision: Number(state?.revision ?? 0),
    updatedAt: toIsoString(state?.updated_at),
  };
}

export async function replaceStoredGames(games: Game[], expectedRevision: number) {
  const sql = getSqlClient();
  await ensureSchema(sql);

  if (!games.every(isValidGame)) {
    throw new TypeError("Invalid game data");
  }

  const operationId = randomUUID();
  const now = new Date().toISOString();
  const transactionResults = await sql.transaction(
    (tx) => [
      tx`
        UPDATE my_games_state
        SET
          initialized = TRUE,
          revision = revision + 1,
          updated_at = ${now}::timestamptz,
          last_write_id = ${operationId}
        WHERE
          id = 'library'
          AND revision = ${expectedRevision}
          AND (initialized = TRUE OR ${games.length > 0})
        RETURNING revision
      `,
      tx`
        DELETE FROM my_games_games
        WHERE EXISTS (
          SELECT 1 FROM my_games_state
          WHERE id = 'library' AND last_write_id = ${operationId}
        )
      `,
      ...games.map((game) => tx`
        INSERT INTO my_games_games (id, data, created_at, updated_at)
        SELECT
          ${game.id},
          ${JSON.stringify(game)}::jsonb,
          ${game.createdAt}::timestamptz,
          ${game.updatedAt}::timestamptz
        WHERE EXISTS (
          SELECT 1 FROM my_games_state
          WHERE id = 'library' AND last_write_id = ${operationId}
        )
      `),
    ],
    { isolationLevel: "Serializable" },
  );

  const revisionRows = transactionResults[0] as Array<{ revision: number | string }>;
  const revision = revisionRows[0]?.revision;

  if (revision === undefined) {
    if (games.length === 0) {
      const stateRows = await sql`SELECT initialized FROM my_games_state WHERE id = 'library'`;
      const state = (stateRows as StateRow[])[0];
      if (!state?.initialized) {
        throw new EmptyLibraryInitializationError();
      }
    }

    throw new GameSyncConflictError();
  }

  return {
    revision: Number(revision),
    updatedAt: now,
  };
}

function getSqlClient() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new DatabaseNotConfiguredError();
  }

  sqlClient ??= neon(databaseUrl);
  return sqlClient;
}

function ensureSchema(sql: SqlClient) {
  schemaPromise ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS my_games_games (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS my_games_state (
        id TEXT PRIMARY KEY,
        initialized BOOLEAN NOT NULL DEFAULT FALSE,
        revision BIGINT NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ,
        last_write_id TEXT
      )
    `;
    await sql`
      INSERT INTO my_games_state (id)
      VALUES ('library')
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS my_games_games_updated_at_idx
      ON my_games_games (updated_at DESC)
    `;
  })();

  return schemaPromise.catch((error) => {
    schemaPromise = undefined;
    throw error;
  });
}

function parseStoredGame(value: Game | string) {
  try {
    const game = typeof value === "string" ? JSON.parse(value) : value;
    return isValidGame(game) ? game : undefined;
  } catch {
    return undefined;
  }
}

function isValidGame(value: unknown): value is Game {
  if (!value || typeof value !== "object") {
    return false;
  }

  const game = value as Partial<Game>;

  return (
    typeof game.id === "string" &&
    typeof game.title === "string" &&
    typeof game.platform === "string" &&
    typeof game.status === "string" &&
    typeof game.ownershipType === "string" &&
    typeof game.createdAt === "string" &&
    typeof game.updatedAt === "string"
  );
}

function toIsoString(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
