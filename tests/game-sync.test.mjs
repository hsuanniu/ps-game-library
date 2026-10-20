import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const { CloudStorageError } = loadTs("src/lib/storage/gameCloudStorage.ts");
const { GameSync, libraryFingerprint } = loadTs("src/lib/storage/gameSync.ts", { "@/lib/storage/gameCloudStorage": { CloudStorageError } });
const game = (id, extra = {}) => ({ id, title: id, platform: "PS5", status: "owned", ownershipType: "disc", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", ...extra });
function harness(games = [game("one")]) {
  let cloud = { games, revision: 1, initialized: true, updatedAt: null };
  let local; let metadata; let recovery; let loadError; let saveError; let cacheOk = true; let recoveryOk = true; let writes = 0;
  const store = new GameSync({
    loadCloud: async () => { if (loadError) throw loadError; return structuredClone(cloud); },
    saveCloud: async (next, revision) => {
      writes++;
      if (saveError) throw saveError;
      if (revision !== cloud.revision) throw new CloudStorageError("sync_conflict", 409);
      cloud = { ...cloud, games: structuredClone(next), revision: revision + 1 };
      return { ok: true, revision: cloud.revision, updatedAt: "2026-01-02T00:00:00Z" };
    },
    saveLocal: (next, marker) => { if (!cacheOk) return false; local = structuredClone(next); metadata = structuredClone(marker); return true; },
    saveRecovery: (items) => { if (!recoveryOk) return false; recovery = structuredClone(items); return true; },
  });
  return { store, cloud: () => cloud, local: () => local, metadata: () => metadata, writes: () => writes,
    recovery: () => recovery, allowRecovery: (ok) => { recoveryOk = ok; },
    setCloud: (value) => { cloud = value; }, failLoad: (error) => { loadError = error; }, failSave: (error) => { saveError = error; }, cache: (ok) => { cacheOk = ok; } };
}

test("reports success only after the cloud acknowledges a queued mutation", async () => {
  const h = harness(); await h.store.initialize([], null);
  const result = await h.store.mutate((items) => [...items, game("two")]);
  assert.equal(result.synced, true); assert.equal(h.cloud().games.length, 2);
  assert.equal(h.metadata().dirty, false); assert.equal(h.metadata().baseRevision, 2);
});

test("network failure keeps a durable pending change and retry updates cloud", async () => {
  const h = harness(); await h.store.initialize([], null); h.failLoad(new TypeError("offline"));
  const result = await h.store.mutate((items) => [...items, game("two")]);
  assert.equal(result.synced, false); assert.equal(h.local().length, 2); assert.equal(h.metadata().dirty, true);
  assert.equal(h.cloud().games.length, 1); h.failLoad(null);
  assert.equal((await h.store.retry()).synced, true); assert.equal(h.cloud().games.length, 2);
});

test("pending changes survive a reload without being replaced by cloud", async () => {
  const h = harness(); await h.store.initialize([], null); h.failLoad(new TypeError("offline"));
  await h.store.mutate((items) => [...items, game("two")]);
  const pending = h.local(), marker = h.metadata();
  const reloaded = harness(); await reloaded.store.initialize(pending, marker);
  assert.equal(reloaded.store.games.length, 2); assert.equal(reloaded.writes(), 0);
  assert.equal((await reloaded.store.retry()).synced, true);
});

test("another device's revision blocks retry without overwriting either library", async () => {
  const h = harness(); await h.store.initialize([], null);
  h.setCloud({ ...h.cloud(), revision: 2, games: [game("one"), game("other-device")] });
  const result = await h.store.mutate((items) => [...items, game("local")]);
  assert.equal(result.issue, "conflict"); assert.equal(result.synced, false); assert.equal(h.writes(), 0);
  assert.equal(h.local()[1].id, "local"); assert.equal(h.cloud().games[1].id, "other-device");
  assert.equal((await h.store.retry()).issue, "conflict"); assert.equal(h.writes(), 0);
});

test("a committed but unacknowledged save is recognized without duplicate writes", async () => {
  const h = harness(); await h.store.initialize([], null); h.failSave(new TypeError("timeout"));
  await h.store.mutate((items) => [...items, game("two")]);
  h.setCloud({ ...h.cloud(), revision: 2, games: h.local() }); h.failSave(null);
  assert.equal((await h.store.retry()).synced, true); assert.equal(h.writes(), 1); assert.equal(h.store.revision, 2);
});

test("an expired login is not reported as a successful cloud save", async () => {
  const h = harness(); await h.store.initialize([], null); h.failLoad(new CloudStorageError("admin_session_required", 401));
  const result = await h.store.mutate((items) => [...items, game("two")]);
  assert.equal(result.synced, false); assert.equal(result.issue, "auth"); assert.equal(h.metadata().dirty, true);
});

test("local quota failure does not block cloud saving, but both failures reject", async () => {
  const h = harness(); await h.store.initialize([], null); h.cache(false);
  const result = await h.store.mutate((items) => [...items, game("two")]);
  assert.equal(result.synced, true); assert.equal(result.issue, "cache"); assert.equal(h.cloud().games.length, 2);
  h.failLoad(new TypeError("offline"));
  await assert.rejects(h.store.mutate((items) => [...items, game("three")]), /unsaved_local_and_cloud/);
  assert.equal(h.store.games.length, 2);
});

test("legacy unmarked or partially written local changes are never silently overwritten", async () => {
  for (const marker of [null, { baseRevision: 1, dirty: false, fingerprint: "previous-value" }]) {
    const h = harness(); await h.store.initialize([game("local")], marker);
    assert.equal(h.store.games[0].id, "local"); assert.equal(h.writes(), 0); assert.equal(h.store.dirty, true);
  }
});

test("uninitialized cloud cannot be seeded by automatic saves, including empty data", async () => {
  const h = harness([]); h.setCloud({ ...h.cloud(), initialized: false });
  await h.store.initialize([], null);
  const result = await h.store.mutate(() => [game("local")]);
  assert.equal(result.synced, false); assert.equal(result.issue, "setup"); assert.equal(h.writes(), 0);
});

test("intentional delete-all remains pending and can be safely retried", async () => {
  const h = harness(); await h.store.initialize([], null); h.failLoad(new TypeError("offline"));
  await h.store.mutate(() => []); assert.equal(h.metadata().dirty, true);
  const reloaded = harness(); await reloaded.store.initialize([], h.metadata());
  assert.equal(reloaded.store.games.length, 0); assert.equal(reloaded.store.dirty, true);
  assert.equal((await reloaded.store.retry()).synced, true); assert.equal(reloaded.cloud().games.length, 0);
});

test("queued mutations keep createdAt and cannot lose an earlier edit", async () => {
  const h = harness(); await h.store.initialize([], null);
  await Promise.all([h.store.mutate((items) => [...items, game("two")]), h.store.mutate((items) => [...items, game("three")])]);
  assert.deepEqual(h.cloud().games.map((item) => item.id), ["one", "two", "three"]);
  assert.equal(h.cloud().games[0].createdAt, "2026-01-01T00:00:00Z");
});

test("loading cloud after conflict requires a successful local backup", async () => {
  const h = harness(); await h.store.initialize([game("local")], null); h.cache(false);
  await assert.rejects(h.store.loadCloudWithBackup(), /local_backup_failed/);
  assert.equal(h.store.games[0].id, "local"); h.cache(true);
  await h.store.loadCloudWithBackup(); assert.equal(h.store.games[0].id, "one"); assert.equal(h.writes(), 0);
  assert.equal(h.recovery()[0].id, "local");
});

test("a failed immutable recovery copy blocks replacing local data with cloud", async () => {
  const h = harness(); await h.store.initialize([game("local")], null); h.allowRecovery(false);
  await assert.rejects(h.store.loadCloudWithBackup(), /local_backup_failed/);
  assert.equal(h.store.games[0].id, "local"); assert.equal(h.writes(), 0);
});

test("fingerprints ignore property and list ordering, not actual changed values", async () => {
  const a = game("a"), b = game("b");
  assert.equal(await libraryFingerprint([a, b]), await libraryFingerprint([{ ...b }, Object.fromEntries(Object.entries(a).reverse())]));
  assert.notEqual(await libraryFingerprint([a]), await libraryFingerprint([{ ...a, notes: "edited" }]));
});
