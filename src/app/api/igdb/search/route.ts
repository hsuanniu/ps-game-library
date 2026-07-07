import { NextResponse } from "next/server";
import type { AgeRating, GameSearchResult, Platform } from "@/types/game";

interface TwitchTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface ApiErrorPayload {
  error: string;
  message: string;
  results: [];
}

interface IgdbGame {
  id: number;
  name: string;
  cover?: {
    image_id?: string;
  };
  first_release_date?: number;
  platforms?: Array<{
    name?: string;
  }>;
  collections?: Array<{
    name?: string;
  }>;
  franchises?: Array<{
    name?: string;
  }>;
  genres?: Array<{
    name?: string;
  }>;
  age_ratings?: IgdbAgeRating[];
}

interface IgdbAgeRating {
  category?: number;
  rating?: number;
  organization?: {
    name?: string;
  };
  rating_category?: {
    rating?: string;
  };
}

let cachedToken: {
  accessToken: string;
  expiresAt: number;
} | null = null;

function escapeIgdbSearch(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function inferGameVersion(platforms: string[] = []): Platform {
  if (platforms.some((platform) => platform.toLowerCase().includes("playstation 5"))) {
    return "PS5";
  }

  return "PS4";
}

function toYear(timestamp?: number) {
  if (!timestamp) {
    return undefined;
  }

  return new Date(timestamp * 1000).getUTCFullYear().toString();
}

function toCoverUrl(imageId?: string) {
  if (!imageId) {
    return undefined;
  }

  return `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${imageId}.jpg`;
}

const ageRatingSystemPriority = ["PEGI", "ESRB", "CERO", "USK", "ACB"];

const ageRatingCategoryLabels: Record<number, string> = {
  1: "ESRB",
  2: "PEGI",
  3: "CERO",
  4: "USK",
  7: "ACB",
};

const ageRatingValueLabels: Record<number, string> = {
  1: "3",
  2: "7",
  3: "12",
  4: "16",
  5: "18",
  6: "RP",
  7: "EC",
  8: "E",
  9: "E10+",
  10: "T",
  11: "M",
  12: "AO",
  13: "A",
  14: "B",
  15: "C",
  16: "D",
  17: "Z",
  18: "0",
  19: "6",
  20: "12",
  21: "16",
  22: "18",
};

function normalizeAgeRatingLabel(value?: string | number) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "number") {
    return ageRatingValueLabels[value] ?? String(value);
  }

  return value
    .replace(/^CERO_/i, "")
    .replace(/^USK_/i, "")
    .replace(/^PEGI_/i, "")
    .replace(/^ESRB_/i, "")
    .replaceAll("_", " ")
    .replace(/\bE10\b/i, "E10+")
    .trim();
}

function normalizeAgeRatingSystem(rating: IgdbAgeRating) {
  const organizationName = rating.organization?.name?.trim();

  if (organizationName) {
    return organizationName.toUpperCase();
  }

  return rating.category ? ageRatingCategoryLabels[rating.category] : undefined;
}

function getAgeRatingPriority(system: string) {
  const index = ageRatingSystemPriority.indexOf(system);

  return index === -1 ? ageRatingSystemPriority.length : index;
}

function toAgeRating(ageRatings: IgdbAgeRating[] = []): AgeRating | undefined {
  const normalizedRatings = ageRatings
    .map((rating) => {
      const system = normalizeAgeRatingSystem(rating);
      const ratingLabel = normalizeAgeRatingLabel(rating.rating_category?.rating ?? rating.rating);

      if (!system || !ratingLabel) {
        return undefined;
      }

      return {
        system,
        rating: ratingLabel,
      };
    })
    .filter(Boolean) as AgeRating[];

  return normalizedRatings.sort((a, b) => getAgeRatingPriority(a.system) - getAgeRatingPriority(b.system))[0];
}

async function getIgdbAccessToken(clientId: string, clientSecret: string) {
  const now = Date.now();

  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.accessToken;
  }

  const tokenUrl = new URL("https://id.twitch.tv/oauth2/token");
  tokenUrl.searchParams.set("client_id", clientId);
  tokenUrl.searchParams.set("client_secret", clientSecret);
  tokenUrl.searchParams.set("grant_type", "client_credentials");

  const response = await fetch(tokenUrl, {
    method: "POST",
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[IGDB] OAuth token request failed", {
      status: response.status,
      statusText: response.statusText,
      body: errorText.slice(0, 300),
    });
    throw new Error(`oauth_failed:${response.status}`);
  }

  const data = (await response.json()) as TwitchTokenResponse;
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return data.access_token;
}

function normalizeIgdbGame(game: IgdbGame): GameSearchResult {
  const platforms = game.platforms?.map((platform) => platform.name).filter(Boolean) as string[] | undefined;
  const genres = game.genres?.map((genre) => genre.name).filter(Boolean) as string[] | undefined;

  return {
    id: String(game.id),
    title: game.name,
    coverUrl: toCoverUrl(game.cover?.image_id),
    platform: inferGameVersion(platforms),
    year: toYear(game.first_release_date),
    platforms,
    collectionName: game.collections?.[0]?.name,
    franchiseName: game.franchises?.[0]?.name,
    genre: genres,
    ageRating: toAgeRating(game.age_ratings),
    source: "igdb",
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const clientId = process.env.IGDB_CLIENT_ID;
  const clientSecret = process.env.IGDB_CLIENT_SECRET;

  console.log("[IGDB] Environment check", {
    hasClientId: Boolean(clientId),
    hasClientSecret: Boolean(clientSecret),
  });

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  if (!clientId || !clientSecret) {
    console.error("[IGDB] Missing environment variables", {
      hasClientId: Boolean(clientId),
      hasClientSecret: Boolean(clientSecret),
    });
    return NextResponse.json(
      {
        error: "missing_igdb_credentials",
        message: "missing IGDB_CLIENT_ID or IGDB_CLIENT_SECRET",
        results: [],
      } satisfies ApiErrorPayload,
      { status: 503 },
    );
  }

  try {
    const accessToken = await getIgdbAccessToken(clientId, clientSecret);
    const body = [
      `search "${escapeIgdbSearch(query)}";`,
      "fields id,name,cover.image_id,first_release_date,platforms.name,collections.name,franchises.name,genres.name,age_ratings.category,age_ratings.rating,age_ratings.organization.name,age_ratings.rating_category.rating;",
      "where version_parent = null;",
      "limit 8;",
    ].join(" ");

    const response = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Client-ID": clientId,
        "Authorization": `Bearer ${accessToken}`,
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[IGDB] Games API request failed", {
        status: response.status,
        statusText: response.statusText,
        body: errorText.slice(0, 500),
      });
      return NextResponse.json(
        {
          error: "igdb_api_error",
          message: `IGDB API error: ${response.status}`,
          results: [],
        } satisfies ApiErrorPayload,
        { status: 502 },
      );
    }

    const data = (await response.json()) as IgdbGame[];

    return NextResponse.json({
      results: data.map(normalizeIgdbGame),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";

    console.error("[IGDB] Search route failed", {
      message,
    });

    if (message.startsWith("oauth_failed")) {
      return NextResponse.json(
        {
          error: "igdb_oauth_error",
          message: "IGDB OAuth token request failed",
          results: [],
        } satisfies ApiErrorPayload,
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        error: "igdb_api_error",
        message: "IGDB search failed",
        results: [],
      } satisfies ApiErrorPayload,
      { status: 502 },
    );
  }
}
