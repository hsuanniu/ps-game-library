import type { Game } from "@/types/game";
import type { StoredGamesSnapshot } from "@/types/gameApi";
import { BackupError, restoreMissingCloudGames, type GameBackup } from "@/lib/gameBackup";
import { loadCloudGames, saveCloudGames, type SaveResult } from "@/lib/storage/gameCloudStorage";
import { loadGames, saveGameRecovery, saveGames } from "@/lib/storage/gameStorage";
import { libraryContent, libraryFingerprint, type SyncMetadata } from "@/lib/storage/gameSync";
import { loadSyncMetadata, saveSyncMetadata } from "@/lib/storage/gameSyncMetadata";

interface Dependencies {
  loadLocal: () => Game[];
  loadMetadata: () => SyncMetadata | null;
  saveRecovery: (games: Game[], metadata: SyncMetadata) => boolean;
  saveLocal: (games: Game[], metadata: SyncMetadata) => boolean;
  loadCloud: () => Promise<StoredGamesSnapshot>;
  saveCloud: (games: Game[], revision: number) => Promise<SaveResult>;
}

const browserDependencies: Dependencies = {
  loadLocal: loadGames, loadMetadata: loadSyncMetadata, saveRecovery: saveGameRecovery,
  saveLocal: (games, metadata) => saveGames(games) && saveSyncMetadata(metadata),
  loadCloud: loadCloudGames, saveCloud: saveCloudGames,
};

export async function restoreCloudBackup(backup: GameBackup, preview: StoredGamesSnapshot, dependencies = browserDependencies) {
  const local = dependencies.loadLocal();
  const marker = dependencies.loadMetadata();
  const different = libraryContent(local) !== libraryContent(preview.games);
  const trustedCache = marker && !marker.dirty && marker.fingerprint === await libraryFingerprint(local);
  if (different && (marker?.dirty || (local.length > 0 && !trustedCache))) {
    throw new BackupError("此裝置仍有尚未核對的修改。請先下載本機備份並處理同步，再補回雲端。");
  }
  if (!dependencies.saveRecovery(preview.games, {
    baseRevision: preview.revision, dirty: false, fingerprint: await libraryFingerprint(preview.games),
  })) throw new BackupError("無法保留雲端現況的復原副本，沒有執行補回。請檢查裝置空間。");
  const result = await restoreMissingCloudGames(backup, preview, dependencies);
  const cached = dependencies.saveLocal(result.snapshot.games, {
    baseRevision: result.snapshot.revision, dirty: false, fingerprint: await libraryFingerprint(result.snapshot.games),
  });
  return { ...result, cached };
}
