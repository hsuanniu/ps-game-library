import { getCollectionGames, isWishlistGame } from "@/lib/gameCollection";
import type { Game } from "@/types/game";

export function getGameStats(games: Game[]) {
  const collectionGames = getCollectionGames(games);

  return {
    total: collectionGames.length,
    all: games.length,
    owned: collectionGames.filter((game) => game.status === "owned" || game.status === "playing" || game.status === "finished").length,
    wishlist: games.filter(isWishlistGame).length,
    waitingSale: games.filter((game) => game.status === "waiting_sale").length,
    borrowedOrRented: collectionGames.filter((game) => game.status === "borrowed" || game.status === "rented" || game.ownershipType === "borrowed" || game.ownershipType === "rented").length,
    sold: games.filter((game) => game.status === "sold" || game.ownershipType === "sold").length,
    totalHours: collectionGames.reduce((sum, game) => sum + (game.playTimeHours ?? 0), 0),
  };
}
