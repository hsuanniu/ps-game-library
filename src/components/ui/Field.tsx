import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
}

export function Field({ label, error, children }: FieldProps) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium text-slate-200">{label}</span>
      {children}
      {error ? <span className="text-xs font-medium text-rose-300">{error}</span> : null}
    </label>
  );
}

export function inputClassName(className?: string) {
  return cn(
    "min-h-11 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 text-sm text-white outline-none transition duration-200 placeholder:text-slate-500 hover:border-white/18 focus:border-emerald-300/80 focus:bg-white/[0.08] focus:ring-4 focus:ring-emerald-400/10",
    className,
  );
}
