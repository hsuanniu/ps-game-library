import { BackupError, createGameBackup, mergeMissingBackupGames, parseGameBackup, type GameBackup } from "@/lib/gameBackup";
import { libraryFingerprint } from "@/lib/storage/gameSync";
import { loadGames, loadGameBackup, saveGameRecovery, saveGames } from "@/lib/storage/gameStorage";
import { loadSyncMetadata, saveSyncMetadata } from "@/lib/storage/gameSyncMetadata";

export interface RecoveryEntry { key: string; backup: GameBackup }
const RECOVERY_PREFIX = "ps-game-library:recovery:v1:";

export function listRecoveryBackups(): RecoveryEntry[] {
  const entries: RecoveryEntry[] = [];
  try {
    for (let index = 0; index < window.localStorage.length; index++) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith(RECOVERY_PREFIX)) continue;
      try {
        const backup = parseGameBackup(window.localStorage.getItem(key) ?? "");
        if (backup.games.length) entries.push({ key, backup: { ...backup, source: "recovery" } });
      } catch { /* Never remove an unreadable recovery copy. */ }
    }
    const rolling = loadGameBackup();
    if (rolling.length) entries.push({ key: "rolling", backup: { ...createGameBackup(rolling, "recovery"), createdAt: null } });
  } catch { /* Browser storage may be unavailable; the cloud remains untouched. */ }
  return entries.sort((a, b) => (b.backup.createdAt ?? "").localeCompare(a.backup.createdAt ?? ""));
}

export async function restoreMissingDeviceGames(backup: GameBackup) {
  const current = loadGames();
  const merged = mergeMissingBackupGames(current, backup.games);
  if (merged.length === current.length) return { restored: 0 };
  const marker = loadSyncMetadata();
  if (!saveGameRecovery(current, { baseRevision: marker?.baseRevision ?? null, dirty: marker?.dirty ?? false, fingerprint: await libraryFingerprint(current) })) {
    throw new BackupError("無法保留目前資料的復原副本，沒有執行補回。");
  }
  // Stage a dirty marker first so a partial browser write can never look synced.
  if (!saveSyncMetadata({ baseRevision: marker?.baseRevision ?? null, dirty: true, fingerprint: await libraryFingerprint(merged) }) || !saveGames(merged)) {
    throw new BackupError("裝置空間不足，未完成補回；原資料與復原副本仍保留。");
  }
  return { restored: merged.length - current.length };
}

export function downloadGameBackup(backup: GameBackup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `my-games-${(backup.createdAt ?? new Date().toISOString()).slice(0, 10)}.json`;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
