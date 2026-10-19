import { formatTaiwanAgeRating } from "@/lib/gameMetadataDisplay";
import type { Game } from "@/types/game";
import type { ApiOwnershipStatus, ApiPlayStatus, ApiProgressSource, GameApiRecord } from "@/types/gameApi";

export interface GameApiFilters {
  search?: string;
  platform?: string;
  genre?: string;
  series?: string;
  status?: string;
  playStatus?: string;
  ownershipStatus?: string;
}

export function toGameApiRecord(game: Game): GameApiRecord {
  const ownershipStatus = getOwnershipStatus(game);
  const ageRatingDisplay = formatTaiwanAgeRating(game.ageRating);
  const completion = getCompletion(game);
  const progress = getPlayStatus(game, completion);

  return {
    id: game.id,
    title: game.title,
    display_title: game.displayTitle ?? null,
    cover_url: game.coverUrl ?? null,
    platform: game.platform,
    status: game.status,
    play_status: progress.status,
    play_status_source: progress.source,
    ownership_status: ownershipStatus,
    ownership_type: game.ownershipType,
    is_owned: ownershipStatus === "owned" || ownershipStatus === "lent",
    wishlist: ownershipStatus === "wishlist",
    genre: game.genre ?? [],
    age_rating: game.ageRating
      ? {
          ...game.ageRating,
          display: ageRatingDisplay ?? `${game.ageRating.system} ${game.ageRating.rating}`,
        }
      : null,
    rating: null,
    hours_played: game.playTimeHours ?? null,
    is_completed: completion.value,
    completion_source: completion.source,
    completed_date: null,
    series: game.seriesName
      ? {
          name: game.seriesName,
          order: game.seriesOrder ?? null,
        }
      : null,
    purchase: {
      price: game.purchasePrice ?? null,
      date: game.purchaseDate ?? null,
    },
    loan_person: game.loanPerson ?? null,
    notes: game.notes ?? "",
    added_at: game.addedAt ?? null,
    created_at: game.createdAt,
    updated_at: game.updatedAt,
  };
}

export function filterGameApiRecords(records: GameApiRecord[], filters: GameApiFilters) {
  const search = normalize(filters.search);
  const platform = normalize(filters.platform);
  const genre = normalize(filters.genre);
  const series = normalize(filters.series);
  const status = normalize(filters.status);
  const playStatus = normalize(filters.playStatus);
  const ownershipStatus = normalize(filters.ownershipStatus);

  return records.filter((game) => {
    if (platform && normalize(game.platform) !== platform) {
      return false;
    }

    if (status && normalize(game.status) !== status) {
      return false;
    }

    if (playStatus && normalize(game.play_status) !== playStatus) {
      return false;
    }

    if (ownershipStatus && !matchesOwnershipStatus(game, ownershipStatus)) {
      return false;
    }

    if (genre && !game.genre.some((item) => normalize(item).includes(genre))) {
      return false;
    }

    if (series && !normalize(game.series?.name).includes(series)) {
      return false;
    }

    if (search) {
      const searchable = [
        game.title,
        game.display_title,
        game.series?.name,
        game.notes,
        ...game.genre,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("zh-TW");

      if (!searchable.includes(search)) {
        return false;
      }
    }

    return true;
  });
}

function getOwnershipStatus(game: Game): ApiOwnershipStatus {
  if (game.status === "wishlist" || game.status === "waiting_sale") {
    return "wishlist";
  }

  if (game.status === "sold" || game.ownershipType === "sold") {
    return "sold";
  }

  if (game.status === "borrowed" || game.ownershipType === "borrowed") {
    return "borrowed";
  }

  if (game.status === "rented" || game.ownershipType === "rented") {
    return "lent";
  }

  return "owned";
}

function getCompletion(game: Game): { value: boolean | null; source: ApiProgressSource } {
  if (typeof game.isCompleted === "boolean") {
    return { value: game.isCompleted, source: "isCompleted" };
  }
  if (game.status === "finished") {
    return { value: true, source: "status" };
  }
  return { value: null, source: null };
}

function getPlayStatus(
  game: Game,
  completion: ReturnType<typeof getCompletion>,
): { status: ApiPlayStatus; source: ApiProgressSource } {
  if (completion.value === true) {
    return { status: "completed", source: completion.source };
  }
  if (game.status === "playing" || game.status === "paused") {
    return { status: game.status, source: "status" };
  }
  return { status: "not_recorded", source: null };
}

function matchesOwnershipStatus(game: GameApiRecord, filter: string) {
  if (filter === "not_owned") {
    return !game.is_owned;
  }

  return normalize(game.ownership_status) === filter;
}

function normalize(value?: string | null) {
  return value?.trim().toLocaleLowerCase("zh-TW") ?? "";
}
