"use client";

import { BarChart3, Library, Plus } from "lucide-react";
import { AppLogo } from "@/components/layout/AppLogo";
import { AppVersionInfo } from "@/components/layout/AppVersionInfo";
import { uiTerms } from "@/lib/terminology";
import { cn } from "@/lib/utils";

export type AppView = "dashboard" | "library" | "form" | "insights";

interface AppShellProps {
  activeView: AppView;
  onViewChange: (view: AppView) => void;
  subtitle?: string;
  children: React.ReactNode;
}

const navItems = [
  { view: "dashboard" as const, label: "首頁", icon: BarChart3 },
  { view: "library" as const, label: uiTerms.gameLibrary, icon: Library },
  { view: "form" as const, label: uiTerms.addGame, icon: Plus },
];

export function AppShell({ activeView, onViewChange, subtitle = uiTerms.brandSubtitle, children }: AppShellProps) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-[430px] px-4 pb-28 pt-5">
      <header className="mb-5 flex items-center rounded-2xl border border-white/[0.06] bg-[linear-gradient(90deg,rgba(16,39,58,0.65),rgba(8,17,26,0.85))] px-3 py-3 shadow-md shadow-black/10">
        <button
          className="flex min-w-0 items-center gap-2 rounded-xl py-0.5 pl-1.5 pr-3 text-left transition-colors duration-200 hover:bg-white/[0.035]"
          onClick={() => onViewChange("dashboard")}
        >
          <AppLogo />
          <span className="min-w-0">
            <span className="block text-[0.64rem] font-bold uppercase tracking-[0.46em] text-emerald-300">
              PLAYSTATION
            </span>
            <span className="mt-1 block text-[1.82rem] font-black leading-none text-white">
              {uiTerms.myGames}
            </span>
            <span className="mt-1.5 block truncate text-[0.8rem] font-medium text-slate-500/80">
              {subtitle}
            </span>
          </span>
        </button>
      </header>

      {children}
      <AppVersionInfo />

      <nav className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-[398px] rounded-xl border border-white/10 bg-slate-950/86 p-2 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="grid grid-cols-3 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.view;

            return (
              <button
                key={item.view}
                onClick={() => onViewChange(item.view)}
                className={cn(
                  "grid h-14 place-items-center rounded-lg text-xs font-semibold transition duration-200 active:scale-[0.97]",
                  isActive ? "bg-emerald-400 text-slate-950" : "text-slate-400 hover:bg-white/[0.08] hover:text-white",
                )}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </main>
  );
}
