import { formatTaiwanAgeRating } from "@/lib/gameMetadataDisplay";
import type { Game } from "@/types/game";
import type { ApiOwnershipStatus, ApiPlayStatus, GameApiRecord } from "@/types/gameApi";

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

  return {
    id: game.id,
    title: game.title,
    display_title: game.displayTitle ?? null,
    cover_url: game.coverUrl ?? null,
    platform: game.platform,
    status: game.status,
    play_status: getPlayStatus(game),
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
    is_completed: game.isCompleted ?? game.status === "finished",
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

function getPlayStatus(game: Game): ApiPlayStatus {
  if (game.isCompleted || game.status === "finished") {
    return "completed";
  }

  if (game.status === "playing") {
    return "playing";
  }

  if (game.status === "paused") {
    return "paused";
  }

  if (game.status === "wishlist" || game.status === "waiting_sale") {
    return "not_started";
  }

  if ((game.playTimeHours ?? 0) === 0 && game.status !== "sold") {
    return "backlog";
  }

  return "not_recorded";
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
