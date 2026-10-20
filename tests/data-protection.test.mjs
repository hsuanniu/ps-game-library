import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const { preserveLegacyDraft, completionForForm, normalizeVisibleStatus, normalizeVisibleOwnershipType } = loadTs("src/lib/gameDraft.ts");
const original = { id: "fixture", title: "Fixture", platform: "PS5", status: "owned", ownershipType: "disc", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };
function draftFor(game) {
  return { title: game.title, platform: game.platform === "PS4_PS5" ? "PS5" : game.platform, status: normalizeVisibleStatus(game.status), ownershipType: normalizeVisibleOwnershipType(game.ownershipType), isCompleted: completionForForm(game), notes: "new note" };
}

test("editing notes preserves all hidden legacy statuses and unknown completion", () => {
  for (const status of ["playing", "finished", "paused", "waiting_sale"]) {
    const game = { ...original, status };
    const draft = preserveLegacyDraft(draftFor(game), game);
    assert.equal(draft.status, status); assert.equal(draft.isCompleted, undefined); assert.equal(draft.notes, "new note");
  }
  assert.equal(completionForForm({ ...original, status: "finished" }), true);
  assert.equal(completionForForm({ ...original, status: "finished", isCompleted: false }), false);
});

test("explicit status and completion changes still save normally", () => {
  const game = { ...original, status: "playing" };
  const changed = preserveLegacyDraft({ ...draftFor(game), status: "wishlist", isCompleted: true }, game);
  assert.equal(changed.status, "wishlist"); assert.equal(changed.isCompleted, true);
  const finished = { ...original, status: "finished" };
  assert.equal(preserveLegacyDraft({ ...draftFor(finished), isCompleted: false }, finished).isCompleted, false);
});

test("unrelated edits preserve deprecated platform and ownership data", () => {
  for (const ownershipType of ["borrowed", "rented", "ps_plus", "sold"]) {
    const game = { ...original, platform: "PS4_PS5", ownershipType };
    const unchanged = preserveLegacyDraft(draftFor(game), game);
    assert.equal(unchanged.platform, "PS4_PS5"); assert.equal(unchanged.ownershipType, ownershipType);
    assert.equal(preserveLegacyDraft({ ...draftFor(game), ownershipType: "disc", platform: "PS4" }, game).ownershipType, "disc");
  }
});

test("loan person is cleared only when the saved status is no longer a loan", () => {
  const game = { ...original, status: "borrowed", loanPerson: "Fixture Person" };
  assert.equal(preserveLegacyDraft({ ...draftFor(game), loanPerson: game.loanPerson }, game).loanPerson, game.loanPerson);
  assert.equal(preserveLegacyDraft({ ...draftFor(game), status: "owned", loanPerson: game.loanPerson }, game).loanPerson, undefined);
});

test("quota failures preserve readable local data and do not throw", () => {
  const values = new Map([["ps-game-library:v1", JSON.stringify([original])]]);
  global.window = { localStorage: { getItem: (key) => values.get(key) ?? null, setItem: () => { throw new Error("QuotaExceeded"); } } };
  try {
    const storage = loadTs("src/lib/storage/gameStorage.ts");
    assert.equal(storage.saveGames([{ ...original, notes: "changed" }]), false);
    assert.deepEqual(storage.loadGames(), [original]);
  } finally { delete global.window; }
});

test("a refused legacy cache cleanup never turns a readable library into empty data", () => {
  global.window = { localStorage: { getItem: () => JSON.stringify([original, { ...original, id: "seed-astro-bot" }]), setItem: () => { throw new Error("QuotaExceeded"); } } };
  try { assert.deepEqual(loadTs("src/lib/storage/gameStorage.ts").loadGames(), [original]); } finally { delete global.window; }
});

test("conflict recovery copies survive later rolling cache backups", () => {
  const values = new Map([["ps-game-library:v1", JSON.stringify([original])]]);
  global.window = { localStorage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) } };
  try {
    const storage = loadTs("src/lib/storage/gameStorage.ts");
    const pending = { ...original, notes: "unsynced" };
    const marker = { baseRevision: 1, dirty: true, fingerprint: "fixture-hash" };
    assert.equal(storage.saveGameRecovery([pending], marker), true);
    const copy = values.get("ps-game-library:recovery:v1:fixture-hash");
    storage.saveGames([{ ...original, notes: "cloud" }]);
    storage.saveGames([{ ...original, notes: "later edit" }]);
    storage.saveGameRecovery([], marker);
    assert.equal(values.get("ps-game-library:recovery:v1:fixture-hash"), copy);
    assert.equal(JSON.parse(copy).games[0].notes, "unsynced");
  } finally { delete global.window; }
});

function repositoryHarness({ invalid = false, transactionError } = {}) {
  const calls = [];
  const query = (strings, ...values) => ({ text: strings.join("?"), values });
  const sql = async () => [];
  sql.transaction = async (build, options) => {
    const queries = build(query); calls.push({ queries, options });
    if (transactionError) throw transactionError;
    return [[{ data: invalid ? { id: "broken" } : original }], [{ initialized: true, revision: 1, updated_at: null }]];
  };
  process.env.DATABASE_URL = "postgresql://fixture.invalid/test";
  const repo = loadTs("src/lib/server/gameRepository.ts", { "@neondatabase/serverless": { neon: () => sql } });
  return { repo, calls };
}

test("cloud snapshot and revision are read together in a read-only repeatable-read transaction", async () => {
  const h = repositoryHarness(); const snapshot = await h.repo.getStoredGames();
  assert.equal(snapshot.games[0].id, original.id); assert.equal(snapshot.revision, 1);
  assert.deepEqual(h.calls[0].options, { isolationLevel: "RepeatableRead", readOnly: true });
  assert.equal(h.calls[0].queries.length, 2);
  assert.match(h.calls[0].queries[0].text, /SELECT data/); assert.match(h.calls[0].queries[1].text, /SELECT initialized, revision/);
});

test("invalid stored rows block the snapshot instead of being silently dropped", async () => {
  const h = repositoryHarness({ invalid: true });
  await assert.rejects(h.repo.getStoredGames(), /incomplete snapshot/);
});

test("duplicate IDs are rejected before any replacement transaction", async () => {
  const h = repositoryHarness();
  await assert.rejects(h.repo.replaceStoredGames([original, original], 1), /Invalid game data/);
  assert.equal(h.calls.length, 0);
});

test("database serialization conflicts are exposed as safe sync conflicts", async () => {
  const h = repositoryHarness({ transactionError: { code: "40001" } });
  await assert.rejects(h.repo.replaceStoredGames([original], 1), h.repo.GameSyncConflictError);
});
