import test, { after } from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const originalEnv = { admin: process.env.GAMES_ADMIN_TOKEN, vercel: process.env.VERCEL };
process.env.GAMES_ADMIN_TOKEN = "fixture-only-admin-token";
after(() => {
  for (const [name, value] of [["GAMES_ADMIN_TOKEN", originalEnv.admin], ["VERCEL", originalEnv.vercel]]) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
});
const { readJsonBody, RequestBodyTooLargeError } = loadTs("src/lib/server/requestBody.ts");

test("actual streamed body size is enforced even without a truthful Content-Length", async () => {
  for (const headers of [{}, { "content-length": "1" }]) {
    const request = new Request("https://example.test", { method: "POST", headers, body: JSON.stringify({ value: "漢".repeat(100) }) });
    await assert.rejects(readJsonBody(request, 100), RequestBodyTooLargeError);
  }
  const small = new Request("https://example.test", { method: "POST", body: '{"ok":true}' });
  assert.deepEqual(await readJsonBody(small, 100), { ok: true });
});

test("login rate limit is shared between cold starts and never stores raw IPs", async () => {
  process.env.VERCEL = "1";
  const attempts = new Map(); const inserts = [];
  const sql = async (strings, ...values) => {
    const text = strings.join("?");
    if (!text.includes("INSERT INTO")) return [];
    inserts.push({ text, values }); const bucket = values[0];
    const count = attempts.get(bucket) || 0;
    if (count >= 10) return [];
    attempts.set(bucket, count + 1); return [{ attempts: count + 1 }];
  };
  const overrides = { "@/lib/server/gameRepository": { getSqlClient: () => sql } };
  const first = loadTs("src/lib/server/loginRateLimit.ts", overrides);
  const second = loadTs("src/lib/server/loginRateLimit.ts", overrides);
  const request = new Request("https://example.test", { headers: { "x-vercel-forwarded-for": "192.0.2.10" } });
  for (let i = 0; i < 10; i++) assert.equal(await (i % 2 ? first : second).consumeLoginAttempt(request, "fixture-secret"), true);
  assert.equal(await second.consumeLoginAttempt(request, "fixture-secret"), false);
  assert.match(inserts[0].values[0], /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(inserts), /192\.0\.2\.10|fixture-secret/);
  assert.match(inserts[0].text, /ON CONFLICT/); assert.match(inserts[0].text, /reset_at <= NOW/);
});

test("untrusted forwarded headers cannot create unlimited local login buckets", () => {
  delete process.env.VERCEL;
  const { loginBucket } = loadTs("src/lib/server/loginRateLimit.ts");
  const a = new Request("https://example.test", { headers: { "x-forwarded-for": "192.0.2.1", "x-vercel-forwarded-for": "192.0.2.1" } });
  const b = new Request("https://example.test", { headers: { "x-vercel-forwarded-for": "192.0.2.2" } });
  assert.equal(loginBucket(a, "test"), loginBucket(b, "test"));
});

function sessionHarness(consume) {
  return loadTs("src/app/api/internal/session/route.ts", {
    "@/lib/server/loginRateLimit": { consumeLoginAttempt: consume },
    "@/lib/server/gameRepository": { isGameDatabaseConfigured: () => true },
  });
}
const login = (body, origin = "https://example.test") => new Request("https://example.test/api/internal/session", {
  method: "POST", headers: { origin, "content-type": "application/json" }, body,
});

test("login rejects brute force before checking even a correct token", async () => {
  const route = sessionHarness(async () => false);
  const response = await route.POST(login(JSON.stringify({ token: process.env.GAMES_ADMIN_TOKEN })));
  assert.equal(response.status, 429); assert.equal(response.headers.get("retry-after"), "900");
  assert.equal(response.headers.get("set-cookie"), null);
  assert.doesNotMatch(await response.text(), /fixture-only-admin-token/);
});

test("login fails closed when the shared guard is unavailable", async () => {
  const route = sessionHarness(async () => { throw new Error("private database details"); });
  const response = await route.POST(login(JSON.stringify({ token: process.env.GAMES_ADMIN_TOKEN })));
  assert.equal(response.status, 503); assert.equal(response.headers.get("set-cookie"), null);
  assert.doesNotMatch(await response.text(), /private database|fixture-only/);
});

test("existing correct login still works and invalid origins/bodies never set cookies", async () => {
  const route = sessionHarness(async () => true);
  const valid = await route.POST(login(JSON.stringify({ token: process.env.GAMES_ADMIN_TOKEN })));
  assert.equal(valid.status, 200); assert.match(valid.headers.get("set-cookie"), /HttpOnly/);
  assert.match(valid.headers.get("set-cookie"), /SameSite=strict/);
  assert.equal((await route.POST(login('null'))).status, 400);
  assert.equal((await route.POST(login('[]'))).status, 400);
  assert.equal((await route.POST(login('{"token":"wrong"}'))).status, 401);
  assert.equal((await route.POST(login('{}', "https://attacker.example"))).status, 403);
  assert.equal((await route.POST(login(JSON.stringify({ token: "x".repeat(5000) })))).status, 413);
});

test("malformed cookies do not crash authentication", () => {
  const { hasValidAdminSession } = loadTs("src/lib/server/apiAuth.ts");
  assert.equal(hasValidAdminSession(new Request("https://example.test", { headers: { cookie: "my-games-admin-session=%ZZ" } })), false);
});

test("internal writes enforce actual byte limits and reject invalid JSON shapes", async () => {
  let writes = 0;
  const route = loadTs("src/app/api/internal/games/route.ts", {
    "@/lib/server/apiAuth": { hasValidAdminSession: () => true, isAdminAuthConfigured: () => true, isSameOriginRequest: () => true },
    "@/lib/server/gameRepository": { replaceStoredGames: async () => { writes++; return {}; }, GameSyncConflictError: class extends Error {}, EmptyLibraryInitializationError: class extends Error {}, DatabaseNotConfiguredError: class extends Error {} },
  });
  const put = (body) => new Request("https://example.test/api/internal/games", { method: "PUT", body });
  assert.equal((await route.PUT(put('null'))).status, 400);
  assert.equal((await route.PUT(put(JSON.stringify({ games: [], expectedRevision: Number.MAX_SAFE_INTEGER + 1 })))).status, 400);
  assert.equal((await route.PUT(put('"' + "x".repeat(4_000_001) + '"'))).status, 413);
  assert.equal(writes, 0);
});

test("cloud acknowledgements and payload budgets are verified on the client", async () => {
  const originalFetch = global.fetch;
  const storage = loadTs("src/lib/storage/gameCloudStorage.ts");
  try {
    global.fetch = async () => Response.json({});
    await assert.rejects(storage.saveCloudGames([], 1), /invalid_cloud_acknowledgement/);
    await assert.rejects(storage.loadCloudGames(), /invalid_cloud_snapshot/);
    global.fetch = async () => assert.fail("Oversized library must not be sent");
    await assert.rejects(storage.saveCloudGames([{ coverUrl: "x".repeat(4_000_001) }], 1), /payload_too_large/);
  } finally { global.fetch = originalFetch; }
});
