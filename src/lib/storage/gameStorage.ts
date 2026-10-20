import type { Game } from "@/types/game";
import type { SyncMetadata } from "@/lib/storage/gameSync";

const STORAGE_KEY = "ps-game-library:v1";
const BACKUP_STORAGE_KEY = "ps-game-library:backup:v1";
const RECOVERY_PREFIX = "ps-game-library:recovery:v1:";
const legacySeedGameIds = new Set([
  "seed-astro-bot",
  "seed-ff7-rebirth",
  "seed-silent-hill-2",
]);

export function loadGames(): Game[] {
  return loadStoredGames(STORAGE_KEY, true);
}

export function loadGameBackup(): Game[] {
  return loadStoredGames(BACKUP_STORAGE_KEY, false);
}

export function saveGames(games: Game[]) {
  if (typeof window === "undefined") {
    return false;
  }

  const serializedGames = JSON.stringify(games);
  const currentGames = loadStoredGames(STORAGE_KEY, false);
  const serializedCurrentGames = JSON.stringify(currentGames);

  try {
    if (currentGames.length > 0 && serializedCurrentGames !== serializedGames) {
      window.localStorage.setItem(BACKUP_STORAGE_KEY, serializedCurrentGames);
    }

    window.localStorage.setItem(STORAGE_KEY, serializedGames);
    return true;
  } catch {
    // A failed cache/backup must not prevent a separate cloud save.
    return false;
  }
}

export function restoreGameBackup() {
  if (typeof window === "undefined") {
    return [];
  }

  const backupGames = loadGameBackup();
  if (backupGames.length === 0) {
    return [];
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(backupGames));
  return backupGames;
}

export function saveGameRecovery(games: Game[], metadata: SyncMetadata) {
  try {
    const key = `${RECOVERY_PREFIX}${metadata.fingerprint}`;
    // Conflict recovery copies are immutable, separate from the rolling cache backup.
    if (!window.localStorage.getItem(key)) {
      window.localStorage.setItem(key, JSON.stringify({
        games, ...metadata, savedAt: new Date().toISOString(),
      }));
    }
    return true;
  } catch {
    return false;
  }
}

function loadStoredGames(storageKey: string, migrateLegacySeeds: boolean): Game[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const games = migrateLegacySeeds ? parsed.filter((game) => !legacySeedGameIds.has(game?.id)) : parsed;

    if (migrateLegacySeeds && games.length !== parsed.length) {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(games));
      } catch {
        // Keep readable games even when the browser refuses a cache write.
      }
    }

    return games;
  } catch {
    return [];
  }
}
