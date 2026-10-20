"use client";

import { useCallback, useRef, useState } from "react";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { DeleteGameDialog } from "@/components/games/DeleteGameDialog";
import { GameForm } from "@/components/games/GameForm";
import { GameLibrary } from "@/components/games/GameLibrary";
import { UnsavedChangesDialog } from "@/components/games/UnsavedChangesDialog";
import { SyncProblemDialog } from "@/components/games/SyncProblemDialog";
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

const GAME_FORM_ID = "game-form";

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
  const { games, isLoading, isSaving, syncIssue, hasPendingChanges, retrySync, reloadCloud, addGame, updateGame, deleteGame, filterGames } = useGames();
  const { toasts, showToast, dismissToast } = useToast();
  const [activeView, setActiveView] = useState<AppView>("dashboard");
  const [editingGame, setEditingGame] = useState<Game | undefined>();
  const [deletingGame, setDeletingGame] = useState<Game | undefined>();
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>("all");
  const [librarySortContext, setLibrarySortContext] = useState<LibrarySortContext>("library");
  const [librarySort, setLibrarySortState] = useState<LibrarySort>(() => loadLibrarySort("library"));
  const [formIsDirty, setFormIsDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [dismissedSyncIssue, setDismissedSyncIssue] = useState(-1);
  const pendingNavigationRef = useRef<(() => void) | null>(null);

  const setLibrarySort = useCallback((sort: LibrarySort) => {
    setLibrarySortState(sort);
    window.localStorage.setItem(sortStorageKeys[librarySortContext], sort);
  }, [librarySortContext]);

  const navigateWithUnsavedCheck = useCallback((action: () => void) => {
    if (isSaving) return;
    if (activeView === "form" && formIsDirty) {
      pendingNavigationRef.current = action;
      setShowUnsavedDialog(true);
      return;
    }

    action();
  }, [activeView, formIsDirty, isSaving]);

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

  async function handleSubmit(draft: GameDraft) {
    try {
      const result = editingGame ? await updateGame(editingGame.id, draft) : await addGame(draft);
      showToast({
        title: result.synced ? result.issue === "cache" ? "已同步雲端，本機離線備份未完成" : "儲存成功，已同步雲端" : "已儲存於此裝置，尚未同步雲端",
        tone: result.synced && !result.issue ? "success" : "neutral",
      });
      setEditingGame(undefined);
      setFormIsDirty(false);
      setActiveView("library");
      return true;
    } catch {
      showToast({ title: "儲存失敗，內容仍保留在表單，請稍後重試", tone: "danger" });
      return false;
    }
  }

  function handleCancelForm() {
    navigateWithUnsavedCheck(() => {
      setEditingGame(undefined);
      setFormIsDirty(false);
      setActiveView("library");
    });
  }

  async function handleConfirmDelete() {
    if (!deletingGame || isSaving) {
      return;
    }

    try {
      const result = await deleteGame(deletingGame.id);
      showToast({ title: result.synced ? `${uiTerms.gameDeleted}，已同步雲端` : "此裝置已刪除，尚未同步雲端", tone: result.synced ? "success" : "neutral" });
      setDeletingGame(undefined);
    } catch {
      showToast({ title: "刪除未儲存，原資料仍保留，請稍後重試", tone: "danger" });
    }
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
    if (isSaving) return;
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

  function submitCurrentGameForm() {
    const form = document.getElementById(GAME_FORM_ID) as HTMLFormElement | null;
    form?.requestSubmit();
  }

  const isEditingGame = activeView === "form" && editingGame !== undefined;
  const editFormNavAction = isEditingGame ? { label: isSaving ? "儲存中…" : "更新遊戲", onClick: submitCurrentGameForm, disabled: isSaving } : undefined;

  async function handleRetrySync() {
    try {
      const result = await retrySync();
      showToast({ title: result.synced ? result.issue === "cache" ? "已同步雲端，本機離線備份未完成" : "已同步至雲端" : "尚未同步，修改仍保留於此裝置", tone: result.synced && !result.issue ? "success" : "neutral" });
    } catch {
      showToast({ title: "同步未完成，資料未被覆蓋，請稍後重試", tone: "danger" });
    }
  }

  async function handleReloadCloud() {
    try {
      await reloadCloud();
      showToast({ title: "已保留本機備份並載入雲端資料", tone: "success" });
    } catch {
      showToast({ title: "無法完成備份或讀取雲端，原資料未取代", tone: "danger" });
    }
  }

  return (
    <AppShell
      subtitle={uiTerms.brandSubtitle}
      activeView={activeView}
      onViewChange={handleViewChange}
      formNavAction={editFormNavAction}
    >
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
          formId={GAME_FORM_ID}
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
      <SyncProblemDialog
        open={Boolean(syncIssue && syncIssue.id !== dismissedSyncIssue && (games.length > 0 || hasPendingChanges))}
        issue={syncIssue?.kind ?? "offline"}
        busy={isSaving}
        onClose={() => setDismissedSyncIssue(syncIssue?.id ?? -1)}
        onRetry={handleRetrySync}
        onReload={handleReloadCloud}
      />
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </AppShell>
  );
}
