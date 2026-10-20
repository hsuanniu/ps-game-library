import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const { restoreCloudBackup } = loadTs("src/lib/storage/backupRecoveryService.ts");
const { libraryFingerprint } = loadTs("src/lib/storage/gameSync.ts");
const game = (id, extra = {}) => ({ id, title: id, platform: "PS5", status: "owned", ownershipType: "disc", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", ...extra });
const preview = { games: [game("existing", { notes: "latest" })], revision: 5, initialized: true, updatedAt: null };
const backup = { games: [game("existing", { notes: "old" }), game("missing")] };

function harness(local = preview.games) {
  const calls = [];
  let marker = null;
  const deps = {
    loadLocal: () => local, loadMetadata: () => marker,
    saveRecovery: () => { calls.push("recovery"); return true; },
    saveLocal: () => { calls.push("cache"); return true; },
    loadCloud: async () => { calls.push("read"); return preview; },
    saveCloud: async (items, revision) => { calls.push("write"); assert.equal(items[0].notes, "latest"); assert.equal(revision, 5); return { ok: true, revision: 6, updatedAt: "2026-01-02T00:00:00Z" }; },
  };
  return { calls, deps, marker: (value) => { marker = value; } };
}

test("cloud restore protects current data before writing and preserves unchanged records", async () => {
  const h = harness();
  const result = await restoreCloudBackup(backup, preview, h.deps);
  assert.equal(result.restored, 1); assert.equal(result.cached, true);
  assert.deepEqual(h.calls, ["recovery", "read", "write", "cache"]);
});

test("unverified or dirty device data blocks a cloud restoration without any write", async () => {
  for (const marker of [null, { baseRevision: 5, dirty: true, fingerprint: "pending" }]) {
    const h = harness([game("pending-local")]); h.marker(marker);
    await assert.rejects(restoreCloudBackup(backup, preview, h.deps), /尚未核對/);
    assert.deepEqual(h.calls, []);
  }
});

test("clean stale caches can be refreshed without overwriting cloud-only records", async () => {
  const local = [game("old-cache")], h = harness(local);
  h.marker({ baseRevision: 4, dirty: false, fingerprint: await libraryFingerprint(local) });
  const result = await restoreCloudBackup(backup, preview, h.deps);
  assert.deepEqual(result.snapshot.games.map((item) => item.id), ["existing", "missing"]);
});

test("failed recovery storage prevents cloud writes and cache failures remain explicit", async () => {
  const blocked = harness(); blocked.deps.saveRecovery = () => false;
  await assert.rejects(restoreCloudBackup(backup, preview, blocked.deps), /沒有執行補回/);
  assert.deepEqual(blocked.calls, []);
  const noCache = harness(); noCache.deps.saveLocal = () => false;
  const result = await restoreCloudBackup(backup, preview, noCache.deps);
  assert.equal(result.restored, 1); assert.equal(result.cached, false);
});
