import type { Game } from "@/types/game";
import type { StoredGamesSnapshot } from "@/types/gameApi";
import { libraryContent } from "@/lib/storage/gameSync";
import { CloudStorageError, type SaveResult } from "@/lib/storage/gameCloudStorage";

export const MAX_BACKUP_BYTES = 8_000_000;
export interface GameBackup {
  format: "my-games-backup";
  version: 1;
  createdAt: string | null;
  source: "cloud" | "device" | "recovery" | "file";
  revision: number | null;
  games: Game[];
}

export class BackupError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function validateBackupGames(value: unknown): Game[] {
  if (!Array.isArray(value)) throw new BackupError("備份格式不正確，原資料沒有變更。");
  const stack: Array<{ item: unknown; depth: number }> = [{ item: value, depth: 0 }];
  let nodes = 0;
  while (stack.length) {
    const { item, depth } = stack.pop()!;
    if (++nodes > 200_000 || depth > 32) throw new BackupError("備份結構過於複雜，請先確認檔案。");
    if (item && typeof item === "object") {
      for (const child of Object.values(item)) stack.push({ item: child, depth: depth + 1 });
    }
  }
  const ids = new Set<string>();
  for (const game of value) {
    if (!isRecord(game) || ["id", "title", "platform", "status", "ownershipType", "createdAt", "updatedAt"].some((key) => typeof game[key] !== "string" || !(game[key] as string).trim())) {
      throw new BackupError("備份缺少必要欄位，無法安全復原。");
    }
    if (ids.has(game.id as string)) throw new BackupError("備份含有重複的遊戲 ID，請先確認檔案。");
    ids.add(game.id as string);
    for (const key of ["createdAt", "updatedAt", "addedAt"]) {
      if (game[key] !== undefined && (typeof game[key] !== "string" || Number.isNaN(Date.parse(game[key] as string)))) throw new BackupError("備份含有無效日期，無法安全復原。");
    }
    for (const key of ["displayTitle", "coverUrl", "purchaseDate", "seriesName", "loanPerson", "notes"]) {
      if (game[key] !== undefined && typeof game[key] !== "string") throw new BackupError("備份欄位格式不正確，原資料沒有變更。");
    }
    for (const key of ["playTimeHours", "purchasePrice", "seriesOrder"]) {
      if (game[key] !== undefined && (typeof game[key] !== "number" || !Number.isFinite(game[key]) || (game[key] as number) < 0)) throw new BackupError("備份含有無效數值，原資料沒有變更。");
    }
    if (game.isCompleted !== undefined && typeof game.isCompleted !== "boolean") throw new BackupError("備份的完成狀態格式不正確。");
    if (game.genre !== undefined && (!Array.isArray(game.genre) || game.genre.some((item) => typeof item !== "string"))) throw new BackupError("備份的類型格式不正確。");
    if (game.ageRating !== undefined && (!isRecord(game.ageRating) || typeof game.ageRating.system !== "string" || typeof game.ageRating.rating !== "string")) throw new BackupError("備份的分級格式不正確。");
  }
  // Keep all original fields, including unknown future fields and legacy enums.
  return value as Game[];
}

export function createGameBackup(games: Game[], source: GameBackup["source"], revision: number | null = null): GameBackup {
  validateBackupGames(games);
  return { format: "my-games-backup", version: 1, createdAt: new Date().toISOString(), source, revision, games };
}

export function parseGameBackup(text: string): GameBackup {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new BackupError("備份檔超過 8 MB，請先確認內容。");
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new BackupError("無法讀取 JSON 備份，原資料沒有變更。"); }
  if (Array.isArray(value)) return { ...createGameBackup(validateBackupGames(value), "file"), createdAt: null };
  if (!isRecord(value)) throw new BackupError("不支援這個備份格式。");
  if (value.format !== undefined && !["my-games-backup", "my-games-database-backup"].includes(String(value.format))) throw new BackupError("不支援這個備份格式。");
  if (value.version !== undefined && value.version !== 1) throw new BackupError("備份版本較新，請先更新 App。");
  const raw = value.format === "my-games-database-backup" && isRecord(value.rows) && Array.isArray(value.rows.games)
    ? value.rows.games.map((row: unknown) => isRecord(row) ? row.data : null) : value.games;
  const games = validateBackupGames(raw);
  return {
    format: "my-games-backup", version: 1, source: "file", games,
    createdAt: typeof value.createdAt === "string" && !Number.isNaN(Date.parse(value.createdAt)) ? value.createdAt : typeof value.savedAt === "string" && !Number.isNaN(Date.parse(value.savedAt)) ? value.savedAt : null,
    revision: Number.isSafeInteger(value.revision) && Number(value.revision) >= 0 ? Number(value.revision) : null,
  };
}

export async function parseGameBackupFile(text: string) {
  const backup = parseGameBackup(text);
  const value = JSON.parse(text);
  if (value?.format === "my-games-database-backup") {
    const { checksum, ...content } = value;
    const canonical = (item: unknown): unknown => {
      if (Array.isArray(item)) return item.map(canonical);
      if (isRecord(item)) return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)]));
      return item;
    };
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(canonical(content))));
    const actual = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
    if (typeof checksum !== "string" || checksum !== actual) throw new BackupError("備份完整性檢查失敗，沒有變更任何資料。");
  }
  return backup;
}

export function compareGameBackup(current: Game[], backup: Game[]) {
  const currentById = new Map(current.map((game) => [game.id, game]));
  const backupIds = new Set(backup.map((game) => game.id));
  const missing = backup.filter((game) => !currentById.has(game.id));
  const changed = backup.filter((game) => currentById.has(game.id) && libraryContent([currentById.get(game.id)!]) !== libraryContent([game]));
  return {
    missing, changed,
    unchanged: backup.length - missing.length - changed.length,
    onlyCurrent: current.filter((game) => !backupIds.has(game.id)).length,
  };
}

export function mergeMissingBackupGames(current: Game[], backup: Game[]) {
  validateBackupGames(current);
  validateBackupGames(backup);
  return [...current, ...compareGameBackup(current, backup).missing];
}

export async function restoreMissingCloudGames(backup: GameBackup, preview: StoredGamesSnapshot, dependencies: {
  loadCloud: () => Promise<StoredGamesSnapshot>;
  saveCloud: (games: Game[], revision: number) => Promise<SaveResult>;
}) {
  const cloud = await dependencies.loadCloud();
  if (!cloud.initialized) throw new CloudStorageError("cloud_not_initialized", 503);
  if (cloud.revision !== preview.revision || libraryContent(cloud.games) !== libraryContent(preview.games)) throw new CloudStorageError("sync_conflict", 409);
  const games = mergeMissingBackupGames(cloud.games, backup.games);
  const restored = games.length - cloud.games.length;
  if (!restored) return { snapshot: cloud, restored: 0 };
  const saved = await dependencies.saveCloud(games, preview.revision);
  return { snapshot: { ...cloud, games, revision: saved.revision, updatedAt: saved.updatedAt }, restored };
}
