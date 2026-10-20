import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";
import { digest, validateDatabaseBackup, verifyBackupRestore, verifyApiMatchesBackup } from "../scripts/lib/database-backup.mjs";

const backupLib = loadTs("src/lib/gameBackup.ts");
const game = (id, extra = {}) => ({ id, title: id, platform: "PS5", status: "owned", ownershipType: "disc", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", ...extra });

test("portable backups preserve every field, legacy statuses and timestamps", () => {
  const original = game("one", { platform: "PS4_PS5", status: "finished", customFutureField: { retained: true }, coverUrl: "data:image/png;base64,fixture" });
  const exported = backupLib.createGameBackup([original], "cloud", 10);
  assert.deepEqual(backupLib.parseGameBackup(JSON.stringify(exported)).games, [original]);
  assert.deepEqual(backupLib.parseGameBackup(JSON.stringify([original])).games, [original]);
  assert.deepEqual(backupLib.parseGameBackup(JSON.stringify({ format: "my-games-database-backup", version: 1, rows: { games: [{ data: original }] } })).games, [original]);
});

test("malformed, duplicate and oversized backup files are rejected without dropping rows", () => {
  for (const value of [null, {}, { games: [game("one"), game("one")] }, { games: [game("one", { isCompleted: "true" })] }, { games: [game("one", { createdAt: "invalid" })] }, { format: "other", games: [] }, { version: 2, games: [] }]) {
    assert.throws(() => backupLib.parseGameBackup(JSON.stringify(value)));
  }
  assert.throws(() => backupLib.parseGameBackup("x".repeat(8_000_001)), /8 MB/);
});

test("deeply nested backup extras cannot crash recursive comparisons", () => {
  let nested = { retained: true };
  for (let index = 0; index < 80; index++) nested = { child: nested };
  assert.throws(() => backupLib.parseGameBackup(JSON.stringify([game("one", { nested })])), /結構過於複雜/);
});

test("preview identifies missing, changed and cloud-only records without mutating either input", () => {
  const current = [game("same"), game("changed", { notes: "latest" }), game("cloud-only")];
  const backup = [game("same"), game("changed", { notes: "old" }), game("missing")];
  const before = JSON.stringify([current, backup]);
  const preview = backupLib.compareGameBackup(current, backup);
  assert.deepEqual(preview.missing.map((item) => item.id), ["missing"]);
  assert.equal(preview.changed.length, 1); assert.equal(preview.unchanged, 1); assert.equal(preview.onlyCurrent, 1);
  const merged = backupLib.mergeMissingBackupGames(current, backup);
  assert.equal(merged.length, 4); assert.equal(merged[1].notes, "latest"); assert.equal(merged[2].id, "cloud-only");
  assert.equal(JSON.stringify([current, backup]), before);
});

test("cloud restoration adds missing IDs only and refuses stale previews", async () => {
  const preview = { initialized: true, revision: 10, updatedAt: null, games: [game("existing", { notes: "latest" })] };
  const backup = backupLib.createGameBackup([game("existing", { notes: "old" }), game("missing")], "file");
  let writes = 0;
  const result = await backupLib.restoreMissingCloudGames(backup, preview, {
    loadCloud: async () => preview,
    saveCloud: async (items, revision) => { writes++; assert.equal(revision, 10); assert.equal(items[0].notes, "latest"); return { ok: true, revision: 11, updatedAt: "2026-01-02T00:00:00Z" }; },
  });
  assert.equal(result.restored, 1); assert.equal(writes, 1);
  await assert.rejects(backupLib.restoreMissingCloudGames(backup, preview, { loadCloud: async () => ({ ...preview, revision: 11 }), saveCloud: async () => { writes++; } }), /sync_conflict/);
  assert.equal(writes, 1);
});

test("empty or already-present backups never write or delete a game", async () => {
  const preview = { initialized: true, revision: 1, updatedAt: null, games: [game("one")] };
  for (const items of [[], [game("one", { notes: "old" })]]) {
    const result = await backupLib.restoreMissingCloudGames(backupLib.createGameBackup(items, "file"), preview, {
      loadCloud: async () => preview, saveCloud: async () => assert.fail("No write expected"),
    });
    assert.equal(result.restored, 0); assert.deepEqual(result.snapshot.games, preview.games);
  }
});

test("database backup checksums detect any changed data before verification", () => {
  const content = { format: "my-games-database-backup", version: 1, rows: { games: [{ id: "one", data: game("one") }], state: [] } };
  const backup = { ...content, checksum: digest(content) };
  assert.equal(validateDatabaseBackup(backup), backup);
  assert.throws(() => validateDatabaseBackup({ ...backup, rows: { ...backup.rows, games: [] } }), /checksum/);
});

test("browser imports verify the database backup checksum before allowing a preview", async () => {
  const content = { format: "my-games-database-backup", version: 1, rows: { games: [{ id: "one", data: game("one") }], state: [] } };
  const valid = { ...content, checksum: digest(content) };
  assert.equal((await backupLib.parseGameBackupFile(JSON.stringify(valid))).games.length, 1);
  await assert.rejects(backupLib.parseGameBackupFile(JSON.stringify({ ...valid, checksum: "wrong" })), /完整性/);
});

test("restore drill writes only transaction-local temporary tables", async () => {
  const content = { format: "my-games-database-backup", version: 1, rows: { games: [], state: [] } };
  const sql = { transaction: async (build) => {
    const queries = build((parts, ...values) => ({ text: parts.join("?"), values }));
    assert.equal(queries.length, 6);
    for (const query of queries) {
      assert.doesNotMatch(query.text, /(?:INSERT INTO|UPDATE|DELETE FROM)\s+public\./i);
    }
    assert.match(queries[0].text, /TEMP TABLE/); assert.match(queries[0].text, /ON COMMIT DROP/);
    return [[], [], [], [], [], []];
  } };
  const result = await verifyBackupRestore(sql, { ...content, checksum: digest(content) });
  assert.equal(result.verified, true);
});

test("backup source verification pages IDs and rejects repeated or excess results", async () => {
  const nativeFetch = global.fetch;
  const source = { rows: { games: [{ id: "one" }, { id: "two" }] } };
  const offsets = [];
  try {
    global.fetch = async (url, init) => {
      assert.equal(init.headers.Authorization, "Bearer fixture-token");
      offsets.push(url.searchParams.get("offset"));
      const second = url.searchParams.get("offset") === "1";
      return Response.json({ games: [{ id: second ? "two" : "one" }], total: 2, hasMore: !second });
    };
    assert.deepEqual(await verifyApiMatchesBackup("https://fixture.invalid", "fixture-token", source), { total: 2, apiMatchesDatabase: true });
    assert.deepEqual(offsets, ["0", "1"]);
    global.fetch = async () => Response.json({ games: [{ id: "one" }], total: 2, hasMore: true });
    await assert.rejects(verifyApiMatchesBackup("https://fixture.invalid", "fixture-token", source), /pagination_mismatch/);
  } finally { global.fetch = nativeFetch; }
});
