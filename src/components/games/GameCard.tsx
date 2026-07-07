import { Clock3, Edit3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CoverImage } from "@/components/games/CoverImage";
import { ownershipLabels, platformLabels, statusLabels } from "@/lib/constants";
import { formatTaiwanAgeRating, getTaiwanAgeRatingTone } from "@/lib/gameMetadataDisplay";
import { uiTerms } from "@/lib/terminology";
import { cn } from "@/lib/utils";
import { formatHours } from "@/lib/utils";
import type { Game } from "@/types/game";

interface GameCardProps {
  game: Game;
  onEdit: (game: Game) => void;
  onDelete: (game: Game) => void;
}

const ageRatingToneClass = {
  green: "bg-emerald-400/12 text-emerald-200",
  blue: "bg-sky-400/12 text-sky-200",
  yellow: "bg-yellow-300/14 text-yellow-100",
  orange: "bg-orange-400/14 text-orange-100",
  red: "bg-rose-400/14 text-rose-200",
  neutral: "bg-white/[0.06] text-slate-300",
};

const badgeClassName = "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold leading-none";

export function GameCard({ game, onEdit, onDelete }: GameCardProps) {
  const primaryTitle = game.displayTitle || game.title;
  const showOfficialTitle = Boolean(game.displayTitle && game.displayTitle !== game.title);
  const ageRatingLabel = formatTaiwanAgeRating(game.ageRating);
  const ageRatingTone = getTaiwanAgeRatingTone(ageRatingLabel);

  return (
    <article className="group overflow-hidden rounded-xl border border-white/10 bg-white/[0.055] shadow-lg shadow-black/10 transition duration-200 hover:-translate-y-1 hover:border-white/18 hover:bg-white/[0.075] hover:shadow-2xl hover:shadow-black/20">
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-900">
        {game.coverUrl ? (
          <CoverImage
            coverUrl={game.coverUrl}
            alt={primaryTitle}
            className="object-cover transition duration-200 group-hover:scale-[1.03]"
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          />
        ) : (
          <div className="grid h-full place-items-center text-sm font-semibold text-slate-500">No Cover</div>
        )}
        <div className="absolute left-3 top-3 rounded-md bg-slate-950/72 px-2 py-1 text-xs font-bold text-white backdrop-blur">
          {platformLabels[game.platform]}
        </div>
      </div>

      <div className="grid gap-4 p-4">
        <div>
          <h3 className="line-clamp-2 text-base font-bold leading-snug text-white">{primaryTitle}</h3>
          {showOfficialTitle ? (
            <p className="mt-1 line-clamp-1 text-xs font-medium text-slate-400">{game.title}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={cn(badgeClassName, "bg-emerald-400/12 text-emerald-200")}>{statusLabels[game.status]}</span>
            <span className={cn(badgeClassName, "bg-sky-400/12 text-sky-200")}>{ownershipLabels[game.ownershipType]}</span>
            {ageRatingLabel ? (
              <span className={cn(badgeClassName, ageRatingToneClass[ageRatingTone])}>{ageRatingLabel}</span>
            ) : null}
            {game.isCompleted ? (
              <span className={cn(badgeClassName, "animate-[modal-fade-in_180ms_ease-out] bg-emerald-400/12 text-emerald-200")}>✔ 完成</span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1 text-sm text-slate-300">
            <Clock3 size={15} />
            {formatHours(game.playTimeHours)}
          </span>
          <div className="flex gap-1.5">
            <Button variant="secondary" size="icon" onClick={() => onEdit(game)} aria-label={`編輯 ${primaryTitle}`} className="h-9 w-9 hover:bg-white/[0.09]">
              <Edit3 size={15} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(game)} aria-label={`${uiTerms.delete} ${primaryTitle}`} className="h-9 w-9 text-rose-300 hover:bg-rose-400/10 hover:text-rose-200">
              <Trash2 size={15} />
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
