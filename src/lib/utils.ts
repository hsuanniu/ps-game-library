import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatHours(hours?: number) {
  if (!hours) {
    return "0 小時";
  }

  return `${hours.toLocaleString("zh-TW")} 小時`;
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}
