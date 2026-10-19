import { filterGameApiRecords, toGameApiRecord, type GameApiFilters } from "@/lib/api/gameApi";
import { createGamesPage, type GamesListQuery } from "@/lib/api/gameApiQuery";
import { getStoredGamesForApi } from "@/lib/server/gameRepository";

export async function listGameRecords(query: GamesListQuery, maxBytes?: number) {
  const games = await getStoredGamesForApi(query.fields.includes("cover_url"));
  const records = filterGameApiRecords(games.map(toGameApiRecord), query.filters);
  return createGamesPage(records, query, maxBytes);
}

export async function countGameRecords(filters: GameApiFilters) {
  const games = await getStoredGamesForApi();
  return { total: filterGameApiRecords(games.map(toGameApiRecord), filters).length };
}

export async function getGameRecord(id: string, query: GamesListQuery, maxBytes?: number) {
  const games = await getStoredGamesForApi(query.fields.includes("cover_url"));
  const game = games.find((item) => item.id === id);
  if (!game) return undefined;
  return createGamesPage([toGameApiRecord(game)], { ...query, offset: 0, limit: 1 }, maxBytes).games[0];
}
