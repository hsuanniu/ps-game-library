import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { captureBackup, validateDatabaseBackup, verifyApiMatchesBackup, verifyBackupRestore } from "./lib/database-backup.mjs";

try {
  const args = Object.fromEntries(process.argv.slice(2).map((item) => {
    const at = item.indexOf("=");
    return at < 0 ? [item, true] : [item.slice(0, at), item.slice(at + 1)];
  }));
  if (args["--confirm-project"] !== "ps-game-library") throw new Error("confirm_project_required");
  process.loadEnvFile(args["--env-file"] ?? ".env.local");
  if (!process.env.DATABASE_URL || !process.env.NEON_PROJECT_ID || !process.env.GAMES_API_TOKEN) throw new Error("missing_backup_environment");
  const sql = neon(process.env.DATABASE_URL);
  const output = path.resolve(args["--output-dir"] ?? path.join(os.homedir(), "Documents/Codex/private-backups/ps-game-library"));
  if (output === process.cwd() || output.startsWith(`${process.cwd()}${path.sep}`)) throw new Error("backup_must_be_outside_repository");
  const backup = await captureBackup(sql, process.env.NEON_PROJECT_ID);
  const api = await verifyApiMatchesBackup("https://ps-game-library.vercel.app", process.env.GAMES_API_TOKEN, backup);
  await fs.mkdir(output, { recursive: true, mode: 0o700 });
  const actualOutput = await fs.realpath(output);
  const actualRepository = await fs.realpath(process.cwd());
  if (actualOutput === actualRepository || actualOutput.startsWith(`${actualRepository}${path.sep}`)) throw new Error("backup_must_be_outside_repository");
  if (((await fs.stat(actualOutput)).mode & 0o077) !== 0) throw new Error("backup_directory_not_private");
  const filename = path.join(output, `games-${backup.createdAt.replaceAll(":", "-")}.json`);
  await fs.writeFile(filename, JSON.stringify(backup, null, 2), { mode: 0o600, flag: "wx" });
  const saved = validateDatabaseBackup(JSON.parse(await fs.readFile(filename, "utf8")));
  const restoration = args["--verify-restore"] ? await verifyBackupRestore(sql, saved) : { verified: false };
  console.log(JSON.stringify({ file: filename, games: saved.rows.games.length, revision: saved.rows.state[0].revision, checksum: saved.checksum, ...api, restoration }, null, 2));
} catch (error) {
  const safeCodes = ["confirm_project_required", "missing_backup_environment", "backup_must_be_outside_repository", "backup_directory_not_private", "invalid_backup", "backup_checksum_mismatch", "duplicate_backup_ids", "restored_data_mismatch", "cloud_not_initialized", "api_database_mismatch", "api_pagination_mismatch", "api_pagination_stalled", "invalid_api_page"];
  const code = safeCodes.includes(error.message) || /^api_verification_http_\d+$/.test(error.message) ? error.message : error.code ?? error.name;
  console.error(JSON.stringify({ error: code, message: "Backup or verification failed; no public game data was changed." }));
  process.exitCode = 1;
}
