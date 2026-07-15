import type { Game } from "@/types/game";

export function isWishlistGame(game: Game) {
  return game.status === "wishlist" || game.status === "waiting_sale";
}

export function isSoldGame(game: Game) {
  return game.status === "sold" || game.ownershipType === "sold";
}

export function isCollectionGame(game: Game) {
  return !isWishlistGame(game) && !isSoldGame(game);
}

export function getCollectionGames(games: Game[]) {
  return games.filter(isCollectionGame);
}
