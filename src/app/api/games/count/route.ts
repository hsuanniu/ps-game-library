import { filterGameApiRecords, toGameApiRecord } from "@/lib/api/gameApi";
import { readGameApiFilters } from "@/lib/api/gameApiQuery";
import { getStoredGamesForApi } from "@/lib/server/gameRepository";
import { authorizeGamesApi, gamesApiErrorResponse, gamesApiJson } from "@/lib/server/gamesApiResponse";
import type { GamesCountApiResponse } from "@/types/gameApi";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = authorizeGamesApi(request);
  if (unauthorized) return unauthorized;

  try {
    const filters = readGameApiFilters(new URL(request.url).searchParams);
    const games = await getStoredGamesForApi();
    const total = filterGameApiRecords(games.map(toGameApiRecord), filters).length;
    const response: GamesCountApiResponse = { total };
    return gamesApiJson(response);
  } catch (error) {
    return gamesApiErrorResponse(error);
  }
}
