"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArchiveRestore, CloudDownload, Download, FileUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BackupPreviewDialog } from "@/components/games/BackupPreviewDialog";
import { SyncProblemDialog } from "@/components/games/SyncProblemDialog";
import { BackupError, createGameBackup, MAX_BACKUP_BYTES, parseGameBackupFile, type GameBackup } from "@/lib/gameBackup";
import { restoreCloudBackup } from "@/lib/storage/backupRecoveryService";
import { CloudStorageError, loadCloudGames, saveCloudGames } from "@/lib/storage/gameCloudStorage";
import { downloadGameBackup, listRecoveryBackups, restoreMissingDeviceGames } from "@/lib/storage/gameRecoveryStorage";
import { loadGames, saveGameRecovery, saveGames } from "@/lib/storage/gameStorage";
import { GameSync, libraryContent, type SyncIssue } from "@/lib/storage/gameSync";
import { loadSyncMetadata, saveSyncMetadata } from "@/lib/storage/gameSyncMetadata";
import type { Game } from "@/types/game";
import type { StoredGamesSnapshot } from "@/types/gameApi";

interface Selection { backup: GameBackup; snapshot?: StoredGamesSnapshot; current: Game[] }
interface Props { authenticated: boolean; onCloudChanged: () => Promise<void> }

let deviceVersion = 0;
function subscribeDevice(listener: () => void) {
  const changed = () => { deviceVersion++; listener(); };
  window.addEventListener("storage", changed);
  window.addEventListener("my-games:backup-refresh", changed);
  return () => {
    window.removeEventListener("storage", changed);
    window.removeEventListener("my-games:backup-refresh", changed);
  };
}
const getDeviceVersion = () => deviceVersion;
const getServerVersion = () => -1;

function makeSync() {
  return new GameSync({
    loadCloud: loadCloudGames, saveCloud: saveCloudGames,
    saveLocal: (items, metadata) => saveGames(items) && saveSyncMetadata(metadata),
    saveRecovery: saveGameRecovery,
  });
}

export function BackupRecoveryPanel({ authenticated, onCloudChanged }: Props) {
  const version = useSyncExternalStore(subscribeDevice, getDeviceVersion, getServerVersion);
  const { deviceGames, recoveries, pending } = useMemo(() => ({
    deviceGames: version < 0 ? [] : loadGames(),
    recoveries: version < 0 ? [] : listRecoveryBackups(),
    pending: version >= 0 && Boolean(loadSyncMetadata()?.dirty),
  }), [version]);
  const [busy, setBusy] = useState(false);
  const [selection, setSelection] = useState<Selection>();
  const [issue, setIssue] = useState<SyncIssue>();
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const working = useRef(false);

  async function run(action: () => Promise<void>) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setMessage("");
    try { await action(); } catch (error) {
      if (error instanceof CloudStorageError && error.status === 409) {
        setSelection(undefined);
        setMessage("資料剛被更新，沒有覆蓋任何內容。請重新開啟預覽核對。");
      } else if (error instanceof BackupError) setMessage(error.message);
      else if (error instanceof CloudStorageError && error.status === 413) setMessage("資料超過雲端單次容量限制，尚未完成補回。請先保留備份，並調整自訂封面大小。");
      else setMessage("操作未完成，原資料仍保留。請確認連線、登入或裝置空間後再試。");
    } finally {
      window.dispatchEvent(new Event("my-games:backup-refresh"));
      working.current = false;
      setBusy(false);
    }
  }

  function exportCloud() {
    void run(async () => {
      const cloud = await loadCloudGames();
      if (!cloud.initialized) throw new BackupError("雲端尚未初始化，請先匯出本機資料備份。");
      downloadGameBackup(createGameBackup(cloud.games, "cloud", cloud.revision));
      setMessage(`已產生 ${cloud.games.length} 款遊戲的完整雲端備份，請將檔案保存在安全位置。`);
    });
  }

  function exportDevice() {
    void run(async () => {
      const games = loadGames();
      downloadGameBackup(createGameBackup(games, "device", loadSyncMetadata()?.baseRevision ?? null));
      setMessage(`已產生 ${games.length} 款遊戲的本機備份，尚未同步的內容也會保留。`);
    });
  }

  async function preparePreview(backup: GameBackup) {
    const snapshot = authenticated ? await loadCloudGames() : undefined;
    if (snapshot && !snapshot.initialized) {
      setSelection({ backup, current: loadGames() });
    } else setSelection({ backup, snapshot, current: snapshot?.games ?? loadGames() });
  }

  async function readFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    void run(async () => {
      if (file.size > MAX_BACKUP_BYTES) throw new BackupError("備份檔超過 8 MB，請先確認內容。");
      await preparePreview(await parseGameBackupFile(await file.text()));
    });
  }

  function restoreSelection() {
    if (!selection) return;
    const selected = selection;
    void run(async () => {
      if (selected.snapshot) {
        const result = await restoreCloudBackup(selected.backup, selected.snapshot);
        setMessage(`已補回 ${result.restored} 款至雲端，現有資料沒有覆蓋。${result.cached ? "" : "此裝置離線備份未完成，請檢查空間。"}`);
        await onCloudChanged();
      } else {
        if (libraryContent(loadGames()) !== libraryContent(selected.current)) throw new CloudStorageError("sync_conflict", 409);
        const result = await restoreMissingDeviceGames(selected.backup);
        setMessage(`已補回 ${result.restored} 款至此裝置，尚未寫入雲端。`);
      }
      setSelection(undefined);
    });
  }

  function retrySync() {
    void run(async () => {
      const sync = makeSync();
      await sync.initialize(loadGames(), loadSyncMetadata());
      const result = await sync.retry();
      setIssue(result.issue ?? undefined);
      setMessage(result.synced ? "已核對雲端資料。" : "修改仍保留於此裝置，尚未同步到雲端。");
      await onCloudChanged();
    });
  }

  function reloadCloud() {
    void run(async () => {
      const sync = makeSync();
      await sync.initialize(loadGames(), loadSyncMetadata());
      await sync.loadCloudWithBackup();
      setIssue(undefined);
      setMessage("已保留本機復原副本並載入雲端資料。");
      await onCloudChanged();
    });
  }

  return (
    <>
      <section className="glass-panel mt-4 rounded-xl p-4" aria-labelledby="backup-heading">
        <h2 id="backup-heading" className="flex items-center gap-2 font-bold text-white"><ArchiveRestore size={20} className="text-sky-300" />備份與復原</h2>
        <p className="mt-3 text-sm text-slate-400">{pending ? "此裝置有尚未同步的修改" : `此裝置保留 ${deviceGames.length} 款遊戲`}</p>
        <div className="mt-4 grid gap-3">
          <Button variant="secondary" onClick={retrySync} disabled={busy}><RefreshCw size={17} />{busy ? "處理中…" : "檢查並重試同步"}</Button>
          <Button variant="secondary" onClick={exportCloud} disabled={busy || !authenticated}><CloudDownload size={17} />下載完整雲端備份</Button>
          <Button variant="ghost" onClick={exportDevice} disabled={busy || deviceGames.length === 0}><Download size={17} />下載本機備份</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={readFile} />
          <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}><FileUp size={17} />選擇備份檔預覽</Button>
        </div>
        {recoveries.length > 0 ? (
          <div className="mt-5 border-t border-white/10 pt-4">
            <h3 className="text-sm font-semibold text-slate-200">本機復原副本 · {recoveries.length} 份</h3>
            <div className="mt-2 max-h-56 overflow-y-auto divide-y divide-white/[0.06]">
              {recoveries.map(({ key, backup }) => (
                <div key={key} className="flex items-center gap-2 py-1">
                  <button type="button" disabled={busy} onClick={() => { void run(() => preparePreview(backup)); }} className="min-h-12 min-w-0 flex-1 rounded-lg px-1 py-2 text-left text-sm transition hover:bg-white/[0.04] active:bg-white/[0.08] disabled:opacity-45">
                    <span className="block font-semibold text-slate-200">{backup.games.length} 款遊戲</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{backup.createdAt ? new Date(backup.createdAt).toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }) : "上一份本機備份"}</span>
                  </button>
                  <Button size="icon" variant="ghost" title="下載復原副本" aria-label={`下載 ${backup.games.length} 款遊戲的復原副本`} disabled={busy} onClick={() => downloadGameBackup(backup)}><Download size={17} /></Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {message ? <p role="status" className="mt-4 text-sm leading-6 text-slate-300">{message}</p> : null}
      </section>
      {selection ? <BackupPreviewDialog backup={selection.backup} current={selection.current} target={selection.snapshot ? "cloud" : "device"} busy={busy} error={busy ? undefined : message} onClose={() => { if (!busy) setSelection(undefined); }} onConfirm={restoreSelection} /> : null}
      <SyncProblemDialog open={Boolean(issue)} issue={issue ?? "offline"} busy={busy} onClose={() => setIssue(undefined)} onRetry={retrySync} onReload={reloadCloud} />
    </>
  );
}
