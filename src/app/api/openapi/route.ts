import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const origin = new URL(request.url).origin;

  return NextResponse.json(
    {
      openapi: "3.1.0",
      info: {
        title: "My Games Read-only API",
        version: "1.0.0",
        description: "Read the latest PlayStation game library data. This API never modifies games.",
      },
      servers: [{ url: origin }],
      security: [{ bearerAuth: [] }],
      paths: {
        "/api/games": {
          get: {
            operationId: "listGames",
            summary: "List and filter every game in the library",
            parameters: [
              query("search", "Search title, display title, series, genre, or notes"),
              query("platform", "Filter by PS4 or PS5"),
              query("genre", "Filter by genre"),
              query("series", "Filter by series or group"),
              query("status", "Filter by the website's original status"),
              query("play_status", "Filter by backlog, playing, completed, paused, not_started, or not_recorded"),
              query("ownership_status", "Filter by owned, wishlist, borrowed, lent, sold, or not_owned"),
            ],
            responses: {
              "200": {
                description: "The latest matching games",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        games: { type: "array", items: { $ref: "#/components/schemas/Game" } },
                        count: { type: "integer" },
                        generated_at: { type: "string", format: "date-time" },
                      },
                      required: ["games", "count", "generated_at"],
                    },
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
            required: [
              "id",
              "title",
              "platform",
              "status",
              "play_status",
              "ownership_status",
              "ownership_type",
              "is_owned",
              "wishlist",
              "genre",
              "rating",
              "hours_played",
              "is_completed",
              "completed_date",
              "purchase",
              "notes",
              "created_at",
              "updated_at",
            ],
          },
        },
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
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
