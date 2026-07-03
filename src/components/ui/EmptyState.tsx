import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="glass-panel grid min-h-60 place-items-center rounded-xl p-8 text-center">
      <div className="mx-auto grid max-w-xs gap-4">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-emerald-400/14 text-emerald-300">
          <Plus size={22} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
        </div>
        {actionLabel && onAction ? (
          <Button onClick={onAction} className="mx-auto">
            <Plus size={17} />
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
