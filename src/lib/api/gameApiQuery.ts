import type { GameApiFilters } from "@/lib/api/gameApi";
import type { GameApiRecord, GamesApiResponse } from "@/types/gameApi";

export const DEFAULT_GAMES_LIMIT = 20;
export const MAX_GAMES_LIMIT = 100;
export const MAX_GAMES_RESPONSE_BYTES = 64 * 1024;

export const GAME_API_FIELDS = [
  "id", "title", "display_title", "cover_url", "platform", "status",
  "play_status", "ownership_status", "ownership_type", "is_owned", "wishlist",
  "genre", "age_rating", "rating", "hours_played", "is_completed",
  "completed_date", "series", "purchase", "loan_person", "notes",
  "added_at", "created_at", "updated_at",
] as const satisfies readonly (keyof GameApiRecord)[];

export type GameApiField = (typeof GAME_API_FIELDS)[number];

export const DEFAULT_GAME_API_FIELDS = GAME_API_FIELDS.filter(
  (field) => field !== "cover_url" && field !== "notes" && field !== "purchase" && field !== "loan_person",
);

export interface GamesListQuery {
  filters: GameApiFilters;
  limit: number;
  offset: number;
  fields: GameApiField[];
}

export class GameApiQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameApiQueryError";
  }
}

export class GameApiRecordTooLargeError extends Error {
  constructor() {
    super("Selected fields exceed the response size limit. Request fewer fields, such as id,title.");
    this.name = "GameApiRecordTooLargeError";
  }
}

export function readGameApiFilters(params: URLSearchParams): GameApiFilters {
  const read = (name: string) => params.get(name)?.trim().slice(0, 120) || undefined;

  return {
    search: read("search"),
    platform: read("platform"),
    genre: read("genre"),
    series: read("series"),
    status: read("status"),
    playStatus: read("play_status"),
    ownershipStatus: read("ownership_status"),
  };
}

export function readGamesListQuery(params: URLSearchParams): GamesListQuery {
  return {
    filters: readGameApiFilters(params),
    limit: readInteger(params, "limit", DEFAULT_GAMES_LIMIT, 1, MAX_GAMES_LIMIT),
    offset: readInteger(params, "offset", 0, 0, Number.MAX_SAFE_INTEGER),
    fields: readFields(params),
  };
}

export function createGamesPage(records: GameApiRecord[], query: GamesListQuery): GamesApiResponse {
  const games: Partial<GameApiRecord>[] = [];
  const total = records.length;
  const generatedAt = new Date().toISOString();
  const response = (): GamesApiResponse => {
    const hasMore = query.offset + games.length < total;
    return {
      games,
      total,
      hasMore,
      limit: query.limit,
      offset: query.offset,
      nextOffset: hasMore ? query.offset + games.length : null,
      returned: games.length,
      count: total,
      generated_at: generatedAt,
    };
  };

  // Bound the serialized payload as well as row count; uploaded covers can be large data URLs.
  for (const record of records.slice(query.offset, query.offset + query.limit)) {
    games.push(Object.fromEntries(query.fields.map((field) => [field, record[field]])));
    if (new TextEncoder().encode(JSON.stringify(response())).byteLength > MAX_GAMES_RESPONSE_BYTES) {
      games.pop();
      if (games.length === 0) {
        throw new GameApiRecordTooLargeError();
      }
      break;
    }
  }

  return response();
}

function readInteger(params: URLSearchParams, name: string, fallback: number, min: number, max: number) {
  const values = params.getAll(name);
  if (values.length === 0) {
    return fallback;
  }
  const raw = values[0];
  const value = Number(raw);
  if (values.length !== 1 || !/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new GameApiQueryError(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

function readFields(params: URLSearchParams): GameApiField[] {
  const values = params.getAll("fields");
  if (values.length === 0) {
    return [...DEFAULT_GAME_API_FIELDS];
  }

  const fields = [...new Set(values.flatMap((value) => value.split(",")).map((field) => field.trim()))];
  if (fields.some((field) => !GAME_API_FIELDS.includes(field as GameApiField))) {
    throw new GameApiQueryError(`fields must be a comma-separated list of: ${GAME_API_FIELDS.join(",")}.`);
  }
  return fields as GameApiField[];
}
