import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "emerald" | "blue" | "amber" | "rose" | "slate";
  onClick?: () => void;
}

const toneClass = {
  emerald: "bg-emerald-400/9 text-emerald-300/85",
  blue: "bg-sky-400/9 text-sky-300/85",
  amber: "bg-amber-400/9 text-amber-300/85",
  rose: "bg-rose-400/9 text-rose-300/85",
  slate: "bg-slate-400/9 text-slate-300/85",
};

export function StatCard({ label, value, icon: Icon, tone = "emerald", onClick }: StatCardProps) {
  const content = (
    <>
      <div className={`grid h-10 w-10 place-items-center rounded-lg ${toneClass[tone]}`}>
        <Icon size={21} />
      </div>
      <p className="mt-4 text-2xl font-bold text-slate-100">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded-xl border border-white/[0.055] bg-slate-950/42 p-4 text-left shadow-lg shadow-black/10 transition duration-200 hover:-translate-y-0.5 hover:border-white/10 hover:bg-white/[0.028] active:scale-[0.985]"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.055] bg-slate-950/42 p-4 shadow-lg shadow-black/10">
      {content}
    </div>
  );
}
