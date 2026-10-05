import { Cloud } from "lucide-react";
import Link from "next/link";
import { appInfo } from "@/lib/appInfo";

export function AppVersionInfo() {
  return (
    <div className="mt-5 flex flex-col items-center gap-2 text-center">
      <Link
        href="/sync"
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-slate-500 transition duration-200 hover:bg-white/[0.05] hover:text-slate-300 active:scale-[0.98]"
      >
        <Cloud size={14} />
        雲端資料設定
      </Link>
      <p className="text-[0.68rem] font-medium text-slate-600">
        {appInfo.version} · Updated {appInfo.lastUpdated}
      </p>
    </div>
  );
}
