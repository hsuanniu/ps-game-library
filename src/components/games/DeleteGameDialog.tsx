import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { uiTerms } from "@/lib/terminology";
import type { Game } from "@/types/game";

interface DeleteGameDialogProps {
  game?: Game;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteGameDialog({ game, onCancel, onConfirm }: DeleteGameDialogProps) {
  if (!game) {
    return null;
  }

  const title = game.displayTitle || game.title;

  return (
    <div className="fixed inset-0 z-50 grid animate-[modal-fade-in_200ms_ease-out] place-items-end bg-black/60 p-4 backdrop-blur-sm sm:place-items-center">
      <section className="glass-panel w-full max-w-md animate-[sheet-slide-up_200ms_ease-out] rounded-xl p-5">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-rose-400/14 text-rose-300">
          <AlertTriangle size={23} />
        </div>
        <h2 className="mt-5 text-xl font-bold text-white">{uiTerms.deleteGame}？</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          「{title}」會從本機資料移除。這個動作目前沒有復原功能。
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="secondary" type="button" onClick={onCancel}>取消</Button>
          <Button variant="danger" type="button" onClick={onConfirm}>{uiTerms.delete}</Button>
        </div>
      </section>
    </div>
  );
}
