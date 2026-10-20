import type { SyncMetadata } from "@/lib/storage/gameSync";

const KEY = "ps-game-library:sync-metadata:v1";

export function loadSyncMetadata(): SyncMetadata | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
    if (value && typeof value.dirty === "boolean" && typeof value.fingerprint === "string"
      && (value.baseRevision === null || (Number.isSafeInteger(value.baseRevision) && value.baseRevision >= 0))) return value;
  } catch { /* An absent or corrupt marker is never permission to overwrite cloud data. */ }
  return null;
}

export function saveSyncMetadata(value: SyncMetadata) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
