"use client";

import { ArrowLeft, CheckCircle2, Cloud, KeyRound, LogOut, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppLogo } from "@/components/layout/AppLogo";
import { Button } from "@/components/ui/Button";
import {
  CloudStorageError,
  createCloudSession,
  deleteCloudSession,
  getCloudSessionStatus,
  loadCloudGames,
  saveCloudGames,
} from "@/lib/storage/gameCloudStorage";
import { loadGames } from "@/lib/storage/gameStorage";
import type { StoredGamesSnapshot } from "@/types/gameApi";

interface SessionStatus {
  authenticated: boolean;
  databaseConfigured: boolean;
  adminAuthConfigured: boolean;
}

export default function SyncPage() {
  const [session, setSession] = useState<SessionStatus>();
  const [snapshot, setSnapshot] = useState<StoredGamesSnapshot>();
  const [token, setToken] = useState("");
  const [localCount, setLocalCount] = useState(0);
  const [isBusy, setIsBusy] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void refreshStatus();
  }, []);

  async function refreshStatus() {
    setIsBusy(true);
    setMessage("");

    try {
      const nextSession = await getCloudSessionStatus();
      setLocalCount(loadGames().length);
      setSession(nextSession);

      if (nextSession.authenticated) {
        setSnapshot(await loadCloudGames());
      } else {
        setSnapshot(undefined);
      }
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    setMessage("");

    try {
      await createCloudSession(token);
      setToken("");
      await refreshStatus();
    } catch (error) {
      setMessage(getErrorMessage(error));
      setIsBusy(false);
    }
  }

  async function handleImport() {
    if (!snapshot) {
      return;
    }

    const localGames = loadGames();
    if (localGames.length === 0) {
      setMessage("這台裝置沒有可搬移的遊戲，因此不會初始化或覆蓋雲端資料。");
      return;
    }

    if (snapshot.initialized) {
      setMessage("雲端資料已初始化。為避免舊快取覆蓋正式收藏，本頁不提供再次匯入。");
      return;
    }

    setIsBusy(true);
    setMessage("");

    try {
      await saveCloudGames(localGames, snapshot.revision);
      setMessage(`已將這台裝置的 ${localGames.length} 款遊戲設為正式雲端資料。`);
      setSnapshot(await loadCloudGames());
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleLogout() {
    setIsBusy(true);
    setMessage("");

    try {
      await deleteCloudSession();
      await refreshStatus();
    } catch (error) {
      setMessage(getErrorMessage(error));
      setIsBusy(false);
    }
  }

  const configurationReady = session?.databaseConfigured && session.adminAuthConfigured;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[430px] px-4 py-5">
      <header className="mb-5 flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-[linear-gradient(90deg,rgba(16,39,58,0.65),rgba(8,17,26,0.85))] p-4">
        <AppLogo />
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-emerald-300">MY GAMES</p>
          <h1 className="mt-1 text-xl font-black text-white">雲端資料設定</h1>
        </div>
      </header>

      <section className="glass-panel rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-sky-400/10 text-sky-300">
            <Cloud size={20} />
          </div>
          <div>
            <h2 className="font-bold text-white">唯一資料來源</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              完成一次設定後，網站與唯讀 API 都會使用同一份雲端遊戲資料。
            </p>
          </div>
        </div>

        {!isBusy && session && !configurationReady ? (
          <div className="mt-4 rounded-lg border border-amber-300/15 bg-amber-300/[0.06] p-3 text-sm leading-6 text-amber-100">
            尚未完成伺服器環境設定。請先在 Vercel 加入 DATABASE_URL 與 GAMES_ADMIN_TOKEN，再重新部署。
          </div>
        ) : null}

        {!isBusy && configurationReady && !session?.authenticated ? (
          <form onSubmit={handleLogin} className="mt-5 grid gap-3">
            <label className="text-sm font-semibold text-slate-200" htmlFor="admin-token">
              管理密碼
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                id="admin-token"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                className="min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.05] pl-10 pr-3 text-sm text-white outline-none transition focus:border-emerald-300/70"
                placeholder="輸入 GAMES_ADMIN_TOKEN"
              />
            </div>
            <Button type="submit" disabled={!token.trim() || isBusy}>
              連線雲端資料庫
            </Button>
          </form>
        ) : null}

        {!isBusy && session?.authenticated && snapshot ? (
          <div className="mt-5 grid gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
              <CheckCircle2 size={17} />
              管理連線已建立
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Metric label="這台裝置" value={`${localCount} 款`} />
              <Metric label="雲端資料庫" value={`${snapshot.games.length} 款`} />
            </div>

            {!snapshot.initialized ? (
              <div className="mt-1 grid gap-2">
                {localCount > 0 ? (
                  <>
                    <p className="text-sm leading-6 text-slate-400">
                      雲端資料庫尚未初始化。請確認這是原本保存收藏的瀏覽器，再建立唯一正式資料來源。
                    </p>
                    <Button type="button" onClick={handleImport} disabled={isBusy}>
                      <Upload size={17} />
                      匯入 {localCount} 款遊戲
                    </Button>
                  </>
                ) : (
                  <p className="rounded-lg border border-amber-300/15 bg-amber-300/[0.06] p-3 text-sm leading-6 text-amber-100">
                    這個瀏覽器目前是空的。為保護收藏，系統不允許用空資料初始化雲端；請改用原本保存遊戲的同一個 iPhone 瀏覽器開啟此頁。
                  </p>
                )}
              </div>
            ) : (
              <div className="grid gap-2 text-sm leading-6 text-slate-400">
                <p>雲端資料已啟用。回到首頁後，新增、編輯與刪除會同步到正式資料庫。</p>
                <p className="text-slate-500">為避免舊快取覆蓋正式收藏，初始化完成後不提供再次匯入。</p>
              </div>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-white/[0.05] hover:text-slate-300"
            >
              <LogOut size={16} />
              登出管理連線
            </button>
          </div>
        ) : null}

        {isBusy ? <p className="mt-5 text-sm text-slate-500">正在檢查資料連線…</p> : null}
        {message ? <p className="mt-4 rounded-lg bg-white/[0.05] p-3 text-sm leading-6 text-slate-300">{message}</p> : null}
      </section>

      <Link
        href="/"
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
      >
        <ArrowLeft size={16} />
        回到我的遊戲
      </Link>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.04] p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function getErrorMessage(error: unknown) {
  if (!(error instanceof CloudStorageError)) {
    return "連線失敗，請稍後再試。";
  }

  if (error.code === "invalid_admin_token") {
    return "管理密碼不正確。";
  }

  if (error.code === "database_not_configured" || error.code === "admin_auth_not_configured") {
    return "伺服器環境變數尚未設定完成。";
  }

  if (error.code === "sync_conflict") {
    return "雲端資料剛被更新，請重新整理後再試。";
  }

  return `連線失敗（${error.code}）。`;
}
