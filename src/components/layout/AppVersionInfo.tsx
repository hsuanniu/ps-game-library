import { appInfo } from "@/lib/appInfo";

export function AppVersionInfo() {
  return (
    <p className="mt-8 text-center text-[0.68rem] font-medium text-slate-600">
      My Games {appInfo.version} · 最後更新 {appInfo.lastUpdated}
    </p>
  );
}
