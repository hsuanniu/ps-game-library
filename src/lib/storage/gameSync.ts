import type { Game } from "@/types/game";
import type { StoredGamesSnapshot } from "@/types/gameApi";
import { CloudStorageError, type SaveResult } from "@/lib/storage/gameCloudStorage";

export interface SyncMetadata {
  baseRevision: number | null;
  dirty: boolean;
  fingerprint: string;
}

export type SyncIssue = "offline" | "auth" | "conflict" | "setup" | "capacity" | "cache";
export interface SyncResult { synced: boolean; localSaved: boolean; issue: SyncIssue | null }
interface SyncDependencies {
  loadCloud: () => Promise<StoredGamesSnapshot>;
  saveCloud: (games: Game[], revision: number) => Promise<SaveResult>;
  saveLocal: (games: Game[], metadata: SyncMetadata) => boolean;
  saveRecovery: (games: Game[], metadata: SyncMetadata) => boolean;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  }
  return value;
}

export function libraryContent(games: Game[]) {
  return JSON.stringify([...games].sort((a, b) => a.id.localeCompare(b.id)).map(canonical));
}

export async function libraryFingerprint(games: Game[]) {
  const bytes = new TextEncoder().encode(libraryContent(games));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function issueFor(error: unknown): SyncIssue {
  if (error instanceof CloudStorageError) {
    if (error.status === 409) return "conflict";
    if (error.status === 401 || error.status === 403) return "auth";
    if (error.status === 413) return "capacity";
    if (error.status === 503) return "setup";
  }
  return "offline";
}

export class GameSync {
  games: Game[] = [];
  revision: number | null = null;
  dirty = false;
  issue: SyncIssue | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly dependencies: SyncDependencies) {}

  async initialize(localGames: Game[], metadata: SyncMetadata | null) {
    this.games = localGames;
    this.revision = metadata?.baseRevision ?? null;
    this.dirty = Boolean(metadata?.dirty);
    try {
      const cloud = await this.dependencies.loadCloud();
      if (!cloud.initialized) {
        this.issue = "setup";
        return;
      }
      const same = libraryContent(cloud.games) === libraryContent(localGames);
      const trustedCache = metadata && !metadata.dirty && metadata.fingerprint === await libraryFingerprint(localGames);
      if (!same && (this.dirty || (localGames.length > 0 && !trustedCache))) {
        this.dirty = true;
        this.issue = this.revision === cloud.revision ? "offline" : "conflict";
        return;
      }
      this.games = cloud.games;
      this.revision = cloud.revision;
      this.dirty = false;
      this.issue = await this.cache(false) ? null : "cache";
    } catch (error) {
      this.issue = issueFor(error);
    }
  }

  mutate(change: (games: Game[]) => Game[]) {
    return this.enqueue(async () => {
      const previous = this.games;
      const next = change(previous);
      return this.persist(next, previous);
    });
  }

  retry() {
    return this.enqueue(async () => {
      if (!this.dirty) {
        const metadata = { baseRevision: this.revision, dirty: false, fingerprint: await libraryFingerprint(this.games) };
        await this.initialize(this.games, metadata);
        return { synced: this.issue === null || this.issue === "cache", localSaved: this.issue !== "cache", issue: this.issue };
      }
      return this.persist(this.games, this.games);
    });
  }

  loadCloudWithBackup() {
    return this.enqueue(async () => {
      const cloud = await this.dependencies.loadCloud();
      if (!cloud.initialized) throw new CloudStorageError("cloud_not_initialized", 503);
      const recoverySaved = this.dependencies.saveRecovery(this.games, {
        baseRevision: this.revision, dirty: this.dirty, fingerprint: await libraryFingerprint(this.games),
      });
      if (!recoverySaved) throw new CloudStorageError("local_backup_failed", 413);
      // The storage adapter backs up the old local data before replacing it.
      const saved = this.dependencies.saveLocal(cloud.games, {
        baseRevision: cloud.revision, dirty: false, fingerprint: await libraryFingerprint(cloud.games),
      });
      if (!saved) throw new CloudStorageError("local_backup_failed", 413);
      this.games = cloud.games;
      this.revision = cloud.revision;
      this.dirty = false;
      this.issue = null;
    });
  }

  private enqueue<T>(action: () => Promise<T>): Promise<T> {
    const next = this.queue.catch(() => undefined).then(action);
    this.queue = next;
    return next;
  }

  private async cache(dirty: boolean, games = this.games) {
    return this.dependencies.saveLocal(games, {
      baseRevision: this.revision, dirty, fingerprint: await libraryFingerprint(games),
    });
  }

  private async persist(next: Game[], previous: Game[]): Promise<SyncResult> {
    const localSaved = await this.cache(true, next);
    try {
      const cloud = await this.dependencies.loadCloud();
      if (!cloud.initialized) throw new CloudStorageError("cloud_not_initialized", 503);
      if (libraryContent(cloud.games) !== libraryContent(next)) {
        if (this.revision === null) {
          if (libraryContent(cloud.games) !== libraryContent(previous)) throw new CloudStorageError("sync_conflict", 409);
          this.revision = cloud.revision;
        }
        if (cloud.revision !== this.revision) throw new CloudStorageError("sync_conflict", 409);
        const result = await this.dependencies.saveCloud(next, this.revision);
        this.revision = result.revision;
      } else {
        // A timed-out write may already have committed; acknowledge it, never replay it.
        this.revision = cloud.revision;
      }
      this.games = next;
      this.dirty = false;
      this.issue = await this.cache(false) ? null : "cache";
      return { synced: true, localSaved: this.issue === null, issue: this.issue };
    } catch (error) {
      this.issue = issueFor(error);
      if (!localSaved) throw new CloudStorageError("unsaved_local_and_cloud", 507);
      this.games = next;
      this.dirty = true;
      return { synced: false, localSaved: true, issue: this.issue };
    }
  }
}
