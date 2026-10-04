import { NextResponse } from "next/server";
import { toGameApiRecord } from "@/lib/api/gameApi";
import { hasValidGamesApiToken, isGamesApiConfigured } from "@/lib/server/apiAuth";
import { DatabaseNotConfiguredError, getStoredGames } from "@/lib/server/gameRepository";
import type { GameApiResponse } from "@/types/gameApi";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isGamesApiConfigured()) {
    return noStoreJson({ error: "games_api_not_configured" }, 503);
  }

  if (!hasValidGamesApiToken(request)) {
    return noStoreJson(
      { error: "unauthorized", message: "Use Authorization: Bearer <token>" },
      401,
      { "WWW-Authenticate": 'Bearer realm="My Games API"' },
    );
  }

  try {
    const { id } = await context.params;
    const snapshot = await getStoredGames();
    const game = snapshot.games.find((item) => item.id === id);

    if (!game) {
      return noStoreJson({ error: "game_not_found" }, 404);
    }

    const response: GameApiResponse = {
      game: toGameApiRecord(game),
      generated_at: new Date().toISOString(),
    };

    return noStoreJson(response);
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return noStoreJson({ error: "database_not_configured" }, 503);
    }

    console.error("[Games API] Failed to read a game", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return noStoreJson({ error: "games_api_unavailable" }, 500);
  }
}

function noStoreJson(body: unknown, status = 200, headers?: HeadersInit) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      ...headers,
    },
  });
}
