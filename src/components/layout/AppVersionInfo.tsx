import { appInfo } from "@/lib/appInfo";

export function AppVersionInfo() {
  return (
    <div className="mt-8 text-center text-[0.68rem] font-medium leading-5 text-slate-600">
      <p>My Games {appInfo.version}</p>
      <p>Updated: {appInfo.lastUpdated}</p>
    </div>
  );
}
