const gameAliases: Record<string, string> = {
  "巫師3": "The Witcher 3",
  "巫師 3": "The Witcher 3",
  "巫師三": "The Witcher 3",
  "獵魔士3": "The Witcher 3",
  "獵魔士 3": "The Witcher 3",
  "賽博龐克": "Cyberpunk 2077",
  "電馭叛客": "Cyberpunk 2077",
  "電馭叛客2077": "Cyberpunk 2077",
  "電馭叛客 2077": "Cyberpunk 2077",
  "人中之龍": "Like a Dragon",
  "人龍": "Like a Dragon",
  "戰神": "God of War",
  "最後生還者": "The Last of Us Part I",
  "最後的生還者": "The Last of Us Part I",
  "最後生還者2": "The Last of Us Part II",
  "最後生還者 2": "The Last of Us Part II",
  "蜘蛛人": "Marvel's Spider-Man",
  "漫威蜘蛛人": "Marvel's Spider-Man",
  "ff7": "Final Fantasy VII",
  "ff 7": "Final Fantasy VII",
  "ffvii": "Final Fantasy VII",
  "final fantasy 7": "Final Fantasy VII",
  "ff16": "Final Fantasy XVI",
  "ff 16": "Final Fantasy XVI",
  "ffxvi": "Final Fantasy XVI",
  "final fantasy 16": "Final Fantasy XVI",
};

function normalizeAliasKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

const normalizedGameAliases = Object.fromEntries(
  Object.entries(gameAliases).map(([alias, searchQuery]) => [
    normalizeAliasKey(alias),
    searchQuery,
  ]),
);

export function resolveGameSearchQuery(input: string) {
  const normalizedInput = normalizeAliasKey(input);

  return normalizedGameAliases[normalizedInput] ?? input.trim();
}
