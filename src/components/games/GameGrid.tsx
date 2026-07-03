import { GameCard } from "@/components/games/GameCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { uiTerms } from "@/lib/terminology";
import type { Game } from "@/types/game";

interface GameGridProps {
  games: Game[];
  isLoading: boolean;
  onAddGame: () => void;
  onEditGame: (game: Game) => void;
  onDeleteGame: (game: Game) => void;
}

export function GameGrid({ games, isLoading, onAddGame, onEditGame, onDeleteGame }: GameGridProps) {
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
    return <EmptyState title="沒有符合條件的遊戲" description="換個篩選條件，或新增第一款遊戲。" actionLabel={uiTerms.addGame} onAction={onAddGame} />;
  }

  return (
    <div className="grid gap-4">
      {games.map((game) => (
        <GameCard key={game.id} game={game} onEdit={onEditGame} onDelete={onDeleteGame} />
      ))}
    </div>
  );
}
