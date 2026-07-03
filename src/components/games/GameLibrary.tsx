"use client";

import { useMemo, useState } from "react";
import { GameFilters } from "@/components/games/GameFilters";
import { GameGrid } from "@/components/games/GameGrid";
import { GameSortSheet } from "@/components/games/GameSortSheet";
import { uiTerms } from "@/lib/terminology";
import type { Game, LibraryFilter, LibrarySort, LibrarySortContext } from "@/types/game";

interface GameLibraryProps {
  isLoading: boolean;
  filterGames: (filter: LibraryFilter, query: string, sort?: LibrarySort) => Game[];
  activeFilter: LibraryFilter;
  activeSort: LibrarySort;
  sortContext: LibrarySortContext;
  onFilterChange: (filter: LibraryFilter) => void;
  onSortChange: (sort: LibrarySort) => void;
  onEditGame: (game: Game) => void;
  onDeleteGame: (game: Game) => void;
}

export function GameLibrary({ isLoading, filterGames, activeFilter, activeSort, sortContext, onFilterChange, onSortChange, onEditGame, onDeleteGame }: GameLibraryProps) {
  const [query, setQuery] = useState("");

  const filteredGames = useMemo(() => filterGames(activeFilter, query, activeSort), [activeFilter, activeSort, filterGames, query]);

  function handleFilterChange(filter: LibraryFilter) {
    onFilterChange(filter);
  }

  return (
    <div className="grid gap-5">
      <section className="glass-panel rounded-xl p-4">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white">{uiTerms.gameLibrary}</h2>
            <p className="mt-1 text-sm text-slate-400">快速搜尋、篩選目前收藏狀態。</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-white/[0.07] px-3 py-2 text-sm font-semibold text-slate-300">{filteredGames.length} 款</span>
            <GameSortSheet activeSort={activeSort} sortContext={sortContext} onSortChange={onSortChange} />
          </div>
        </div>
        <GameFilters activeFilter={activeFilter} query={query} onFilterChange={handleFilterChange} onQueryChange={setQuery} />
      </section>

      <GameGrid games={filteredGames} isLoading={isLoading} onEditGame={onEditGame} onDeleteGame={onDeleteGame} />
    </div>
  );
}
