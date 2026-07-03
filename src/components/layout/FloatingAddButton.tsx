import { Plus } from "lucide-react";
import { uiTerms } from "@/lib/terminology";

interface FloatingAddButtonProps {
  onClick: () => void;
}

export function FloatingAddButton({ onClick }: FloatingAddButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={uiTerms.addGame}
      className="fixed bottom-24 right-5 z-30 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-400 text-slate-950 shadow-2xl shadow-emerald-950/40 transition duration-200 hover:bg-emerald-300 active:scale-95 sm:hidden"
    >
      <Plus size={24} />
    </button>
  );
}
