import { ArrowUpDown, Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import type { LibrarySort, LibrarySortContext } from "@/types/game";

interface GameSortSheetProps {
  activeSort: LibrarySort;
  sortContext: LibrarySortContext;
  onSortChange: (sort: LibrarySort) => void;
}

const sortOptions: Array<{ value: LibrarySort; label: string }> = [
  { value: "newest", label: "最近加入" },
  { value: "name-asc", label: "名稱 A → Z" },
  { value: "name-desc", label: "名稱 Z → A" },
  { value: "playtime-desc", label: "遊玩時間：多 → 少" },
  { value: "playtime-asc", label: "遊玩時間：少 → 多" },
];

export function GameSortSheet({ activeSort, sortContext, onSortChange }: GameSortSheetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const visibleSortOptions = sortContext === "wishlist"
    ? sortOptions.filter((option) => !option.value.startsWith("playtime"))
    : sortOptions;

  function selectSort(sort: LibrarySort) {
    onSortChange(sort);
    setIsOpen(false);
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="排序"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.07] text-slate-300 transition duration-200 hover:bg-white/[0.11] hover:text-white active:scale-[0.98]"
      >
        <ArrowUpDown size={18} />
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
          <>
            <button
              type="button"
              aria-label="關閉排序"
              className="fixed inset-0 z-50 animate-[modal-fade-in_200ms_ease-out] bg-black/[0.65] backdrop-blur-md"
              onClick={() => setIsOpen(false)}
            />
            <section
              className="glass-panel fixed bottom-24 left-4 right-4 z-[60] mx-auto w-auto max-w-[398px] animate-[sheet-slide-up_200ms_ease-out] rounded-t-[24px] rounded-b-2xl p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="sort-title"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 id="sort-title" className="font-bold text-white">排序</h3>
                  <p className="mt-1 text-sm text-slate-400">決定目前列表的排列方式。</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="關閉排序"
                  className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-white/[0.08] hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="grid gap-2">
                {visibleSortOptions.map((option) => {
                  const isActive = activeSort === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => selectSort(option.value)}
                      className={cn(
                        "flex min-h-11 items-center justify-between rounded-lg px-3 text-left text-sm font-semibold transition duration-200 active:scale-[0.99]",
                        isActive ? "bg-emerald-400 text-slate-950" : "bg-white/[0.07] text-slate-200 hover:bg-white/[0.11] hover:text-white",
                      )}
                    >
                      {option.label}
                      {isActive ? <Check size={17} /> : null}
                    </button>
                  );
                })}
              </div>
            </section>
          </>,
          document.body,
        )
        : null}
    </>
  );
}
