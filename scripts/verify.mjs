import { spawnSync } from "node:child_process";

for (const args of [["run", "lint"], ["test"], ["run", "build"]]) {
  const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", args, { stdio: "inherit", env: process.env });
  if (result.error || result.status !== 0) process.exit(result.status ?? 1);
}
