import type { Game, GameDraft, GameStatus, OwnershipType } from "@/types/game";

export function normalizeVisibleStatus(status: GameStatus): GameStatus {
  if (["playing", "finished", "paused"].includes(status)) return "owned";
  return status === "waiting_sale" ? "wishlist" : status;
}

export function normalizeVisibleOwnershipType(value: OwnershipType): OwnershipType {
  return value === "disc" || value === "digital" ? value : "digital";
}

export function completionForForm(game: Game) {
  return game.isCompleted ?? game.status === "finished";
}

export function preserveLegacyDraft(draft: GameDraft, original?: Game): GameDraft {
  if (!original) return draft;
  const status = draft.status === normalizeVisibleStatus(original.status) ? original.status : draft.status;
  return {
    ...draft,
    status,
    platform: original.platform === "PS4_PS5" && draft.platform === "PS5" ? original.platform : draft.platform,
    ownershipType: draft.ownershipType === normalizeVisibleOwnershipType(original.ownershipType) ? original.ownershipType : draft.ownershipType,
    isCompleted: draft.isCompleted === completionForForm(original) ? original.isCompleted : draft.isCompleted,
    loanPerson: status === "borrowed" || status === "rented" ? draft.loanPerson : undefined,
  };
}
