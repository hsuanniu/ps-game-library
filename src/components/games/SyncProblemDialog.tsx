"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CloudDownload, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { SyncIssue } from "@/lib/storage/gameSync";

const messages: Record<SyncIssue, string> = {
  conflict: "雲端有其他裝置的更新，本機修改仍保留，沒有覆蓋雲端。可先保留本機備份，再載入雲端版本重新編輯。",
  offline: "目前顯示此裝置保留的資料，尚未確認已同步至雲端。恢復連線後可重試，牛域只會讀到已同步的內容。",
  auth: "此裝置尚未連線雲端，或管理登入已失效。本機修改仍保留，請先完成雲端登入再重試。",
  setup: "雲端尚未就緒，本機資料不會自動覆蓋雲端。請到雲端資料設定確認連線或完成一次性搬移。",
  capacity: "同步資料超出容量限制。本機修改仍保留，請改用較小的自訂封面後重試。",
  cache: "雲端資料已讀取或儲存，但此裝置無法保存離線副本。請檢查瀏覽器儲存空間；不要清除唯一尚未同步的資料。",
};

interface Props {
  open: boolean;
  issue: SyncIssue;
  busy: boolean;
  onClose: () => void;
  onRetry: () => void;
  onReload: () => void;
}

export function SyncProblemDialog({ open, issue, busy, onClose, onRetry, onReload }: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab") return;
      const items = panelRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]");
      if (!items?.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panelRef.current)) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/65 px-4 pb-[calc(88px+env(safe-area-inset-bottom))] pt-4 backdrop-blur-md sm:items-center sm:pb-4" onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="glass-panel w-full max-w-[398px] animate-[sheet-slide-up_200ms_ease-out] rounded-xl p-5 outline-none">
        <AlertTriangle size={24} className="text-amber-300" />
        <h2 id={titleId} className="mt-4 text-lg font-bold text-white">{issue === "conflict" ? "雲端資料已變更" : issue === "cache" ? "離線備份未完成" : "尚未同步到雲端"}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">{messages[issue]}</p>
        <div className="mt-5 grid gap-3">
          {issue === "auth" || issue === "setup" ? <a href="/sync" className="grid min-h-11 place-items-center rounded-lg bg-emerald-400 text-sm font-semibold text-slate-950">雲端資料設定</a> : null}
          {issue === "conflict" ? (
            <Button onClick={onReload} disabled={busy}><CloudDownload size={17} />保留本機備份並載入雲端</Button>
          ) : (
            <Button onClick={onRetry} disabled={busy}><RefreshCw size={17} />{busy ? "處理中…" : "重試連線"}</Button>
          )}
          <Button variant="secondary" onClick={onClose} disabled={busy}>稍後處理</Button>
        </div>
      </section>
    </div>, document.body,
  );
}
