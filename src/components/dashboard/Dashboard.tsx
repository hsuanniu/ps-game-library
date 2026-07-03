import { ChevronRight, Clock3, Disc3, Gamepad2, Heart } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/dashboard/StatCard";
import { StoreBagIcon } from "@/components/icons/StoreBagIcon";
import { getGameStats } from "@/lib/gameStats";
import { dashboardTerms, uiTerms } from "@/lib/terminology";
import { formatHours } from "@/lib/utils";
import type { Game, LibraryFilter, LibrarySortContext } from "@/types/game";

interface DashboardProps {
  games: Game[];
  isLoading: boolean;
  onAddGame: () => void;
  onOpenLibrary: (options?: { filter?: LibraryFilter; sortContext?: LibrarySortContext }) => void;
}

export function Dashboard({ games, isLoading, onAddGame, onOpenLibrary }: DashboardProps) {
  const stats = getGameStats(games);
  const discCount = games.filter((game) => game.ownershipType === "disc").length;
  const digitalCount = games.filter((game) => game.ownershipType === "digital" || game.ownershipType === "ps_plus").length;

  if (isLoading) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-36" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!games.length) {
    return <EmptyState title="目前還沒有遊戲" description="新增第一款吧，先填名稱、遊戲版本與狀態就能完成。" actionLabel={uiTerms.addGame} onAction={onAddGame} />;
  }

  return (
    <div className="grid gap-4">
      <button
        type="button"
        onClick={() => onOpenLibrary({ filter: "collection", sortContext: "library" })}
        className="glass-panel rounded-xl p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-white/16 hover:shadow-2xl hover:shadow-black/20 active:scale-[0.98]"
      >
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-400/14 text-emerald-300">
            <Gamepad2 size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-emerald-300">收藏</p>
              <ChevronRight size={18} className="text-slate-500" />
            </div>
            <h2 className="mt-1 text-3xl font-black leading-none text-white">{stats.total} 款</h2>
            <p className="mt-2 text-sm text-slate-400">{discCount} 光碟 · {digitalCount} 下載</p>
          </div>
        </div>
      </button>

      <section className="grid grid-cols-2 gap-3">
        <StatCard label={dashboardTerms.discEdition} value={discCount} icon={Disc3} onClick={() => onOpenLibrary({ filter: "disc", sortContext: "disc" })} />
        <StatCard label={dashboardTerms.digitalEdition} value={digitalCount} icon={StoreBagIcon} tone="blue" onClick={() => onOpenLibrary({ filter: "digital", sortContext: "digital" })} />
        <StatCard label={dashboardTerms.wishlist} value={stats.wishlist} icon={Heart} tone="rose" onClick={() => onOpenLibrary({ filter: "wishlist", sortContext: "wishlist" })} />
        <StatCard label={dashboardTerms.totalPlayTime} value={formatHours(stats.totalHours)} icon={Clock3} tone="amber" onClick={() => onOpenLibrary({ filter: "collection", sortContext: "playtime" })} />
      </section>

    </div>
  );
}
