import { NextResponse } from "next/server";
import { filterGameApiRecords, toGameApiRecord } from "@/lib/api/gameApi";
import { hasValidGamesApiToken, isGamesApiConfigured } from "@/lib/server/apiAuth";
import { DatabaseNotConfiguredError, getStoredGames } from "@/lib/server/gameRepository";
import type { GamesApiResponse } from "@/types/gameApi";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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
    const snapshot = await getStoredGames();
    const url = new URL(request.url);
    const games = filterGameApiRecords(snapshot.games.map(toGameApiRecord), {
      search: readQuery(url, "search"),
      platform: readQuery(url, "platform"),
      genre: readQuery(url, "genre"),
      series: readQuery(url, "series"),
      status: readQuery(url, "status"),
      playStatus: readQuery(url, "play_status"),
      ownershipStatus: readQuery(url, "ownership_status"),
    });
    const response: GamesApiResponse = {
      games,
      count: games.length,
      generated_at: new Date().toISOString(),
    };

    return noStoreJson(response);
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return noStoreJson({ error: "database_not_configured" }, 503);
    }

    console.error("[Games API] Failed to read games", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return noStoreJson({ error: "games_api_unavailable" }, 500);
  }
}

function readQuery(url: URL, name: string) {
  return url.searchParams.get(name)?.trim().slice(0, 120) || undefined;
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
