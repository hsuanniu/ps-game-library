import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const game = (id, extra = {}) => ({ id, title: id, platform: "PS5", status: "owned", ownershipType: "disc", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", ...extra });
const primary = "ps-game-library:v1";
const metadataKey = "ps-game-library:sync-metadata:v1";
function storageFixture(items, refusePrimary = false) {
  const values = new Map([[primary, JSON.stringify(items)]]);
  let writes = 0;
  global.window = { localStorage: {
    get length() { return values.size; },
    key: (index) => Array.from(values.keys())[index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { if (key === primary && refusePrimary) throw new Error("QuotaExceeded"); writes++; values.set(key, value); },
  } };
  return { values, writes: () => writes, lib: loadTs("src/lib/storage/gameRecoveryStorage.ts") };
}

test("device restoration is additive, keeps latest fields and stages pending sync", async () => {
  const h = storageFixture([game("existing", { notes: "latest" })]);
  try {
    h.values.set(metadataKey, JSON.stringify({ baseRevision: 5, dirty: false, fingerprint: "old" }));
    const result = await h.lib.restoreMissingDeviceGames({ games: [game("existing", { notes: "outdated" }), game("missing", { futureData: "retained" })] });
    assert.equal(result.restored, 1);
    const restored = JSON.parse(h.values.get(primary));
    assert.equal(restored[0].notes, "latest"); assert.equal(restored[1].futureData, "retained");
    const marker = JSON.parse(h.values.get(metadataKey));
    assert.equal(marker.dirty, true); assert.equal(marker.baseRevision, 5);
    const recoveryKey = [...h.values.keys()].find((key) => key.startsWith("ps-game-library:recovery:v1:"));
    assert.equal(JSON.parse(h.values.get(recoveryKey)).games[0].notes, "latest");
    const before = h.writes();
    assert.equal((await h.lib.restoreMissingDeviceGames({ games: restored })).restored, 0);
    assert.equal(h.writes(), before);
  } finally { delete global.window; }
});

test("a refused primary write preserves original games and can never mark restoration synced", async () => {
  const original = [game("existing")];
  const h = storageFixture(original, true);
  try {
    await assert.rejects(h.lib.restoreMissingDeviceGames({ games: [game("missing")] }), /空間不足/);
    assert.deepEqual(JSON.parse(h.values.get(primary)), original);
    assert.equal(JSON.parse(h.values.get(metadataKey)).dirty, true);
  } finally { delete global.window; }
});

test("corrupt recovery entries remain stored and cannot hide readable copies", () => {
  const h = storageFixture([]);
  try {
    h.values.set("ps-game-library:recovery:v1:broken", "not-json");
    h.values.set("ps-game-library:recovery:v1:valid", JSON.stringify({ games: [game("recovered")], savedAt: "2026-01-02T00:00:00Z" }));
    h.values.set("ps-game-library:recovery:v1:empty", JSON.stringify({ games: [] }));
    const listed = h.lib.listRecoveryBackups();
    assert.equal(listed.length, 1); assert.equal(listed[0].backup.games[0].id, "recovered");
    assert.equal(h.values.get("ps-game-library:recovery:v1:broken"), "not-json");
  } finally { delete global.window; }
});
