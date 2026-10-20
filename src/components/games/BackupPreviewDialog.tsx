"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Download, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { compareGameBackup, type GameBackup } from "@/lib/gameBackup";
import type { Game } from "@/types/game";

interface Props {
  backup: GameBackup;
  current: Game[];
  target: "cloud" | "device";
  busy: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function BackupPreviewDialog({ backup, current, target, busy, error, onClose, onConfirm }: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const controls = useRef({ onClose, busy });
  useEffect(() => { controls.current = { onClose, busy }; }, [onClose, busy]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !controls.current.busy) controls.current.onClose();
      if (event.key !== "Tab") return;
      const items = panelRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled)");
      if (!items?.length) { event.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
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
  }, []);
  const comparison = compareGameBackup(current, backup.games);
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/65 px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-4 backdrop-blur-md sm:items-center" onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="glass-panel max-h-[calc(100dvh-48px)] w-full max-w-[398px] animate-[sheet-slide-up_200ms_ease-out] overflow-y-auto rounded-xl p-5 outline-none">
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-bold text-white">復原前確認</h2>
          <Button variant="ghost" size="icon" title="關閉" aria-label="關閉復原預覽" onClick={onClose} disabled={busy}><X size={18} /></Button>
        </div>
        <p className="mt-1 text-sm text-slate-400">備份 {backup.games.length} 款 · {target === "cloud" ? "雲端" : "此裝置"} {current.length} 款</p>
        <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 text-sm">
          <div><dt className="text-slate-400">可補回</dt><dd className="mt-1 text-xl font-bold text-emerald-300">{comparison.missing.length} 款</dd></div>
          <div><dt className="text-slate-400">內容不同，保留現有</dt><dd className="mt-1 text-xl font-bold text-white">{comparison.changed.length} 款</dd></div>
          <div><dt className="text-slate-400">內容相同</dt><dd className="mt-1 font-semibold text-slate-200">{comparison.unchanged} 款</dd></div>
          <div><dt className="text-slate-400">僅目前有，繼續保留</dt><dd className="mt-1 font-semibold text-slate-200">{comparison.onlyCurrent} 款</dd></div>
        </dl>
        {comparison.missing.length ? (
          <ul className="mt-5 max-h-36 overflow-y-auto border-t border-white/10 pt-3 text-sm text-slate-300">
            {comparison.missing.map((game) => <li key={game.id} className="break-words py-1.5">{game.displayTitle || game.title}</li>)}
          </ul>
        ) : <p className="mt-5 text-sm leading-6 text-slate-400">沒有缺少的遊戲，不需要補回。</p>}
        <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-400"><ShieldCheck className="mt-0.5 shrink-0 text-emerald-300" size={15} />只補回缺少的遊戲，不覆蓋現有內容、不刪除資料。{target === "device" ? "此步驟不會寫入雲端。" : "原始加入日期與欄位會保留。"}</p>
        {error ? <p role="alert" className="mt-3 text-sm leading-6 text-amber-200">{error}</p> : null}
        <div className="mt-5 grid gap-3">
          <Button onClick={onConfirm} disabled={busy || comparison.missing.length === 0}><Download size={17} />{busy ? "處理中…" : target === "cloud" ? `補回雲端 ${comparison.missing.length} 款` : `補回此裝置 ${comparison.missing.length} 款`}</Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>取消</Button>
        </div>
      </section>
    </div>, document.body,
  );
}
