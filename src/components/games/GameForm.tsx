"use client";

import { ArrowLeft, Check, ChevronDown, ImageIcon, Search, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CoverImage } from "@/components/games/CoverImage";
import { Field, inputClassName } from "@/components/ui/Field";
import { platformOptions, visibleOwnershipOptions, visibleStatusOptions } from "@/lib/constants";
import { formatGenreList } from "@/lib/gameMetadataDisplay";
import { GameSearchError, searchGames } from "@/lib/services/gameSearchService";
import { uiTerms } from "@/lib/terminology";
import { cn } from "@/lib/utils";
import type { AgeRating, Game, GameDraft, GameSearchResult, GameStatus, OwnershipType, Platform } from "@/types/game";

interface GameFormProps {
  editingGame?: Game;
  formId?: string;
  onSubmit: (draft: GameDraft) => void;
  onCancel: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

interface FormState {
  title: string;
  displayTitle: string;
  coverUrl: string;
  platform: Platform;
  status: GameStatus;
  ownershipType: OwnershipType;
  playTimeHours: string;
  purchasePrice: string;
  purchaseDate: string;
  seriesName: string;
  seriesOrder: string;
  genre: string;
  ageRating?: AgeRating;
  isCompleted: boolean;
  loanPerson: string;
  notes: string;
}

const defaultState: FormState = {
  title: "",
  displayTitle: "",
  coverUrl: "",
  platform: "PS5",
  status: "owned",
  ownershipType: "digital",
  playTimeHours: "",
  purchasePrice: "",
  purchaseDate: "",
  seriesName: "",
  seriesOrder: "",
  genre: "",
  ageRating: undefined,
  isCompleted: false,
  loanPerson: "",
  notes: "",
};

function gameToState(game?: Game): FormState {
  if (!game) {
    return defaultState;
  }

  return {
    title: game.title,
    displayTitle: game.displayTitle ?? "",
    coverUrl: game.coverUrl ?? "",
    platform: game.platform === "PS4_PS5" ? "PS5" : game.platform,
    status: normalizeVisibleStatus(game.status),
    ownershipType: normalizeVisibleOwnershipType(game.ownershipType),
    playTimeHours: game.playTimeHours?.toString() ?? "",
    purchasePrice: game.purchasePrice?.toString() ?? "",
    purchaseDate: game.purchaseDate ?? "",
    seriesName: game.seriesName ?? "",
    seriesOrder: game.seriesOrder?.toString() ?? "",
    genre: game.genre?.join(", ") ?? "",
    ageRating: game.ageRating,
    isCompleted: game.isCompleted ?? false,
    loanPerson: game.loanPerson ?? "",
    notes: game.notes ?? "",
  };
}

function normalizeVisibleStatus(status: GameStatus): GameStatus {
  if (status === "playing" || status === "finished" || status === "paused") {
    return "owned";
  }

  if (status === "waiting_sale") {
    return "wishlist";
  }

  return status;
}

function normalizeVisibleOwnershipType(ownershipType: OwnershipType): OwnershipType {
  if (ownershipType === "disc" || ownershipType === "digital") {
    return ownershipType;
  }

  return "digital";
}

export function GameForm({ editingGame, formId, onSubmit, onCancel, onDirtyChange }: GameFormProps) {
  const initialState = useMemo(() => gameToState(editingGame), [editingGame]);
  const [form, setForm] = useState<FormState>(() => gameToState(editingGame));
  const [showMore, setShowMore] = useState(Boolean(editingGame));
  const [isManualMode, setIsManualMode] = useState(Boolean(editingGame?.displayTitle));
  const [error, setError] = useState("");
  const [results, setResults] = useState<GameSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [hasNoSearchResults, setHasNoSearchResults] = useState(false);
  const [coverError, setCoverError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const titleCanSearch = useMemo(() => form.title.trim().length >= 2, [form.title]);
  const isLoanStatus = form.status === "borrowed" || form.status === "rented";
  const loanPersonLabel = form.status === "borrowed" ? "借入對象" : "借出對象";
  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initialState), [form, initialState]);
  const showNewGameHint = !editingGame && !isDirty;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    let ignore = false;

    async function runSearch() {
      if (!titleCanSearch || isManualMode) {
        setResults([]);
        setSearchMessage("");
        setHasNoSearchResults(false);
        return;
      }

      setIsSearching(true);
      setSearchMessage("");
      setHasNoSearchResults(false);

      try {
        const nextResults = await searchGames(form.title);
        if (!ignore) {
          setResults(nextResults);
          setSearchMessage("");
          setHasNoSearchResults(!nextResults.length);
        }
      } catch (searchError) {
        if (!ignore && searchError instanceof GameSearchError) {
          setResults(searchError.fallbackResults);
          setSearchMessage(searchError.message);
          setHasNoSearchResults(false);
        } else if (!ignore) {
          setResults([]);
          setSearchMessage("搜尋失敗，請稍後再試");
          setHasNoSearchResults(false);
        }
      } finally {
        if (!ignore) {
          setIsSearching(false);
        }
      }
    }

    const timer = window.setTimeout(runSearch, 260);

    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [form.title, isManualMode, titleCanSearch]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function applySearchResult(result: GameSearchResult) {
    setForm((current) => ({
      ...current,
      title: result.title,
      coverUrl: result.coverUrl ?? current.coverUrl,
      seriesName: result.collectionName ?? result.franchiseName ?? current.seriesName,
      genre: result.genre?.length ? formatGenreList(result.genre).join(", ") : current.genre,
      ageRating: result.ageRating,
    }));
    setResults([]);
    setSearchMessage("");
    setHasNoSearchResults(false);
    setIsManualMode(false);
    setCoverError("");
  }

  function enterManualMode() {
    setIsManualMode(true);
    setShowMore(true);
    setResults([]);
    setSearchMessage("");
    setHasNoSearchResults(false);
  }

  function removeCover() {
    update("coverUrl", "");
    setCoverError("");
  }

  function openCoverUpload() {
    fileInputRef.current?.click();
  }

  function handleCoverUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setCoverError("請選擇圖片檔案");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        update("coverUrl", reader.result);
        setCoverError("");
      }
    };
    reader.onerror = () => {
      setCoverError("封面讀取失敗，請換一張圖片試試");
    };
    reader.readAsDataURL(file);
  }

  function toDraft(): GameDraft {
    return {
      title: form.title.trim(),
      displayTitle: form.displayTitle.trim() || undefined,
      coverUrl: form.coverUrl.trim() || undefined,
      platform: form.platform,
      status: form.status,
      ownershipType: form.ownershipType,
      playTimeHours: form.playTimeHours ? Number(form.playTimeHours) : undefined,
      purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : undefined,
      purchaseDate: form.purchaseDate || undefined,
      seriesName: form.seriesName.trim() || undefined,
      seriesOrder: form.seriesOrder ? Number(form.seriesOrder) : undefined,
      genre: form.genre
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      ageRating: form.ageRating,
      isCompleted: form.isCompleted,
      loanPerson: isLoanStatus ? form.loanPerson.trim() || undefined : undefined,
      notes: form.notes.trim() || undefined,
    };
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.title.trim()) {
      setError("請輸入遊戲名稱");
      return;
    }

    setError("");
    onDirtyChange?.(false);
    onSubmit(toDraft());
    if (!editingGame) {
      setForm(defaultState);
      setShowMore(false);
      setIsManualMode(false);
    }
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="grid gap-5">
      <section className="glass-panel rounded-xl p-4">
        <div className="mb-5">
          <button
            type="button"
            onClick={onCancel}
            className="mb-4 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-slate-400 transition duration-200 hover:bg-white/[0.06] hover:text-white active:scale-[0.98]"
          >
            <ArrowLeft size={16} />
            返回
          </button>
          <p className="text-sm font-semibold text-emerald-300">{editingGame ? uiTerms.editGame : uiTerms.addGame}</p>
          <h2 className="mt-1 text-2xl font-bold text-white">{editingGame ? uiTerms.editGame : uiTerms.addGame}</h2>
        </div>

        <div className="grid gap-4">
          <Field label="遊戲名稱" error={error}>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                className={inputClassName("pl-10")}
                value={form.title}
                onChange={(event) => update("title", event.target.value)}
                placeholder="例如：Final Fantasy VII Rebirth"
              />
            </div>
          </Field>

          {(isSearching || searchMessage || hasNoSearchResults || results.length > 0) && (
            <div className="rounded-xl border border-white/10 bg-slate-950/52 p-2">
              {isSearching ? (
                <div className="flex items-center gap-3 px-2 py-3">
                  <div className="h-14 w-10 shrink-0 animate-pulse rounded-md bg-white/[0.07]" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3 w-32 animate-pulse rounded-full bg-white/[0.08]" />
                    <div className="h-3 w-48 max-w-full animate-pulse rounded-full bg-white/[0.055]" />
                  </div>
                </div>
              ) : null}
              {searchMessage ? <p className="px-2 py-3 text-sm text-amber-200">{searchMessage}</p> : null}
              {hasNoSearchResults ? (
                <div className="grid gap-3 px-2 py-3">
                  <div>
                    <p className="text-sm font-semibold text-white">找不到符合的遊戲</p>
                    <p className="mt-1 text-sm leading-5 text-slate-400">請嘗試英文名稱、其他關鍵字，或改用手動新增。</p>
                  </div>
                  <Button type="button" variant="secondary" size="sm" onClick={enterManualMode} className="justify-self-start">
                    手動新增
                  </Button>
                </div>
              ) : null}
              <div className="grid gap-2">
                {results.map((result) => (
                  <button
                    type="button"
                    key={result.id}
                    onClick={() => applySearchResult(result)}
                    className="flex items-center gap-3 rounded-lg p-2 text-left transition duration-200 hover:bg-white/[0.08] active:scale-[0.99]"
                  >
                    <div className="relative h-14 w-10 overflow-hidden rounded-md bg-white/[0.06]">
                      {result.coverUrl ? <CoverImage coverUrl={result.coverUrl} alt={result.title} className="object-cover" sizes="40px" /> : null}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{result.title}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {result.year ?? (result.releaseDate ? new Date(result.releaseDate).getFullYear() : "年份未定")} · {result.platforms?.join(", ") ?? result.platform ?? "平台未定"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-white/10 bg-white/[0.045] p-3">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
            <div className="flex items-center gap-3">
              <div className="relative grid h-24 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/10 bg-slate-950/80">
                {form.coverUrl ? (
                  <CoverImage coverUrl={form.coverUrl} alt={form.title || "遊戲封面"} className="object-cover" sizes="64px" />
                ) : (
                  <div className="grid h-full w-full place-items-center bg-gradient-to-b from-slate-900 to-slate-950 text-slate-500">
                    <ImageIcon size={24} />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">封面圖</p>
                <p className="mt-1 text-sm leading-5 text-slate-400">
                  輸入遊戲名稱並選擇候選結果後，系統會自動帶入封面。
                </p>
                {coverError ? <p className="mt-2 text-xs font-semibold text-amber-200">{coverError}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={openCoverUpload}>
                    <Upload size={15} />
                    {form.coverUrl ? "更換封面" : "上傳封面"}
                  </Button>
                  {form.coverUrl ? (
                    <Button type="button" variant="ghost" size="sm" onClick={removeCover} className="text-rose-200 hover:bg-rose-400/10 hover:text-rose-100">
                      <Trash2 size={15} />
                      移除封面
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <Field label="遊戲版本">
              <select className={inputClassName()} value={form.platform} onChange={(event) => update("platform", event.target.value as Platform)}>
                {platformOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Field>
            <Field label="狀態">
              <select className={inputClassName()} value={form.status} onChange={(event) => update("status", event.target.value as GameStatus)}>
                {visibleStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Field>
            {isLoanStatus ? (
              <Field label={loanPersonLabel}>
                <input
                  className={inputClassName()}
                  value={form.loanPerson}
                  onChange={(event) => update("loanPerson", event.target.value)}
                  placeholder="輸入人名或備註"
                />
              </Field>
            ) : null}
            <Field label="持有形式">
              <select className={inputClassName()} value={form.ownershipType} onChange={(event) => update("ownershipType", event.target.value as OwnershipType)}>
                {visibleOwnershipOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Field>
          </div>

        </div>
      </section>

      <section className="glass-panel overflow-hidden rounded-xl">
        <button
          type="button"
          onClick={() => setShowMore((current) => !current)}
          className="flex w-full items-center justify-between p-4 text-left transition duration-200 hover:bg-white/[0.04]"
        >
          <span>
            <span className="block font-semibold text-white">展開更多</span>
            <span className="mt-1 block text-sm text-slate-400">價格、系列、類型與備註</span>
          </span>
          <ChevronDown className={cn("text-slate-400 transition duration-200", showMore && "rotate-180")} />
        </button>

        {showMore ? (
          <div className="grid gap-4 border-t border-white/10 p-4">
            {isManualMode ? (
              <div className="rounded-lg border border-emerald-300/12 bg-emerald-300/[0.08] px-3 py-3 text-sm leading-6 text-emerald-50">
                你可以不使用 IGDB 資料，手動建立這款遊戲。
              </div>
            ) : null}
            <Field label="購買價格">
              <input className={inputClassName()} type="number" min="0" value={form.purchasePrice} onChange={(event) => update("purchasePrice", event.target.value)} placeholder="NT$" />
            </Field>
            <Field label="購買日期">
              <input className={inputClassName()} type="date" value={form.purchaseDate} onChange={(event) => update("purchaseDate", event.target.value)} />
            </Field>
            <Field label="遊玩時長">
              <input className={inputClassName()} type="number" min="0" value={form.playTimeHours} onChange={(event) => update("playTimeHours", event.target.value)} placeholder="小時" />
            </Field>
            <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.05] p-3 text-sm font-semibold text-slate-200 transition duration-200 hover:bg-white/[0.07]">
              <input type="checkbox" checked={form.isCompleted} onChange={(event) => update("isCompleted", event.target.checked)} className="h-4 w-4 accent-emerald-400" />
              已完成主線
            </label>
            {isManualMode ? (
              <>
                <Field label="顯示名稱（選填）">
                  <input className={inputClassName()} value={form.displayTitle} onChange={(event) => update("displayTitle", event.target.value)} placeholder="例如：巫師 3、人中之龍 8、對馬戰鬼" />
                </Field>
                <Field label="自訂封面（選填）">
                  <input className={inputClassName()} value={form.coverUrl} onChange={(event) => update("coverUrl", event.target.value)} placeholder="貼上圖片網址（選填）" />
                </Field>
              </>
            ) : null}
            <Field label="系列 / 群組">
              <input className={inputClassName()} value={form.seriesName} onChange={(event) => update("seriesName", event.target.value)} placeholder="例如：FF7 Remake 三部曲" />
            </Field>
            <Field label="系列順序">
              <input className={inputClassName()} type="number" min="0" value={form.seriesOrder} onChange={(event) => update("seriesOrder", event.target.value)} placeholder="例如：1、2、3" />
            </Field>
            <Field label="類型">
              <input className={inputClassName()} value={form.genre} onChange={(event) => update("genre", event.target.value)} placeholder="RPG, 動作" />
            </Field>
            <div>
              <Field label="備註">
                <textarea className={inputClassName("min-h-28 resize-none py-3")} value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="想記錄的版本、遊玩進度或交易備註" />
              </Field>
            </div>
          </div>
        ) : null}
      </section>

      <div className="flex flex-col-reverse gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>取消</Button>
        <Button type="submit">
          <Check size={18} />
          {editingGame ? "更新遊戲" : "儲存遊戲"}
        </Button>
        <p className="-mb-1 text-center text-xs leading-5 text-slate-500">
          填寫完成後，請按下方的{editingGame ? "更新遊戲" : "儲存遊戲"}。
        </p>
        {showNewGameHint ? (
          <p className="-mt-1 text-center text-xs leading-5 text-slate-500">
            搜尋遊戲後，系統會自動帶入封面與基本資料。
          </p>
        ) : null}
      </div>
    </form>
  );
}
