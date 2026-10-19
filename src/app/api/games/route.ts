import { readGamesListQuery } from "@/lib/api/gameApiQuery";
import { listGameRecords } from "@/lib/server/gameReadService";
import { authorizeGamesApi, gamesApiErrorResponse, gamesApiJson } from "@/lib/server/gamesApiResponse";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = authorizeGamesApi(request);
  if (unauthorized) return unauthorized;

  try {
    const query = readGamesListQuery(new URL(request.url).searchParams);
    return gamesApiJson(await listGameRecords(query));
  } catch (error) {
    return gamesApiErrorResponse(error);
  }
}
