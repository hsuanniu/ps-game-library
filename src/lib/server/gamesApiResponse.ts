import { NextResponse } from "next/server";
import { GameApiQueryError, GameApiRecordTooLargeError } from "@/lib/api/gameApiQuery";
import { hasValidGamesApiToken, isGamesApiConfigured } from "@/lib/server/apiAuth";
import { DatabaseNotConfiguredError } from "@/lib/server/gameRepository";

export function authorizeGamesApi(request: Request) {
  if (!isGamesApiConfigured()) {
    return gamesApiJson({ error: "games_api_not_configured" }, 503);
  }
  if (!hasValidGamesApiToken(request)) {
    return gamesApiJson(
      { error: "unauthorized", message: "Use Authorization: Bearer <token>" },
      401,
      { "WWW-Authenticate": 'Bearer realm="My Games API"' },
    );
  }
}

export function gamesApiErrorResponse(error: unknown) {
  if (error instanceof GameApiQueryError) {
    return gamesApiJson({ error: "invalid_query", message: error.message }, 400);
  }
  if (error instanceof GameApiRecordTooLargeError) {
    return gamesApiJson({ error: "record_too_large", message: error.message }, 413);
  }
  if (error instanceof DatabaseNotConfiguredError) {
    return gamesApiJson({ error: "database_not_configured" }, 503);
  }
  console.error("[Games API] Failed to query games", {
    message: error instanceof Error ? error.message : "unknown_error",
  });
  return gamesApiJson({ error: "games_api_unavailable" }, 500);
}

export function gamesApiJson(body: unknown, status = 200, headers?: HeadersInit) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      ...headers,
    },
  });
}
