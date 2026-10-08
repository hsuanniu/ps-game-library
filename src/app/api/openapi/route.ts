import { NextResponse } from "next/server";
import { DEFAULT_GAME_API_FIELDS, DEFAULT_GAMES_LIMIT, GAME_API_FIELDS, MAX_GAMES_LIMIT } from "@/lib/api/gameApiQuery";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const origin = new URL(request.url).origin;

  return NextResponse.json(
    {
      openapi: "3.1.0",
      info: {
        title: "My Games Read-only API",
        version: "1.1.0",
        description: "Read the latest PlayStation game library data. This API never modifies games.",
      },
      servers: [{ url: origin }],
      security: [{ bearerAuth: [] }],
      paths: {
        "/api/games": {
          get: {
            operationId: "listGames",
            summary: "List one page of matching games",
            description: "Returns a compact page, ordered by created_at DESC then id ASC. total is the full filtered count. Continue with nextOffset while hasMore is true. Use countGames for totals and fields=id,title for names only.",
            parameters: [
              ...filterParameters(),
              {
                name: "limit",
                in: "query",
                required: false,
                description: "Maximum games per page. The 64 KiB response budget may return fewer; continue with nextOffset.",
                schema: { type: "integer", minimum: 1, maximum: MAX_GAMES_LIMIT, default: DEFAULT_GAMES_LIMIT },
              },
              {
                name: "offset",
                in: "query",
                required: false,
                description: "Number of matching games to skip. For subsequent pages use the response's nextOffset and the same filters and fields.",
                schema: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER, default: 0 },
              },
              {
                name: "fields",
                in: "query",
                required: false,
                description: "Fields to return, e.g. [id,title] becomes fields=id,title. Default omits cover_url, notes, purchase and loan_person. Every field remains available on request. Large individual records return 413; request fewer fields. Filters still use all stored metadata.",
                style: "form",
                explode: false,
                schema: {
                  type: "array",
                  items: { type: "string", enum: GAME_API_FIELDS },
                  minItems: 1,
                  maxItems: GAME_API_FIELDS.length,
                  uniqueItems: true,
                  default: DEFAULT_GAME_API_FIELDS,
                },
              },
            ],
            responses: {
              "200": {
                description: "A page of the latest matching games, at most 64 KiB. Game fields depend on fields selection.",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        games: { type: "array", items: { $ref: "#/components/schemas/Game" } },
                        total: { type: "integer", minimum: 0, description: "All matching games before pagination" },
                        hasMore: { type: "boolean" },
                        limit: { type: "integer" },
                        offset: { type: "integer" },
                        nextOffset: { type: ["integer", "null"], description: "Offset for the next page, null when finished" },
                        returned: { type: "integer", minimum: 0, description: "Games returned on this page" },
                        count: { type: "integer", deprecated: true, description: "Legacy alias of total" },
                        generated_at: { type: "string", format: "date-time" },
                      },
                      required: ["games", "total", "hasMore", "limit", "offset", "nextOffset", "returned", "count", "generated_at"],
                    },
                  },
                },
              },
              "400": { description: "Invalid limit, offset, or fields" },
              "401": { description: "Missing or invalid Bearer token" },
              "413": { description: "One game exceeds the response budget; request fewer fields, such as id,title" },
              "503": { description: "API or database is not configured" },
            },
          },
        },
        "/api/games/count": {
          get: {
            operationId: "countGames",
            summary: "Count all matching games without returning a list",
            description: "Returns the exact total for the same filters as listGames. No pagination or game records. Suitable for library totals, PS4/PS5 counts, play status counts and ownership status counts.",
            parameters: filterParameters(),
            responses: {
              "200": {
                description: "Total number of matching games",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: { total: { type: "integer", minimum: 0 } },
                      required: ["total"],
                    },
                    example: { total: 247 },
                  },
                },
              },
              "401": { description: "Missing or invalid Bearer token" },
              "503": { description: "API or database is not configured" },
            },
          },
        },
        "/api/games/{id}": {
          get: {
            operationId: "getGame",
            summary: "Get one game by its exact ID",
            parameters: [
              {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string" },
              },
            ],
            responses: {
              "200": {
                description: "One game",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        game: { $ref: "#/components/schemas/Game" },
                        generated_at: { type: "string", format: "date-time" },
                      },
                      required: ["game", "generated_at"],
                    },
                  },
                },
              },
              "404": { description: "Game not found" },
            },
          },
        },
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
          },
        },
        schemas: {
          Game: {
            type: "object",
            description: "Game data. listGames returns only requested fields; getGame returns the full record.",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              display_title: { type: ["string", "null"] },
              cover_url: { type: ["string", "null"] },
              platform: { type: "string", enum: ["PS4", "PS5", "PS4_PS5"] },
              status: { type: "string" },
              play_status: { type: "string" },
              ownership_status: { type: "string" },
              ownership_type: { type: "string" },
              is_owned: { type: "boolean" },
              wishlist: { type: "boolean" },
              genre: { type: "array", items: { type: "string" } },
              age_rating: { type: ["object", "null"] },
              rating: { type: ["number", "null"] },
              hours_played: { type: ["number", "null"] },
              is_completed: { type: "boolean" },
              completed_date: { type: ["string", "null"], format: "date" },
              series: { type: ["object", "null"] },
              purchase: { type: "object" },
              loan_person: { type: ["string", "null"] },
              notes: { type: "string" },
              added_at: { type: ["string", "null"], format: "date-time" },
              created_at: { type: "string", format: "date-time" },
              updated_at: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function filterParameters() {
  return [
    query("search", "Search title, display title, series, genre, or notes"),
    query("platform", "Filter by PS4 or PS5"),
    query("genre", "Partial match on stored genres, such as 角色扮演 or RPG (use the library's genre labels)"),
    query("series", "Filter by series or group (partial match)"),
    query("status", "Filter by the website's original status"),
    query("play_status", "Filter by backlog, playing, completed, paused, not_started, or not_recorded"),
    query("ownership_status", "Filter by owned, wishlist, borrowed, lent, sold, or not_owned"),
  ];
}

function query(name: string, description: string) {
  return {
    name,
    in: "query",
    required: false,
    description,
    schema: { type: "string" },
  };
}
