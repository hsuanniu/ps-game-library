import { NextResponse } from "next/server";
import { hasValidAdminSession, isAdminAuthConfigured, isSameOriginRequest } from "@/lib/server/apiAuth";
import {
  DatabaseNotConfiguredError,
  GameSyncConflictError,
  getStoredGames,
  replaceStoredGames,
} from "@/lib/server/gameRepository";
import type { Game } from "@/types/game";

const MAX_SYNC_BYTES = 4_000_000;

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = authorize(request);
  if (authError) {
    return authError;
  }

  try {
    const snapshot = await getStoredGames();
    return noStoreJson(snapshot);
  } catch (error) {
    return handleStorageError(error);
  }
}

export async function PUT(request: Request) {
  const authError = authorize(request);
  if (authError) {
    return authError;
  }

  if (!isSameOriginRequest(request)) {
    return noStoreJson({ error: "invalid_origin" }, 403);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_SYNC_BYTES) {
    return noStoreJson({ error: "payload_too_large" }, 413);
  }

  let body: { games?: unknown; expectedRevision?: unknown };

  try {
    body = (await request.json()) as { games?: unknown; expectedRevision?: unknown };
  } catch {
    return noStoreJson({ error: "invalid_json" }, 400);
  }

  if (!Array.isArray(body.games) || !Number.isInteger(body.expectedRevision) || Number(body.expectedRevision) < 0) {
    return noStoreJson({ error: "invalid_sync_payload" }, 400);
  }

  try {
    const result = await replaceStoredGames(body.games as Game[], Number(body.expectedRevision));
    return noStoreJson({ ok: true, ...result });
  } catch (error) {
    if (error instanceof GameSyncConflictError) {
      const snapshot = await getStoredGames();
      return noStoreJson(
        {
          error: "sync_conflict",
          message: "The cloud library changed. Reload before saving again.",
          revision: snapshot.revision,
        },
        409,
      );
    }

    if (error instanceof TypeError) {
      return noStoreJson({ error: "invalid_game_data" }, 400);
    }

    return handleStorageError(error);
  }
}

function authorize(request: Request) {
  if (!isAdminAuthConfigured()) {
    return noStoreJson({ error: "admin_auth_not_configured" }, 503);
  }

  if (!hasValidAdminSession(request)) {
    return noStoreJson({ error: "admin_session_required" }, 401);
  }

  return undefined;
}

function handleStorageError(error: unknown) {
  if (error instanceof DatabaseNotConfiguredError) {
    return noStoreJson({ error: "database_not_configured" }, 503);
  }

  console.error("[Games Sync] Storage request failed", {
    message: error instanceof Error ? error.message : "unknown_error",
  });
  return noStoreJson({ error: "game_storage_unavailable" }, 500);
}

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
