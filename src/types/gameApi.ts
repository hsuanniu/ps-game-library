import type { AgeRating, Game, GameStatus, OwnershipType, Platform } from "@/types/game";

export type ApiPlayStatus =
  | "backlog"
  | "playing"
  | "completed"
  | "paused"
  | "not_started"
  | "not_recorded";

export type ApiOwnershipStatus = "owned" | "wishlist" | "borrowed" | "lent" | "sold";

export interface GameApiRecord {
  id: string;
  title: string;
  display_title: string | null;
  cover_url: string | null;
  platform: Platform;
  status: GameStatus;
  play_status: ApiPlayStatus;
  ownership_status: ApiOwnershipStatus;
  ownership_type: OwnershipType;
  is_owned: boolean;
  wishlist: boolean;
  genre: string[];
  age_rating: (AgeRating & { display: string }) | null;
  rating: number | null;
  hours_played: number | null;
  is_completed: boolean;
  completed_date: string | null;
  series: {
    name: string;
    order: number | null;
  } | null;
  purchase: {
    price: number | null;
    date: string | null;
  };
  loan_person: string | null;
  notes: string;
  added_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GamesApiResponse {
  games: Partial<GameApiRecord>[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
  nextOffset: number | null;
  returned: number;
  /** @deprecated Use total for the number of matching games. */
  count: number;
  generated_at: string;
}

export interface GamesCountApiResponse {
  total: number;
}

export interface GameApiResponse {
  game: GameApiRecord;
  generated_at: string;
}

export interface StoredGamesSnapshot {
  games: Game[];
  initialized: boolean;
  revision: number;
  updatedAt: string | null;
}
