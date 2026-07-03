export type GameStatus =
  | "owned"
  | "wishlist"
  | "waiting_sale"
  | "playing"
  | "finished"
  | "paused"
  | "borrowed"
  | "rented"
  | "sold";

export type OwnershipType =
  | "disc"
  | "digital"
  | "borrowed"
  | "rented"
  | "ps_plus"
  | "sold";

export type Platform =
  | "PS5"
  | "PS4"
  /** @deprecated 舊資料相容，不再顯示於 UI。 */
  | "PS4_PS5";

export interface AgeRating {
  system: string;
  rating: string;
}

export interface Game {
  id: string;
  title: string;
  displayTitle?: string;
  coverUrl?: string;
  platform: Platform;
  status: GameStatus;
  ownershipType: OwnershipType;
  playTimeHours?: number;
  purchasePrice?: number;
  purchaseDate?: string;
  seriesName?: string;
  seriesOrder?: number;
  genre?: string[];
  ageRating?: AgeRating;
  isCompleted?: boolean;
  loanPerson?: string;
  notes?: string;
  addedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type GameDraft = Omit<Game, "id" | "addedAt" | "createdAt" | "updatedAt">;

export type LibraryFilter =
  | "all"
  | "collection"
  | "disc"
  | "digital"
  | "owned"
  | "wishlist"
  | "waiting_sale"
  | "borrowed"
  | "rented"
  | "sold";

export type LibrarySort = "newest" | "name-asc" | "name-desc" | "playtime-desc" | "playtime-asc";

export type LibrarySortContext = "library" | "disc" | "digital" | "wishlist" | "playtime";

export interface GameSearchResult {
  id: string;
  title: string;
  coverUrl?: string;
  platform?: Platform;
  releaseDate?: string;
  year?: string;
  platforms?: string[];
  collectionName?: string;
  franchiseName?: string;
  ageRating?: AgeRating;
  source?: "igdb" | "mock";
  genre?: string[];
}
