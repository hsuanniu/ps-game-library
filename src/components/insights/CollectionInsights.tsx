import { ArrowLeft, BarChart3, CheckCircle2, Clock3, Disc3, Grid2X2, Sparkles } from "lucide-react";
import {
  getAgeRatingDistribution,
  getCollectionDna,
  getCollectionGames,
  getCompletionStats,
  getGenreDistribution,
  getPlatformOwnershipMatrix,
  getPlayTimeByGenre,
  type InsightDatum,
} from "@/lib/insights";
import { formatHours } from "@/lib/utils";
import type { Game } from "@/types/game";

interface CollectionInsightsProps {
  games: Game[];
  onBack: () => void;
}

const barTones = [
  "bg-emerald-300",
  "bg-sky-300",
  "bg-indigo-300",
  "bg-cyan-300",
  "bg-slate-400",
  "bg-white/30",
];

export function CollectionInsights({ games, onBack }: CollectionInsightsProps) {
  const collectionGames = getCollectionGames(games);
  const dna = getCollectionDna(collectionGames);
  const genreDistribution = getGenreDistribution(collectionGames);
  const playTimeByGenre = getPlayTimeByGenre(collectionGames);
  const matrix = getPlatformOwnershipMatrix(collectionGames);
  const completion = getCompletionStats(collectionGames);
  const ageRatingDistribution = getAgeRatingDistribution(collectionGames);
  const hasEnoughData = collectionGames.length > 0;

  if (!hasEnoughData) {
    return (
      <section className="grid gap-4">
        <InsightsHeader onBack={onBack} />
        <div className="glass-panel rounded-xl p-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-emerald-400/12 text-emerald-300">
            <Sparkles size={24} />
          </div>
          <h2 className="mt-4 text-lg font-bold text-white">還沒有足夠資料產生分析</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">新增更多遊戲後，這裡會顯示你的收藏偏好。</p>
        </div>
      </section>
    );
  }

  const matrixItems = [
    { label: "PS5", sublabel: "下載版", value: matrix.ps5Digital },
    { label: "PS5", sublabel: "光碟版", value: matrix.ps5Disc },
    { label: "PS4", sublabel: "下載版", value: matrix.ps4Digital },
    { label: "PS4", sublabel: "光碟版", value: matrix.ps4Disc },
  ];
  const matrixTop = matrixItems.reduce((top, item) => (item.value > top.value ? item : top), matrixItems[0]);
  const ageTop = ageRatingDistribution.slice(0, 2).map((item) => item.label).join("與");

  return (
    <section className="grid gap-4">
      <InsightsHeader onBack={onBack} />

      <InsightCard icon={Sparkles} title="我的收藏 DNA">
        <p className="text-lg font-black leading-snug text-white">{dna.insight}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <DnaItem label="收藏總數" value={`${dna.total} 款`} />
          <DnaItem label="主力平台" value={dna.primaryPlatform} />
          <DnaItem label="主力形式" value={dna.primaryOwnership} />
          <DnaItem label="最常類型" value={dna.primaryGenre} />
          <DnaItem label="累積時數" value={formatHours(dna.totalPlayTime)} />
          <DnaItem label="完成率" value={`${dna.completionRate}%`} />
        </div>
      </InsightCard>

      <InsightCard icon={BarChart3} title="收藏類型分布" insight={`你的收藏以 ${genreDistribution[0]?.label ?? "未分類"} 遊戲為主。`}>
        <HorizontalBars data={genreDistribution} unit="款" />
      </InsightCard>

      <InsightCard icon={Clock3} title="遊玩時間 × 類型" insight={`你花最多時間在 ${playTimeByGenre[0]?.label ?? "未分類"} 遊戲。`}>
        <HorizontalBars data={playTimeByGenre} unit="小時" />
      </InsightCard>

      <InsightCard icon={Grid2X2} title="PS4 / PS5 × 光碟 / 數位" insight={`你的收藏以 ${matrixTop.label} ${matrixTop.sublabel}為主。`}>
        <div className="grid grid-cols-2 gap-2">
          {matrixItems.map((item) => (
            <div key={`${item.label}-${item.sublabel}`} className="rounded-lg border border-white/[0.07] bg-white/[0.045] p-3">
              <p className="text-xs font-bold text-emerald-300">{item.label}</p>
              <p className="mt-1 text-xs text-slate-400">{item.sublabel}</p>
              <p className="mt-3 text-2xl font-black text-white">{item.value}</p>
            </div>
          ))}
        </div>
      </InsightCard>

      <InsightCard icon={CheckCircle2} title="完成率" insight={`你目前已完成 ${completion.rate}% 的收藏遊戲。`}>
        <div className="grid grid-cols-[112px_1fr] items-center gap-4">
          <DonutChart value={completion.rate} />
          <div className="grid gap-2">
            <MetricRow label="已完成" value={completion.completed} />
            <MetricRow label="未完成" value={completion.incomplete} />
          </div>
        </div>
      </InsightCard>

      <InsightCard icon={Disc3} title="遊戲分級" insight={ageTop ? `你的收藏主要集中在 ${ageTop}。` : "你的收藏尚未建立分級分布。"}>
        <HorizontalBars data={ageRatingDistribution} unit="款" />
      </InsightCard>
    </section>
  );
}

function InsightsHeader({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-300">INSIGHTS</p>
        <h1 className="mt-1 text-2xl font-black text-white">收藏分析</h1>
      </div>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.05] text-slate-300 transition duration-200 hover:bg-white/[0.08] active:scale-95"
        aria-label="回到首頁"
      >
        <ArrowLeft size={18} />
      </button>
    </div>
  );
}

function InsightCard({
  icon: Icon,
  title,
  insight,
  children,
}: {
  icon: typeof Sparkles;
  title: string;
  insight?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="glass-panel rounded-xl p-4">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-400/12 text-emerald-300">
          <Icon size={20} />
        </div>
        <h2 className="text-base font-bold text-white">{title}</h2>
      </div>
      {children}
      {insight ? <p className="mt-4 text-sm leading-6 text-slate-400">{insight}</p> : null}
    </section>
  );
}

function DnaItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-white/[0.045] px-3 py-2">
      <p className="text-[0.68rem] font-semibold text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-slate-100">{value}</p>
    </div>
  );
}

function HorizontalBars({ data, unit }: { data: InsightDatum[]; unit: string }) {
  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="grid gap-3">
      {data.map((item, index) => (
        <div key={item.label} className="grid gap-1.5">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="truncate font-semibold text-slate-200">{item.label}</span>
            <span className="shrink-0 font-bold text-slate-400">{item.value} {unit}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={`h-full rounded-full ${barTones[index % barTones.length]}`}
              style={{ width: `${Math.max((item.value / maxValue) * 100, 6)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ value }: { value: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative h-28 w-28">
      <svg viewBox="0 0 112 112" className="h-28 w-28 -rotate-90">
        <circle cx="56" cy="56" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
        <circle
          cx="56"
          cy="56"
          r={radius}
          fill="none"
          stroke="rgb(52 211 153)"
          strokeLinecap="round"
          strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="text-2xl font-black text-white">{value}%</span>
      </div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white/[0.045] px-3 py-2">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-bold text-white">{value}</span>
    </div>
  );
}
