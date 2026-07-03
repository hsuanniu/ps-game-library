import { Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { filterLabels } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { LibraryFilter } from "@/types/game";

interface GameFiltersProps {
  activeFilter: LibraryFilter;
  query: string;
  onFilterChange: (filter: LibraryFilter) => void;
  onQueryChange: (query: string) => void;
}

export function GameFilters({ activeFilter, query, onFilterChange, onQueryChange }: GameFiltersProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const primaryFilters: LibraryFilter[] = ["all", "collection", "wishlist"];
  const dashboardOnlyFilters: LibraryFilter[] = ["disc", "digital"];
  const visiblePrimaryFilters = dashboardOnlyFilters.includes(activeFilter) ? [...primaryFilters, activeFilter] : primaryFilters;
  // Keep low-frequency filters wired for later, but hide them in the MVP UI.
  const reservedAdvancedFilters: LibraryFilter[] = ["waiting_sale", "borrowed", "rented", "sold"];
  const visibleAdvancedFilters: LibraryFilter[] = ["borrowed", "rented", "sold"];
  const hasAdvancedFilters = visibleAdvancedFilters.length > 0;
  const isAdvancedActive = reservedAdvancedFilters.includes(activeFilter);

  function selectFilter(filter: LibraryFilter) {
    onFilterChange(filter);
    setIsPanelOpen(false);
  }

  useEffect(() => {
    if (!isPanelOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsPanelOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPanelOpen]);

  return (
    <div className="grid gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜尋遊戲…"
          className="min-h-14 w-full rounded-xl border border-white/10 bg-white/[0.06] pl-10 pr-4 text-sm text-white outline-none transition duration-200 placeholder:text-slate-500 hover:border-white/18 focus:border-emerald-300/80 focus:ring-4 focus:ring-emerald-400/10"
        />
      </div>
      <div className="flex items-center gap-2">
        <div className={cn("grid min-w-0 flex-1 gap-2", visiblePrimaryFilters.length > 3 ? "grid-cols-4" : "grid-cols-3")}>
          {visiblePrimaryFilters.map((filter) => {
            const isActive = activeFilter === filter;

            return (
              <button
                key={filter}
                onClick={() => selectFilter(filter)}
                className={cn(
                  "min-h-10 rounded-lg px-2 text-sm font-semibold transition duration-200 active:scale-[0.98]",
                  isActive ? "bg-emerald-400 text-slate-950" : "bg-white/[0.07] text-slate-300 hover:bg-white/[0.11] hover:text-white",
                )}
              >
                {filterLabels[filter]}
              </button>
            );
          })}
        </div>
        {hasAdvancedFilters ? (
          <button
            type="button"
            onClick={() => setIsPanelOpen(true)}
            aria-label="進階篩選"
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 transition duration-200 active:scale-[0.98]",
              isAdvancedActive ? "bg-emerald-400 text-slate-950" : "bg-white/[0.07] text-slate-300 hover:bg-white/[0.11] hover:text-white",
            )}
          >
            <SlidersHorizontal size={18} />
          </button>
        ) : null}
      </div>

      {hasAdvancedFilters && isPanelOpen && typeof document !== "undefined"
        ? createPortal(
          <>
            <button
              type="button"
              aria-label="關閉進階篩選"
              className="fixed inset-0 z-50 animate-[modal-fade-in_200ms_ease-out] bg-black/[0.65] backdrop-blur-md"
              onClick={() => setIsPanelOpen(false)}
            />
          <section
              className="glass-panel fixed bottom-24 left-4 right-4 z-[60] mx-auto w-auto max-w-[398px] animate-[sheet-slide-up_200ms_ease-out] rounded-t-[24px] rounded-b-2xl p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="advanced-filter-title"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 id="advanced-filter-title" className="font-bold text-white">進階篩選</h3>
                <p className="mt-1 text-sm text-slate-400">低頻分類先收在這裡。</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPanelOpen(false)}
                aria-label="關閉進階篩選"
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-white/[0.08] hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-2">
              {visibleAdvancedFilters.map((filter) => {
                const isActive = activeFilter === filter;

                return (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => selectFilter(filter)}
                    className={cn(
                      "flex min-h-11 items-center justify-between rounded-lg px-3 text-left text-sm font-semibold transition duration-200 active:scale-[0.99]",
                      isActive ? "bg-emerald-400 text-slate-950" : "bg-white/[0.07] text-slate-200 hover:bg-white/[0.11] hover:text-white",
                    )}
                  >
                    {filterLabels[filter]}
                    {isActive ? <span className="text-xs">已套用</span> : null}
                  </button>
                );
              })}
            </div>
          </section>
          </>,
          document.body,
        )
        : null}
    </div>
  );
}
