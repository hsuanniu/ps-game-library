import { mockSearchResults } from "@/data/mockSearchResults";
import { resolveGameSearchQuery } from "@/lib/gameAliases";
import type { GameSearchResult } from "@/types/game";

export class GameSearchError extends Error {
  constructor(
    message: string,
    public fallbackResults: GameSearchResult[] = [],
  ) {
    super(message);
    this.name = "GameSearchError";
  }
}

function searchMockGames(query: string): GameSearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  return mockSearchResults.filter((game) =>
    game.title.toLowerCase().includes(normalizedQuery),
  );
}

export async function searchGames(query: string): Promise<GameSearchResult[]> {
  const normalizedQuery = query.trim();
  const searchQuery = resolveGameSearchQuery(normalizedQuery);

  if (!normalizedQuery) {
    return [];
  }

  try {
    const response = await fetch(`/api/igdb/search?q=${encodeURIComponent(searchQuery)}`);
    const data = (await response.json()) as {
      results?: GameSearchResult[];
      message?: string;
    };

    if (!response.ok) {
      throw new GameSearchError(data.message ?? "搜尋失敗，請稍後再試", searchMockGames(searchQuery));
    }

    return data.results ?? [];
  } catch (error) {
    if (error instanceof GameSearchError) {
      throw error;
    }

    throw new GameSearchError("搜尋失敗，請稍後再試", searchMockGames(searchQuery));
  }
}

export async function getGameCover(gameId: string): Promise<string | undefined> {
  await new Promise((resolve) => setTimeout(resolve, 160));
  return mockSearchResults.find((game) => game.id === gameId)?.coverUrl;
}

export function normalizeGameData(apiResponse: GameSearchResult): GameSearchResult {
  return {
    id: apiResponse.id,
    title: apiResponse.title,
    coverUrl: apiResponse.coverUrl,
    platform: apiResponse.platform,
    releaseDate: apiResponse.releaseDate,
    year: apiResponse.year,
    platforms: apiResponse.platforms,
    collectionName: apiResponse.collectionName,
    franchiseName: apiResponse.franchiseName,
    ageRating: apiResponse.ageRating,
    source: apiResponse.source,
    genre: apiResponse.genre ?? [],
  };
}
