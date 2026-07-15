import { formatGenreLabel } from "@/lib/gameMetadataDisplay";
import { formatTaiwanAgeRating } from "@/lib/gameMetadataDisplay";
import { getCollectionGames as getCollectionGamesBase } from "@/lib/gameCollection";
import type { Game } from "@/types/game";

export interface InsightDatum {
  label: string;
  value: number;
}

export interface PlatformOwnershipMatrix {
  ps5Digital: number;
  ps5Disc: number;
  ps4Digital: number;
  ps4Disc: number;
}

export interface CompletionStats {
  completed: number;
  incomplete: number;
  total: number;
  rate: number;
}

export interface CollectionDna {
  total: number;
  primaryPlatform: "PS5" | "PS4" | "尚未建立";
  primaryOwnership: "光碟" | "數位" | "尚未建立";
  primaryGenre: string;
  totalPlayTime: number;
  completionRate: number;
  insight: string;
}

export interface PlayerStyle {
  text: string;
}

export function getCollectionGames(games: Game[]) {
  return getCollectionGamesBase(games);
}

export function getGenreDistribution(games: Game[]) {
  const counts = new Map<string, number>();

  games.forEach((game) => {
    const genres = game.genre?.length ? game.genre : ["未分類"];
    genres.forEach((genre) => increment(counts, formatGenreLabel(genre)));
  });

  return topFiveWithOthers(toSortedData(counts));
}

export function getPlayTimeByGenre(games: Game[]) {
  const totals = new Map<string, number>();

  games.forEach((game) => {
    const hours = game.playTimeHours ?? 0;
    const genres = game.genre?.length ? game.genre : ["未分類"];
    genres.forEach((genre) => increment(totals, formatGenreLabel(genre), hours));
  });

  return topFiveWithOthers(toSortedData(totals));
}

export function getPlatformOwnershipMatrix(games: Game[]): PlatformOwnershipMatrix {
  return games.reduce<PlatformOwnershipMatrix>(
    (matrix, game) => {
      const isDigital = game.ownershipType === "digital" || game.ownershipType === "ps_plus";
      const isDisc = game.ownershipType === "disc";

      if (game.platform === "PS5" && isDigital) {
        matrix.ps5Digital += 1;
      }

      if (game.platform === "PS5" && isDisc) {
        matrix.ps5Disc += 1;
      }

      if (game.platform === "PS4" && isDigital) {
        matrix.ps4Digital += 1;
      }

      if (game.platform === "PS4" && isDisc) {
        matrix.ps4Disc += 1;
      }

      return matrix;
    },
    { ps5Digital: 0, ps5Disc: 0, ps4Digital: 0, ps4Disc: 0 },
  );
}

export function getCompletionStats(games: Game[]): CompletionStats {
  const completed = games.filter((game) => game.isCompleted).length;
  const total = games.length;
  const incomplete = Math.max(total - completed, 0);

  return {
    completed,
    incomplete,
    total,
    rate: total ? Math.round((completed / total) * 100) : 0,
  };
}

export function getAgeRatingDistribution(games: Game[]) {
  const counts = new Map<string, number>();

  games.forEach((game) => {
    increment(counts, formatTaiwanAgeRating(game.ageRating) ?? "未標示");
  });

  const order = ["限制級", "輔15級", "輔12級", "保護級", "普遍級", "未標示"];

  return toSortedData(counts).sort((a, b) => {
    const orderA = order.indexOf(a.label);
    const orderB = order.indexOf(b.label);
    return (orderA === -1 ? order.length : orderA) - (orderB === -1 ? order.length : orderB);
  });
}

export function getCollectionDna(games: Game[]): CollectionDna {
  const matrix = getPlatformOwnershipMatrix(games);
  const genreDistribution = getGenreDistribution(games);
  const completion = getCompletionStats(games);
  const totalPlayTime = games.reduce((sum, game) => sum + (game.playTimeHours ?? 0), 0);
  const ps5Total = matrix.ps5Digital + matrix.ps5Disc;
  const ps4Total = matrix.ps4Digital + matrix.ps4Disc;
  const digitalTotal = matrix.ps5Digital + matrix.ps4Digital;
  const discTotal = matrix.ps5Disc + matrix.ps4Disc;
  const primaryPlatform = ps5Total >= ps4Total ? "PS5" : "PS4";
  const primaryOwnership = digitalTotal >= discTotal ? "數位" : "光碟";
  const primaryGenre = genreDistribution[0]?.label ?? "未分類";

  return {
    total: games.length,
    primaryPlatform: games.length ? primaryPlatform : "尚未建立",
    primaryOwnership: games.length ? primaryOwnership : "尚未建立",
    primaryGenre,
    totalPlayTime,
    completionRate: completion.rate,
    insight: games.length
      ? `偏好 ${primaryPlatform} ${primaryOwnership}收藏的 ${primaryGenre} 玩家。`
      : "新增更多遊戲後，這裡會顯示你的遊戲風格。",
  };
}

export function getPlayerStyle(games: Game[]): PlayerStyle {
  if (!games.length) {
    return {
      text: "新增更多遊戲後，這裡會顯示你的遊戲風格。",
    };
  }

  const ps5Total = games.filter((game) => game.platform === "PS5").length;
  const ps4Total = games.filter((game) => game.platform === "PS4").length;
  const digitalTotal = games.filter((game) => game.ownershipType === "digital" || game.ownershipType === "ps_plus").length;
  const discTotal = games.filter((game) => game.ownershipType === "disc").length;
  const genreDistribution = getGenreDistribution(games.filter((game) => game.genre?.length));
  const platformLabel = ps5Total === ps4Total ? "PS4 / PS5" : ps5Total > ps4Total ? "PS5" : "PS4";
  const ownershipLabel =
    digitalTotal === discTotal ? "實體與數位並重" : digitalTotal > discTotal ? "數位收藏" : "實體收藏";
  const genreLabel = genreDistribution[0]?.label ?? "多元類型";

  return {
    text: `你是一位偏好 ${platformLabel} ${ownershipLabel}的${genreLabel}玩家。`,
  };
}

function increment(map: Map<string, number>, key: string, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function toSortedData(map: Map<string, number>): InsightDatum[] {
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
}

function topFiveWithOthers(data: InsightDatum[]) {
  if (data.length <= 5) {
    return data;
  }

  const topFive = data.slice(0, 5);
  const others = data.slice(5).reduce((sum, item) => sum + item.value, 0);

  return [...topFive, { label: "其他", value: others }];
}
