import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test, after } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url);

// Compile the actual TS modules, injecting a read-only repository fixture at the API boundary.
function loadTs(relativePath, overrides = {}, cache = new Map()) {
  const filename = path.join(root, relativePath);
  if (cache.has(filename)) return cache.get(filename).exports;
  const loadedModule = { exports: {} };
  cache.set(filename, loadedModule);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const localRequire = (name) => {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (name.startsWith("@/")) return loadTs(`src/${name.slice(2)}.ts`, overrides, cache);
    return nativeRequire(name);
  };
  new Function("require", "module", "exports", compiled)(localRequire, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

const { filterGameApiRecords, toGameApiRecord } = loadTs("src/lib/api/gameApi.ts");
const {
  createGamesPage, readGamesListQuery, readGameApiFilters, GameApiQueryError,
  GameApiRecordTooLargeError, MAX_GAMES_RESPONSE_BYTES,
} = loadTs("src/lib/api/gameApiQuery.ts");
const fixture = Array.from({ length: 247 }, (_, i) => ({
  id: `game-${String(i).padStart(3, "0")}`,
  title: i % 2 === 0 ? `Resident Evil ${i}` : `Game ${i}`,
  displayTitle: `遊戲 ${i}`,
  platform: i < 200 ? "PS4" : "PS5",
  status: i >= 230 ? "wishlist" : i < 40 ? "playing" : "owned",
  ownershipType: i % 2 === 0 ? "disc" : "digital",
  genre: [i % 2 === 0 ? "RPG" : "Action"],
  seriesName: i % 2 === 0 ? "Resident Evil" : "Other",
  isCompleted: i >= 40 && i < 100,
  playTimeHours: i < 100 ? 12 : 0,
  notes: i === 1 ? "special note only" : "",
  coverUrl: "data:image/png;base64," + "a".repeat(200000),
  createdAt: "2026-10-08T00:00:00.000Z",
  updatedAt: "2026-10-08T00:00:00.000Z",
}));
const records = fixture.map(toGameApiRecord);
const params = (query = "") => new URLSearchParams(query);

test("247 games can be paged without duplicates, omissions, or oversized default responses", () => {
  let offset = 0;
  const ids = [];
  do {
    const page = createGamesPage(records, readGamesListQuery(params(`offset=${offset}`)));
    assert.equal(page.total, 247);
    assert.equal(page.count, 247);
    assert.equal(page.returned, page.games.length);
    assert.ok(page.games.length <= 20);
    assert.ok(Buffer.byteLength(JSON.stringify(page)) <= MAX_GAMES_RESPONSE_BYTES);
    assert.ok(page.games.every((game) => !("cover_url" in game) && !("notes" in game)));
    ids.push(...page.games.map((game) => game.id));
    if (!page.hasMore) {
      assert.equal(page.nextOffset, null);
      break;
    }
    assert.ok(page.nextOffset > offset);
    offset = page.nextOffset;
  } while (offset < 247);
  assert.deepEqual(ids, records.map((game) => game.id));
  assert.equal(new Set(ids).size, 247);
});

test("filtered totals precede pagination and all seven filters match the same records", () => {
  const cases = [
    ["platform=PS4&ownership_status=owned", 200],
    ["platform=PS5", 47],
    ["ownership_status=owned", 230],
    ["ownership_status=wishlist", 17],
    ["play_status=playing", 40],
    ["play_status=completed", 60],
    ["play_status=backlog", 130],
    ["genre=RPG", 124],
    ["series=Resident+Evil", 124],
    ["search=special+note", 1],
    ["status=wishlist", 17],
    ["platform=PS4&genre=RPG&series=Resident+Evil&status=owned&play_status=completed&ownership_status=owned&search=Resident", 30],
  ];
  for (const [query, expected] of cases) {
    const filtered = filterGameApiRecords(records, readGameApiFilters(params(query)));
    assert.equal(filtered.length, expected, query);
    const page = createGamesPage(filtered, readGamesListQuery(params(`${query}&limit=1`)));
    assert.equal(page.total, expected, query);
    assert.equal(page.returned, 1, query);
  }
});

test("empty libraries, final pages and offsets past the end have correct metadata", () => {
  for (const [items, query] of [[[], ""], [records, "offset=247"], [records, "offset=999"]]) {
    const page = createGamesPage(items, readGamesListQuery(params(query)));
    assert.equal(page.total, items.length);
    assert.deepEqual(page.games, []);
    assert.equal(page.hasMore, false);
    assert.equal(page.nextOffset, null);
  }
  const final = createGamesPage(records, readGamesListQuery(params("offset=240")));
  assert.equal(final.returned, 7);
  assert.equal(final.hasMore, false);
});

test("field projection does not change filtering or mutate stored games", () => {
  const query = readGamesListQuery(params("fields=id,title&search=special+note"));
  const filtered = filterGameApiRecords(records, query.filters);
  const page = createGamesPage(filtered, query);
  assert.deepEqual(Object.keys(page.games[0]), ["id", "title"]);
  assert.equal(page.total, 1);
  assert.ok(records[1].notes.includes("special note"));
  assert.deepEqual(readGamesListQuery(params("fields=id&fields=title,id")).fields, ["id", "title"]);
});

test("invalid pagination and field names are rejected instead of unbounded reads", () => {
  for (const query of [
    "limit=0", "limit=101", "limit=-1", "limit=1.5", "limit=abc", "limit=", "limit=1&limit=2",
    "offset=-1", "offset=1.5", "offset=", "offset=9007199254740992", "fields=", "fields=id,unknown",
  ]) {
    assert.throws(() => readGamesListQuery(params(query)), GameApiQueryError, query);
  }
});

test("response budget shortens pages with an exact continuation and never truncates fields", () => {
  const largeNotes = records.slice(0, 5).map((game) => ({ ...game, notes: "字".repeat(10000) }));
  const query = readGamesListQuery(params("fields=id,notes&limit=5"));
  const first = createGamesPage(largeNotes, query);
  assert.equal(first.returned, 2);
  assert.equal(first.hasMore, true);
  assert.equal(first.nextOffset, 2);
  assert.equal(first.games[0].notes, largeNotes[0].notes);
  const next = createGamesPage(largeNotes, { ...query, offset: first.nextOffset });
  assert.equal(next.games[0].id, largeNotes[2].id);
  assert.throws(() => createGamesPage(records, readGamesListQuery(params("fields=id,cover_url"))), GameApiRecordTooLargeError);
});

let reads = [];
const repository = {
  DatabaseNotConfiguredError: class extends Error {},
  getStoredGamesForApi: async (includeCover = false) => {
    reads.push(includeCover);
    return fixture.map((game) => includeCover ? { ...game } : { ...game, coverUrl: undefined });
  },
};
const overrides = { "@/lib/server/gameRepository": repository };
const listRoute = loadTs("src/app/api/games/route.ts", overrides);
const countRoute = loadTs("src/app/api/games/count/route.ts", overrides);
const openapiRoute = loadTs("src/app/api/openapi/route.ts");
const originalToken = process.env.GAMES_API_TOKEN;
process.env.GAMES_API_TOKEN = "test-only-games-api-token";
after(() => {
  if (originalToken === undefined) delete process.env.GAMES_API_TOKEN;
  else process.env.GAMES_API_TOKEN = originalToken;
});
function request(query = "", token = "test-only-games-api-token") {
  return new Request(`https://example.com/api/games?${query}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

test("countGames and listGames agree with combined filters and authorization", async () => {
  for (const query of ["", "platform=PS4&ownership_status=owned", "ownership_status=wishlist", "genre=RPG&play_status=completed", "search=special+note"]) {
    const list = await listRoute.GET(request(`${query}&limit=1&fields=id,title`));
    const count = await countRoute.GET(request(query));
    assert.equal(list.status, 200);
    assert.equal(count.status, 200);
    const body = await count.json();
    assert.deepEqual(Object.keys(body), ["total"]);
    assert.equal(body.total, (await list.json()).total);
    assert.ok(count.headers.get("cache-control").includes("no-store"));
  }
  assert.deepEqual(await (await countRoute.GET(request("limit=1&offset=1000"))).json(), { total: 247 });
  for (const route of [listRoute, countRoute]) {
    reads = [];
    for (const token of ["", "incorrect-token"]) {
      assert.equal((await route.GET(request("", token))).status, 401);
    }
    assert.deepEqual(reads, []);
    assert.equal(route.POST, undefined);
    assert.equal(route.PUT, undefined);
    assert.equal(route.PATCH, undefined);
    assert.equal(route.DELETE, undefined);
  }
});

test("routes validate queries before reading and fetch covers only when requested", async () => {
  reads = [];
  assert.equal((await listRoute.GET(request("limit=101"))).status, 400);
  assert.deepEqual(reads, []);
  assert.equal((await listRoute.GET(request())).status, 200);
  assert.deepEqual(reads, [false]);
  const response = await listRoute.GET(request("fields=cover_url"));
  assert.equal(response.status, 413);
  assert.deepEqual(reads, [false, true]);
  assert.equal((await response.json()).error, "record_too_large");
});

test("OpenAPI exposes the count tool and matching filters, pagination and array fields", async () => {
  const response = openapiRoute.GET(request());
  const schema = await response.json();
  const list = schema.paths["/api/games"].get;
  const count = schema.paths["/api/games/count"].get;
  assert.equal(count.operationId, "countGames");
  assert.equal(list.operationId, "listGames");
  assert.deepEqual(list.parameters.slice(0, 7), count.parameters);
  assert.equal(list.parameters.find((item) => item.name === "limit").schema.maximum, 100);
  assert.equal(list.parameters.find((item) => item.name === "offset").schema.default, 0);
  const fields = list.parameters.find((item) => item.name === "fields");
  assert.equal(fields.schema.type, "array");
  assert.equal(fields.explode, false);
  assert.equal(fields.style, "form");
  assert.ok(fields.schema.items.enum.includes("notes"));
  assert.equal(schema.components.schemas.Game.required, undefined);
  assert.ok(response.headers.get("cache-control").includes("no-store"));
  for (const item of Object.values(schema.paths)) assert.deepEqual(Object.keys(item), ["get"]);
});
