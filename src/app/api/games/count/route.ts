import { readGameApiFilters } from "@/lib/api/gameApiQuery";
import { countGameRecords } from "@/lib/server/gameReadService";
import { authorizeGamesApi, gamesApiErrorResponse, gamesApiJson } from "@/lib/server/gamesApiResponse";
import type { GamesCountApiResponse } from "@/types/gameApi";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = authorizeGamesApi(request);
  if (unauthorized) return unauthorized;

  try {
    const filters = readGameApiFilters(new URL(request.url).searchParams);
    const response: GamesCountApiResponse = await countGameRecords(filters);
    return gamesApiJson(response);
  } catch (error) {
    return gamesApiErrorResponse(error);
  }
}
