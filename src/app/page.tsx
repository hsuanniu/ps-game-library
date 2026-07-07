"use client";

import { useCallback, useRef, useState } from "react";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { DeleteGameDialog } from "@/components/games/DeleteGameDialog";
import { GameForm } from "@/components/games/GameForm";
import { GameLibrary } from "@/components/games/GameLibrary";
import { UnsavedChangesDialog } from "@/components/games/UnsavedChangesDialog";
import { CollectionInsights } from "@/components/insights/CollectionInsights";
import { AppShell, type AppView } from "@/components/layout/AppShell";
import { ToastViewport } from "@/components/ui/Toast";
import { useGames } from "@/hooks/useGames";
import { useToast } from "@/hooks/useToast";
import { uiTerms } from "@/lib/terminology";
import type { Game, GameDraft, LibraryFilter, LibrarySort, LibrarySortContext } from "@/types/game";

const librarySortValues: LibrarySort[] = ["newest", "name-asc", "name-desc", "playtime-desc", "playtime-asc"];
const sortStorageKeys: Record<LibrarySortContext, string> = {
  library: "ps-game-library:library-sort",
  disc: "ps-game-library:disc-sort",
  digital: "ps-game-library:digital-sort",
  wishlist: "ps-game-library:wishlist-sort",
  playtime: "ps-game-library:playtime-sort",
};

const defaultSortByContext: Record<LibrarySortContext, LibrarySort> = {
  library: "newest",
  disc: "name-asc",
  digital: "name-asc",
  wishlist: "newest",
  playtime: "playtime-desc",
};

function isValidSortForContext(sort: LibrarySort, context: LibrarySortContext) {
  return context !== "wishlist" || !sort.startsWith("playtime");
}

function loadLibrarySort(context: LibrarySortContext): LibrarySort {
  if (typeof window === "undefined") {
    return defaultSortByContext[context];
  }

  const storedSort = window.localStorage.getItem(sortStorageKeys[context]) as LibrarySort | null;

  if (storedSort && librarySortValues.includes(storedSort) && isValidSortForContext(storedSort, context)) {
    return storedSort;
  }

  return defaultSortByContext[context];
}

export default function Home() {
  const { games, isLoading, addGame, updateGame, deleteGame, filterGames } = useGames();
  const { toasts, showToast, dismissToast } = useToast();
  const [activeView, setActiveView] = useState<AppView>("dashboard");
  const [editingGame, setEditingGame] = useState<Game | undefined>();
  const [deletingGame, setDeletingGame] = useState<Game | undefined>();
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>("all");
  const [librarySortContext, setLibrarySortContext] = useState<LibrarySortContext>("library");
  const [librarySort, setLibrarySortState] = useState<LibrarySort>(() => loadLibrarySort("library"));
  const [formIsDirty, setFormIsDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const pendingNavigationRef = useRef<(() => void) | null>(null);

  const setLibrarySort = useCallback((sort: LibrarySort) => {
    setLibrarySortState(sort);
    window.localStorage.setItem(sortStorageKeys[librarySortContext], sort);
  }, [librarySortContext]);

  const navigateWithUnsavedCheck = useCallback((action: () => void) => {
    if (activeView === "form" && formIsDirty) {
      pendingNavigationRef.current = action;
      setShowUnsavedDialog(true);
      return;
    }

    action();
  }, [activeView, formIsDirty]);

  const openAddForm = useCallback(() => {
    setEditingGame(undefined);
    setFormIsDirty(false);
    setActiveView("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const openLibrary = useCallback((options?: { filter?: LibraryFilter; sortContext?: LibrarySortContext }) => {
    const nextSortContext = options?.sortContext ?? "library";

    setEditingGame(undefined);
    setFormIsDirty(false);
    setLibraryFilter(options?.filter ?? "all");
    setLibrarySortContext(nextSortContext);
    setLibrarySortState(loadLibrarySort(nextSortContext));
    setActiveView("library");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const openInsights = useCallback(() => {
    setEditingGame(undefined);
    setFormIsDirty(false);
    setActiveView("insights");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  function handleEditGame(game: Game) {
    setEditingGame(game);
    setFormIsDirty(false);
    setActiveView("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSubmit(draft: GameDraft) {
    if (editingGame) {
      updateGame(editingGame.id, draft);
      showToast({ title: "編輯成功", tone: "success" });
    } else {
      addGame(draft);
      showToast({ title: "新增成功", tone: "success" });
    }

    setEditingGame(undefined);
    setFormIsDirty(false);
    setActiveView("library");
  }

  function handleCancelForm() {
    navigateWithUnsavedCheck(() => {
      setEditingGame(undefined);
      setFormIsDirty(false);
      setActiveView("library");
    });
  }

  function handleConfirmDelete() {
    if (!deletingGame) {
      return;
    }

    deleteGame(deletingGame.id);
    showToast({ title: uiTerms.gameDeleted, tone: "danger" });
    setDeletingGame(undefined);
  }

  function handleConfirmLeaveForm() {
    const action = pendingNavigationRef.current;

    pendingNavigationRef.current = null;
    setShowUnsavedDialog(false);
    setFormIsDirty(false);
    action?.();
  }

  function handleCancelLeaveForm() {
    pendingNavigationRef.current = null;
    setShowUnsavedDialog(false);
  }

  function handleViewChange(view: AppView) {
    if (view === activeView) {
      return;
    }

    if (view === "form") {
      navigateWithUnsavedCheck(openAddForm);
      return;
    }

    navigateWithUnsavedCheck(() => {
      setEditingGame(undefined);
      setFormIsDirty(false);
      if (view === "library") {
        setLibraryFilter("all");
        setLibrarySortContext("library");
        setLibrarySortState(loadLibrarySort("library"));
      }
      setActiveView(view);
    });
  }

  return (
    <AppShell subtitle={uiTerms.brandSubtitle} activeView={activeView} onViewChange={handleViewChange}>
      {activeView === "dashboard" ? (
        <Dashboard games={games} isLoading={isLoading} onOpenLibrary={openLibrary} onOpenInsights={openInsights} />
      ) : null}

      {activeView === "library" ? (
        <GameLibrary
          isLoading={isLoading}
          filterGames={filterGames}
          activeFilter={libraryFilter}
          activeSort={librarySort}
          sortContext={librarySortContext}
          onFilterChange={setLibraryFilter}
          onSortChange={setLibrarySort}
          onEditGame={handleEditGame}
          onDeleteGame={setDeletingGame}
        />
      ) : null}

      {activeView === "form" ? (
        <GameForm
          key={editingGame?.id ?? "new-game"}
          editingGame={editingGame}
          onSubmit={handleSubmit}
          onCancel={handleCancelForm}
          onDirtyChange={setFormIsDirty}
        />
      ) : null}

      {activeView === "insights" ? (
        <CollectionInsights games={games} onBack={() => setActiveView("dashboard")} />
      ) : null}
      <DeleteGameDialog game={deletingGame} onCancel={() => setDeletingGame(undefined)} onConfirm={handleConfirmDelete} />
      <UnsavedChangesDialog isOpen={showUnsavedDialog} onCancel={handleCancelLeaveForm} onLeave={handleConfirmLeaveForm} />
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </AppShell>
  );
}
