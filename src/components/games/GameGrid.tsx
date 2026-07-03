import { GameCard } from "@/components/games/GameCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Game } from "@/types/game";

interface GameGridProps {
  games: Game[];
  isLoading: boolean;
  onEditGame: (game: Game) => void;
  onDeleteGame: (game: Game) => void;
}

export function GameGrid({ games, isLoading, onEditGame, onDeleteGame }: GameGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-80 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!games.length) {
    return <EmptyState title="目前還沒有任何遊戲" description="點擊下方「新增遊戲」開始建立你的收藏。" />;
  }

  return (
    <div className="grid gap-4">
      {games.map((game) => (
        <GameCard key={game.id} game={game} onEdit={onEditGame} onDelete={onDeleteGame} />
      ))}
    </div>
  );
}
