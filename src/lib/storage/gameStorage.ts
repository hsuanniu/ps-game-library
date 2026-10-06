import type { Game } from "@/types/game";

const STORAGE_KEY = "ps-game-library:v1";
const BACKUP_STORAGE_KEY = "ps-game-library:backup:v1";
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
    return;
  }

  const serializedGames = JSON.stringify(games);
  const currentGames = loadStoredGames(STORAGE_KEY, false);
  const serializedCurrentGames = JSON.stringify(currentGames);

  if (currentGames.length > 0 && serializedCurrentGames !== serializedGames) {
    window.localStorage.setItem(BACKUP_STORAGE_KEY, serializedCurrentGames);
  }

  window.localStorage.setItem(STORAGE_KEY, serializedGames);
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
      window.localStorage.setItem(storageKey, JSON.stringify(games));
    }

    return games;
  } catch {
    return [];
  }
}
