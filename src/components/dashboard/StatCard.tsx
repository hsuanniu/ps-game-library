import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "emerald" | "blue" | "amber" | "rose" | "slate";
  onClick?: () => void;
}

const toneClass = {
  emerald: "bg-emerald-400/14 text-emerald-300",
  blue: "bg-sky-400/14 text-sky-300",
  amber: "bg-amber-400/14 text-amber-300",
  rose: "bg-rose-400/14 text-rose-300",
  slate: "bg-slate-400/14 text-slate-300",
};

export function StatCard({ label, value, icon: Icon, tone = "emerald", onClick }: StatCardProps) {
  const content = (
    <>
      <div className={`grid h-10 w-10 place-items-center rounded-lg ${toneClass[tone]}`}>
        <Icon size={22} />
      </div>
      <p className="mt-4 text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-sm text-slate-400">{label}</p>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="glass-panel rounded-xl p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-white/14 hover:bg-white/[0.035] active:scale-[0.985]"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="glass-panel rounded-xl p-4">
      {content}
    </div>
  );
}
