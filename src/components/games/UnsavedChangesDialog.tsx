import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface UnsavedChangesDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onLeave: () => void;
}

export function UnsavedChangesDialog({ isOpen, onCancel, onLeave }: UnsavedChangesDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid animate-[modal-fade-in_200ms_ease-out] place-items-end bg-black/60 p-4 backdrop-blur-sm sm:place-items-center">
      <section className="glass-panel w-full max-w-md animate-[sheet-slide-up_200ms_ease-out] rounded-xl p-5">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-amber-400/14 text-amber-300">
          <AlertTriangle size={23} />
        </div>
        <h2 className="mt-5 text-xl font-bold text-white">尚未儲存</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          目前修改尚未儲存，確定要離開嗎？
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="secondary" type="button" onClick={onCancel}>取消</Button>
          <Button variant="danger" type="button" onClick={onLeave}>離開</Button>
        </div>
      </section>
    </div>
  );
}
