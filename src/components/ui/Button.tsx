import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45",
          variant === "primary" && "bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-950/30 hover:bg-emerald-300",
          variant === "secondary" && "border border-white/10 bg-white/[0.07] text-white hover:bg-white/[0.11]",
          variant === "ghost" && "text-slate-200 hover:bg-white/[0.08]",
          variant === "danger" && "bg-rose-500 text-white shadow-lg shadow-rose-950/30 hover:bg-rose-400",
          size === "sm" && "h-9 px-3 text-sm",
          size === "md" && "h-11 px-4 text-sm",
          size === "lg" && "h-12 px-5 text-base",
          size === "icon" && "h-10 w-10",
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
