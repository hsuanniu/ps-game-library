import type { GameStatus, LibraryFilter, OwnershipType, Platform } from "@/types/game";
import { filterTerms, ownershipTerms, statusTerms } from "@/lib/terminology";

export const statusLabels: Record<GameStatus, string> = statusTerms;

export const ownershipLabels: Record<OwnershipType, string> = ownershipTerms;

export const platformLabels: Record<Platform, string> = {
  PS5: "PS5",
  PS4: "PS4",
  PS4_PS5: "PS4 & PS5",
};

export const gameVersionOptions: Array<{ value: Exclude<Platform, "PS4_PS5">; label: string }> = [
  { value: "PS5", label: platformLabels.PS5 },
  { value: "PS4", label: platformLabels.PS4 },
];

export const filterLabels: Record<LibraryFilter, string> = filterTerms;

export const statusOptions = Object.entries(statusLabels).map(([value, label]) => ({
  value,
  label,
}));

export const visibleStatusOptions: Array<{ value: GameStatus; label: string }> = [
  { value: "owned", label: "收藏" },
  { value: "wishlist", label: statusLabels.wishlist },
  { value: "borrowed", label: statusLabels.borrowed },
  { value: "rented", label: statusLabels.rented },
  { value: "sold", label: statusLabels.sold },
];

export const ownershipOptions = Object.entries(ownershipLabels).map(([value, label]) => ({
  value,
  label,
}));

export const visibleOwnershipOptions: Array<{ value: Extract<OwnershipType, "disc" | "digital">; label: string }> = [
  { value: "disc", label: "光碟版" },
  { value: "digital", label: "下載版" },
];

export const platformOptions = gameVersionOptions;

export const filterOptions = Object.entries(filterLabels).map(([value, label]) => ({
  value,
  label,
}));
