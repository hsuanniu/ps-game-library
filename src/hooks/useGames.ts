"use client";

import { useEffect, useMemo, useState } from "react";
import { isCollectionGame, isWishlistGame } from "@/lib/gameCollection";
import { loadGames, saveGames } from "@/lib/storage/gameStorage";
import type { Game, GameDraft, LibraryFilter, LibrarySort } from "@/types/game";

const titleCollator = new Intl.Collator("zh-TW", {
  numeric: true,
  sensitivity: "base",
});

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `game-${Date.now()}`;
}

export function useGames() {
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setGames(loadGames());
      setIsLoading(false);
    }, 320);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      saveGames(games);
    }
  }, [games, isLoading]);

  const sortedGames = useMemo(
    () => [...games].sort((a, b) => getGameCreatedTime(b) - getGameCreatedTime(a)),
    [games],
  );

  function addGame(draft: GameDraft) {
    const now = new Date().toISOString();
    const game: Game = {
      ...draft,
      id: makeId(),
      addedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    setGames((current) => [game, ...current]);
    return game;
  }

  function updateGame(id: string, draft: GameDraft) {
    const now = new Date().toISOString();
    let updatedGame: Game | undefined;

    setGames((current) =>
      current.map((game) => {
        if (game.id !== id) {
          return game;
        }

        updatedGame = {
          ...game,
          ...draft,
          updatedAt: now,
        };

        return updatedGame;
      }),
    );

    return updatedGame;
  }

  function deleteGame(id: string) {
    setGames((current) => current.filter((game) => game.id !== id));
  }

  function findGame(id: string) {
    return games.find((game) => game.id === id);
  }

  function filterGames(filter: LibraryFilter, query: string, sort: LibrarySort = "newest") {
    const normalizedQuery = query.trim().toLowerCase();

    const filteredGames = sortedGames.filter((game) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "collection" && isCollectionGame(game)) ||
        (filter === "wishlist" && isWishlistGame(game)) ||
        ((filter === "disc" || filter === "digital") && isCollectionGame(game) && game.ownershipType === filter) ||
        (filter !== "wishlist" && filter !== "disc" && filter !== "digital" && game.status === filter) ||
        (filter !== "wishlist" && filter !== "disc" && filter !== "digital" && game.ownershipType === filter) ||
        (filter === "owned" && ["playing", "finished"].includes(game.status));

      const searchableTitle = [game.displayTitle, game.title].filter(Boolean).join(" ").toLowerCase();
      const matchesQuery = !normalizedQuery || searchableTitle.includes(normalizedQuery);

      return matchesFilter && matchesQuery;
    });

    if (sort === "name-asc") {
      return [...filteredGames].sort((a, b) => titleCollator.compare(getGameSortTitle(a), getGameSortTitle(b)));
    }

    if (sort === "name-desc") {
      return [...filteredGames].sort((a, b) => titleCollator.compare(getGameSortTitle(b), getGameSortTitle(a)));
    }

    if (sort === "playtime-desc") {
      return [...filteredGames].sort((a, b) => getGamePlayTime(b) - getGamePlayTime(a));
    }

    if (sort === "playtime-asc") {
      return [...filteredGames].sort((a, b) => getGamePlayTime(a) - getGamePlayTime(b));
    }

    return filteredGames;
  }

  return {
    games: sortedGames,
    isLoading,
    addGame,
    updateGame,
    deleteGame,
    findGame,
    filterGames,
  };
}

function getGameCreatedTime(game: Game) {
  const dateValue = game.addedAt || game.createdAt || game.updatedAt;
  const time = new Date(dateValue).getTime();

  return Number.isNaN(time) ? 0 : time;
}

function getGameSortTitle(game: Game) {
  return (game.displayTitle || game.title).trim();
}

function getGamePlayTime(game: Game) {
  return game.playTimeHours ?? 0;
}
