import { gameMcpHandler } from "@/lib/server/gameMcp";
import { authorizeGamesApi, gamesApiJson } from "@/lib/server/gamesApiResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(request: Request) {
  const unauthorized = authorizeGamesApi(request);
  if (unauthorized) return unauthorized;

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return gamesApiJson({ error: "forbidden_origin" }, 403);
  }

  const response = await gameMcpHandler(request);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export { handler as GET, handler as POST };
