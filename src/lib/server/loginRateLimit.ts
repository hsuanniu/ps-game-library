import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { getSqlClient } from "@/lib/server/gameRepository";

let schemaPromise: Promise<unknown> | undefined;
const MAX_ATTEMPTS = 10;

export function loginBucket(request: Request, secret: string) {
  // Only Vercel's overwritten client-IP header is trusted in production.
  const raw = process.env.VERCEL === "1" ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0].trim() : undefined;
  const address = raw && isIP(raw) ? raw : "unknown-client";
  return createHmac("sha256", secret).update(`login-rate:v1:${address}`).digest("hex");
}

export async function consumeLoginAttempt(request: Request, secret: string) {
  const sql = getSqlClient();
  schemaPromise ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS my_games_login_attempts (
      bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at TIMESTAMPTZ NOT NULL
    )`;
    await sql`CREATE INDEX IF NOT EXISTS my_games_login_attempts_reset_idx ON my_games_login_attempts (reset_at)`;
    await sql`DELETE FROM my_games_login_attempts WHERE reset_at < NOW() - INTERVAL '1 day'`;
  })().catch((error) => { schemaPromise = undefined; throw error; });
  await schemaPromise;
  const bucket = loginBucket(request, secret);
  const rows = await sql`
    INSERT INTO my_games_login_attempts (bucket, attempts, reset_at)
    VALUES (${bucket}, 1, NOW() + INTERVAL '15 minutes')
    ON CONFLICT (bucket) DO UPDATE SET
      attempts = CASE WHEN my_games_login_attempts.reset_at <= NOW() THEN 1 ELSE my_games_login_attempts.attempts + 1 END,
      reset_at = CASE WHEN my_games_login_attempts.reset_at <= NOW() THEN NOW() + INTERVAL '15 minutes' ELSE my_games_login_attempts.reset_at END
    WHERE my_games_login_attempts.attempts < ${MAX_ATTEMPTS} OR my_games_login_attempts.reset_at <= NOW()
    RETURNING attempts
  `;
  return rows.length > 0;
}
