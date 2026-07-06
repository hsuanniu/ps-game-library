import type { GameStatus, LibraryFilter, OwnershipType } from "@/types/game";

export const uiTerms = {
  myGames: "我的遊戲",
  brandSubtitle: "My Games",
  yourCollection: "玩家風格",
  gameLibrary: "遊戲庫",
  addGame: "新增遊戲",
  editGame: "編輯遊戲",
  delete: "刪除",
  deleteGame: "刪除遊戲",
  gameDeleted: "已刪除遊戲",
  saveChanges: "儲存修改",
} as const;

export const dashboardTerms = {
  discEdition: "光碟版",
  digitalEdition: "下載版",
  wishlist: "願望清單",
  totalPlayTime: "累積遊玩",
} as const;

export const statusTerms: Record<GameStatus, string> = {
  owned: "已擁有",
  wishlist: "願望清單",
  waiting_sale: "等待特價",
  playing: "遊玩中",
  finished: "已完成",
  paused: "暫停",
  borrowed: "借入",
  rented: "借出",
  sold: "已售出",
};

export const ownershipTerms: Record<OwnershipType, string> = {
  disc: "光碟",
  digital: "數位",
  borrowed: "借入",
  rented: "借出",
  ps_plus: "PS Plus",
  sold: "已售出",
};

export const filterTerms: Record<LibraryFilter, string> = {
  all: "全部",
  collection: "收藏",
  disc: "光碟版",
  digital: "下載版",
  owned: "已擁有",
  wishlist: "願望清單",
  waiting_sale: "等待特價",
  borrowed: "借入",
  rented: "借出",
  sold: "已售出",
};
