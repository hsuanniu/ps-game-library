import type { AgeRating } from "@/types/game";

const genreLabels: Record<string, string> = {
  shooter: "射擊",
  adventure: "冒險",
  "role-playing (rpg)": "角色扮演",
  rpg: "角色扮演",
  action: "動作",
  strategy: "策略",
  puzzle: "益智",
  racing: "競速",
  sport: "運動",
  sports: "運動",
  simulator: "模擬",
  simulation: "模擬",
  fighting: "格鬥",
  platform: "平台動作",
  indie: "獨立遊戲",
};

export function formatGenreLabel(genre: string) {
  return genreLabels[genre.trim().toLowerCase()] ?? genre;
}

export function formatGenreList(genres: string[] = []) {
  return genres.map(formatGenreLabel);
}

export function formatTaiwanAgeRating(ageRating?: AgeRating) {
  if (!ageRating) {
    return undefined;
  }

  const system = ageRating.system.toUpperCase();
  const rating = ageRating.rating.toUpperCase().replace(/\s+/g, "");

  if ((system === "PEGI" && rating === "3") || (system === "ESRB" && rating === "E")) {
    return "普遍級";
  }

  if ((system === "PEGI" && rating === "7") || (system === "ESRB" && rating === "E10+")) {
    return "保護級";
  }

  if ((system === "PEGI" && rating === "12") || (system === "ESRB" && rating === "T")) {
    return "輔12級";
  }

  if (system === "PEGI" && rating === "16") {
    return "輔15級";
  }

  if ((system === "PEGI" && rating === "18") || (system === "ESRB" && rating === "M")) {
    return "限制級";
  }

  return `${ageRating.system} ${ageRating.rating}`;
}

export function getTaiwanAgeRatingTone(label?: string) {
  if (label === "普遍級") {
    return "green";
  }

  if (label === "保護級") {
    return "blue";
  }

  if (label === "輔12級") {
    return "yellow";
  }

  if (label === "輔15級") {
    return "orange";
  }

  if (label === "限制級") {
    return "red";
  }

  return "neutral";
}
