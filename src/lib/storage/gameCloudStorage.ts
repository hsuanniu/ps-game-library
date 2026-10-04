import type { Game } from "@/types/game";
import type { StoredGamesSnapshot } from "@/types/gameApi";

interface SessionStatus {
  authenticated: boolean;
  databaseConfigured: boolean;
  adminAuthConfigured: boolean;
}

interface SaveResult {
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

export function loadCloudGames() {
  return requestJson<StoredGamesSnapshot>("/api/internal/games");
}

export function saveCloudGames(games: Game[], expectedRevision: number) {
  return requestJson<SaveResult>("/api/internal/games", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ games, expectedRevision }),
  });
}

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as { error?: string } & T;

  if (!response.ok) {
    throw new CloudStorageError(body.error ?? "cloud_storage_error", response.status);
  }

  return body;
}
