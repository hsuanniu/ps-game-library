import type { Game } from "@/types/game";

const STORAGE_KEY = "ps-game-library:v1";
const legacySeedGameIds = new Set([
  "seed-astro-bot",
  "seed-ff7-rebirth",
  "seed-silent-hill-2",
]);

export function loadGames(): Game[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const migratedGames = parsed.filter((game) => !legacySeedGameIds.has(game?.id));

    if (migratedGames.length !== parsed.length) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migratedGames));
    }

    return migratedGames;
  } catch {
    return [];
  }
}

export function saveGames(games: Game[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
}
