import type { Game } from "@/types/game";

export function getGameStats(games: Game[]) {
  return {
    total: games.length,
    owned: games.filter((game) => game.status === "owned" || game.status === "playing" || game.status === "finished").length,
    wishlist: games.filter((game) => game.status === "wishlist").length,
    waitingSale: games.filter((game) => game.status === "waiting_sale").length,
    borrowedOrRented: games.filter((game) => game.status === "borrowed" || game.status === "rented" || game.ownershipType === "borrowed" || game.ownershipType === "rented").length,
    sold: games.filter((game) => game.status === "sold" || game.ownershipType === "sold").length,
    totalHours: games.reduce((sum, game) => sum + (game.playTimeHours ?? 0), 0),
  };
}
