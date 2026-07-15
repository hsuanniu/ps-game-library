import { ChevronRight, Clock3, Disc3, Gamepad2, Heart, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/dashboard/StatCard";
import { StoreBagIcon } from "@/components/icons/StoreBagIcon";
import { getCollectionGames } from "@/lib/gameCollection";
import { getGameStats } from "@/lib/gameStats";
import { getPlayerStyle } from "@/lib/insights";
import { dashboardTerms } from "@/lib/terminology";
import { formatHours } from "@/lib/utils";
import type { Game, LibraryFilter, LibrarySortContext } from "@/types/game";

interface DashboardProps {
  games: Game[];
  isLoading: boolean;
  onOpenLibrary: (options?: { filter?: LibraryFilter; sortContext?: LibrarySortContext }) => void;
  onOpenInsights: () => void;
}

export function Dashboard({ games, isLoading, onOpenLibrary, onOpenInsights }: DashboardProps) {
  const stats = getGameStats(games);
  const collectionGames = getCollectionGames(games);
  const discCount = collectionGames.filter((game) => game.ownershipType === "disc").length;
  const digitalCount = collectionGames.filter((game) => game.ownershipType === "digital" || game.ownershipType === "ps_plus").length;
  const collectionInsight = stats.total
    ? `${Math.round((discCount / stats.total) * 100)}% 光碟 · ${Math.round((digitalCount / stats.total) * 100)}% 數位`
    : "尚未建立收藏";
  const playerStyle = getPlayerStyle(collectionGames);

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
            <p className="mt-2 text-sm text-slate-400">{collectionInsight}</p>
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={onOpenInsights}
        className="glass-panel rounded-xl p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-white/14 hover:bg-white/[0.035] active:scale-[0.985]"
      >
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-indigo-400/14 text-indigo-200">
            <Sparkles size={21} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-white">玩家風格</p>
              <ChevronRight size={18} className="shrink-0 text-slate-500" />
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-300">{playerStyle.text}</p>
          </div>
        </div>
      </button>

      <section className="grid grid-cols-2 gap-3">
        <StatCard label={dashboardTerms.discEdition} value={discCount} icon={Disc3} onClick={() => onOpenLibrary({ filter: "disc", sortContext: "disc" })} />
        <StatCard label={dashboardTerms.digitalEdition} value={digitalCount} icon={StoreBagIcon} tone="blue" onClick={() => onOpenLibrary({ filter: "digital", sortContext: "digital" })} />
        <StatCard label={dashboardTerms.wishlist} value={stats.wishlist} icon={Heart} tone="rose" onClick={() => onOpenLibrary({ filter: "wishlist", sortContext: "wishlist" })} />
        <StatCard label={dashboardTerms.totalPlayTime} value={formatHours(stats.totalHours)} icon={Clock3} tone="amber" onClick={() => onOpenLibrary({ filter: "collection", sortContext: "playtime" })} />
      </section>

      {!games.length ? (
        <section className="glass-panel rounded-xl p-5 text-center">
          <h2 className="text-lg font-bold text-white">目前還沒有任何遊戲</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">點擊下方「新增遊戲」開始建立你的收藏。</p>
        </section>
      ) : null}

    </div>
  );
}
