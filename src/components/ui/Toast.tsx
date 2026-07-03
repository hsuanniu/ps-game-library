import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import type { ToastMessage } from "@/hooks/useToast";
import { cn } from "@/lib/utils";

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastViewport({ toasts, onDismiss }: ToastProps) {
  return (
    <div className="fixed left-4 right-4 top-4 z-50 grid gap-2 md:left-auto md:w-96">
      {toasts.map((toast) => {
        const Icon = toast.tone === "danger" ? XCircle : toast.tone === "neutral" ? Info : CheckCircle2;

        return (
          <div
            key={toast.id}
            className={cn(
              "glass-panel flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-white shadow-2xl transition duration-200",
              toast.tone === "danger" && "border-rose-400/20",
              toast.tone === "success" && "border-emerald-400/20",
            )}
          >
            <Icon size={18} className={cn(toast.tone === "danger" ? "text-rose-300" : "text-emerald-300")} />
            <span className="flex-1 font-medium">{toast.title}</span>
            <button
              className="rounded-md p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
              onClick={() => onDismiss(toast.id)}
              aria-label="關閉通知"
            >
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
