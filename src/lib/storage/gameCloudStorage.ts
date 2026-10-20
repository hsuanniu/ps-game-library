import type { Game } from "@/types/game";
import type { StoredGamesSnapshot } from "@/types/gameApi";

interface SessionStatus {
  authenticated: boolean;
  databaseConfigured: boolean;
  adminAuthConfigured: boolean;
}

export interface SaveResult {
  ok: true;
  revision: number;
  updatedAt: string;
}

export class CloudStorageError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
    this.name = "CloudStorageError";
  }
}

export function getCloudSessionStatus() {
  return requestJson<SessionStatus>("/api/internal/session");
}

export function createCloudSession(token: string) {
  return requestJson<{ authenticated: true }>("/api/internal/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
}

export function deleteCloudSession() {
  return requestJson<{ authenticated: false }>("/api/internal/session", {
    method: "DELETE",
  });
}

export async function loadCloudGames() {
  const value = await requestJson<StoredGamesSnapshot>("/api/internal/games");
  if (!Array.isArray(value.games) || typeof value.initialized !== "boolean" || !Number.isSafeInteger(value.revision) || value.revision < 0) {
    throw new CloudStorageError("invalid_cloud_snapshot", 502);
  }
  return value;
}

export async function saveCloudGames(games: Game[], expectedRevision: number) {
  const body = JSON.stringify({ games, expectedRevision });
  if (new TextEncoder().encode(body).byteLength > 4_000_000) {
    return Promise.reject(new CloudStorageError("payload_too_large", 413));
  }
  const value = await requestJson<SaveResult>("/api/internal/games", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (value.ok !== true || !Number.isSafeInteger(value.revision) || value.revision <= expectedRevision || typeof value.updatedAt !== "string") {
    throw new CloudStorageError("invalid_cloud_acknowledgement", 502);
  }
  return value;
}

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json().catch(() => null) as ({ error?: string } & T) | null;

  if (!response.ok) {
    throw new CloudStorageError(body?.error ?? "cloud_storage_error", response.status);
  }

  if (!body) throw new CloudStorageError("invalid_cloud_response", 502);
  return body;
}
