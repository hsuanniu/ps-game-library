import { appInfo } from "@/lib/appInfo";

export function AppVersionInfo() {
  return (
    <p className="mt-5 text-center text-[0.68rem] font-medium text-slate-600">
      {appInfo.version} · Updated {appInfo.lastUpdated}
    </p>
  );
}
