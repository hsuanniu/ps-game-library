"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isCollectionGame, isWishlistGame } from "@/lib/gameCollection";
import { CloudStorageError, loadCloudGames, saveCloudGames } from "@/lib/storage/gameCloudStorage";
import { loadGames, saveGameRecovery, saveGames } from "@/lib/storage/gameStorage";
import { GameSync, type SyncIssue } from "@/lib/storage/gameSync";
import { loadSyncMetadata, saveSyncMetadata } from "@/lib/storage/gameSyncMetadata";
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
  const [isSaving, setIsSaving] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [syncIssue, setSyncIssue] = useState<{ kind: SyncIssue; id: number } | null>(null);
  const noticeId = useRef(0);
  const syncRef = useRef<GameSync | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialGames() {
      const sync = new GameSync({
        loadCloud: loadCloudGames,
        saveCloud: saveCloudGames,
        saveLocal: (items, metadata) => saveGames(items) && saveSyncMetadata(metadata),
        saveRecovery: saveGameRecovery,
      });
      await sync.initialize(loadGames(), loadSyncMetadata());
      if (!cancelled) {
        syncRef.current = sync;
        setGames(sync.games);
        setHasPendingChanges(sync.dirty);
        setSyncIssue(sync.issue ? { kind: sync.issue, id: ++noticeId.current } : null);
        setIsLoading(false);
      }
    }

    void loadInitialGames();

    return () => {
      cancelled = true;
    };
  }, []);

  const runSync = useCallback(async <T,>(action: (sync: GameSync) => Promise<T>) => {
    const sync = syncRef.current;
    if (!sync) throw new CloudStorageError("library_loading", 503);
    setIsSaving(true);
    try {
      const result = await action(sync);
      setGames([...sync.games]);
      setHasPendingChanges(sync.dirty);
      setSyncIssue(sync.issue ? { kind: sync.issue, id: ++noticeId.current } : null);
      return result;
    } finally {
      setIsSaving(false);
    }
  }, []);

  useEffect(() => {
    const resume = () => {
      if (!isSaving && syncRef.current?.dirty && syncRef.current.issue === "offline") {
        void runSync((sync) => sync.retry()).catch(() => undefined);
      }
    };
    window.addEventListener("online", resume);
    return () => window.removeEventListener("online", resume);
  }, [isSaving, runSync]);

  const sortedGames = useMemo(
    () => [...games].sort((a, b) => getGameCreatedTime(b) - getGameCreatedTime(a)),
    [games],
  );

  async function addGame(draft: GameDraft) {
    const now = new Date().toISOString();
    const game: Game = {
      ...draft,
      id: makeId(),
      addedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    return runSync((sync) => sync.mutate((current) => [game, ...current]));
  }

  async function updateGame(id: string, draft: GameDraft) {
    const now = new Date().toISOString();
    return runSync((sync) => sync.mutate((current) => current.map((game) => game.id === id
      ? { ...game, ...draft, updatedAt: now } : game)));
  }

  async function deleteGame(id: string) {
    return runSync((sync) => sync.mutate((current) => current.filter((game) => game.id !== id)));
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
    isSaving,
    syncIssue,
    hasPendingChanges,
    retrySync: () => runSync((sync) => sync.retry()),
    reloadCloud: () => runSync((sync) => sync.loadCloudWithBackup()),
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
