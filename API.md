# My Games 唯讀 API 與雲端資料

本文件記錄 My Games 的正式資料來源、唯讀 API、安全設定與 ChatGPT / MCP 串接方式。

## 架構

設定雲端同步後，資料流如下：

```text
My Games 網站新增 / 編輯 / 刪除
  -> Neon Postgres（唯一正式資料來源）
  -> GET /api/games（即時、no-store）
  -> ChatGPT Action 或唯讀 MCP Server
```

瀏覽器 `localStorage` 仍保留為本機快取與第一次搬移來源，但不再是 ChatGPT 的資料來源。未設定 Neon 前，網站會維持原本的 localStorage 模式，不會遺失現有資料。

## 第一次設定

1. 在 Vercel 專案的 Storage / Marketplace 建立並連接 Neon Postgres。
2. 確認 Vercel 已加入 `DATABASE_URL`。
3. 產生兩組不同的高強度 Token，例如：

   ```bash
   openssl rand -hex 32
   openssl rand -hex 32
   ```

4. 在 Vercel Environment Variables 加入：

   ```env
   GAMES_API_TOKEN=給 ChatGPT 或 MCP 使用的唯讀 Token
   GAMES_ADMIN_TOKEN=網站雲端同步管理密碼
   ```

5. 重新部署。
6. 使用目前保存遊戲資料的同一個瀏覽器／裝置開啟 `/sync`。
7. 輸入 `GAMES_ADMIN_TOKEN`，確認本機與雲端數量後執行第一次匯入。
8. 回到首頁。之後網站會直接載入並同步 Neon 的正式資料。

安全保護：空的 localStorage 不能初始化雲端；雲端一旦初始化，`/sync` 不再提供覆蓋功能，因此其他裝置的舊快取不會取代正式收藏。匯入只複製資料，不會清除原本 localStorage。

資料表會在第一次伺服器請求時安全地以 `CREATE TABLE IF NOT EXISTS` 建立。也可以在 Neon SQL Editor 手動執行 [`database/migrations/001_create_game_store.sql`](database/migrations/001_create_game_store.sql)。這個 migration 不會刪除既有資料。

## Environment Variables

| 變數 | 用途 | 是否可公開 |
| --- | --- | --- |
| `DATABASE_URL` | Neon Postgres 連線字串 | 否 |
| `GAMES_API_TOKEN` | 外部唯讀 API Bearer Token | 否 |
| `GAMES_ADMIN_TOKEN` | 網站同步管理密碼 | 否 |
| `IGDB_CLIENT_ID` | IGDB 搜尋 | 否 |
| `IGDB_CLIENT_SECRET` | IGDB 搜尋 | 否 |

所有值都只能放在 `.env.local` 或 Vercel Environment Variables，不可使用 `NEXT_PUBLIC_` 前綴，也不可 commit。

## Authentication

外部 API 使用 Bearer Token：

```http
Authorization: Bearer YOUR_GAMES_API_TOKEN
```

網站的雲端寫入不使用這個 Token。它使用另一組 `GAMES_ADMIN_TOKEN` 建立 HttpOnly、Secure、SameSite=Strict 的管理 Cookie。外部公開 API 沒有 `POST`、`PUT`、`PATCH` 或 `DELETE`。

## Endpoints

### `GET /api/games`

分頁讀取資料庫中的遊戲，包含收藏、願望清單、借入、借出及已售出，不只限於已擁有遊戲。預設每頁 20 筆、最多 100 筆，依 `created_at DESC, id ASC` 排列。

預設回傳精簡資料：省略 `cover_url`、`notes`、`purchase`、`loan_person`，其餘欄位保留。省略的欄位仍可透過 `fields` 選取，單款完整資料仍可透過 `getGame` 取得。這些調整只改外部唯讀 API，網站 UI 與雲端同步的完整資料不變。

可用 query parameters：

| Parameter | 範例 | 說明 |
| --- | --- | --- |
| `search` | `Resident Evil` | 搜尋名稱、顯示名稱、系列、類型與備註 |
| `platform` | `PS5` | 遊戲版本 |
| `genre` | `角色扮演` | 類型（部分比對） |
| `series` | `Resident Evil` | 系列／群組（部分比對） |
| `status` | `wishlist` | 網站原始 status |
| `play_status` | `completed` | 正規化遊玩狀態 |
| `ownership_status` | `owned` | 正規化持有狀態 |
| `limit` | `20` | 每頁最多筆數，整數 1–100，預設 20 |
| `offset` | `0` | 略過符合篩選的筆數，預設 0 |
| `fields` | `id,title` | 只回傳指定欄位，逗號分隔；Action schema 使用字串陣列 |

`ownership_status=not_owned` 會包含目前不屬於使用者持有的資料，例如願望清單、借入與已售出。

每頁 JSON 最多 64 KiB，較大的資料會讓該頁提早結束。`total` 永遠是符合篩選的總數；`returned` 才是本頁筆數，`count` 保留為 `total` 的舊相容名稱。若 `hasMore=true`，請使用 `nextOffset` 取得下一頁，保留相同篩選與 `fields`，不要直接加上 `limit`，以免漏資料。超出末頁會回傳空的 `games`、正確 `total`、`hasMore=false` 與 `nextOffset=null`。

若單款選取欄位已超過上限（例如 base64 封面），回傳小型 `413 record_too_large` 錯誤，請改用 `fields=id,title` 或移除大型欄位。資料不會被截斷或修改。無效的 `limit`、`offset` 或欄位名稱回傳 `400 invalid_query`。

分頁查詢各自讀取最新雲端資料；若抓取期間收藏有新增或刪除，offset 可能移動，需要重新從第一頁讀取。

### `GET /api/games/count`（`countGames`）

使用和 `listGames` 相同的七個篩選條件：`platform`、`genre`、`series`、`status`、`play_status`、`ownership_status`、`search`。只回傳數量，不回傳遊戲或圖片，也不受分頁參數影響。

```json
{ "total": 247 }
```

查詢總數、PS4 / PS5 數量、收藏與願望清單數量或遊玩狀態數量，優先使用 `countGames`。

### `GET /api/games/{id}`

依精確 ID 取得單一遊戲。

### `GET /api/openapi`

回傳動態產生的 OpenAPI 3.1 schema，可供 ChatGPT Custom GPT Action 或其他 API client 匯入。

Schema 版本為 `1.1.0`，提供 `listGames`、`countGames`、`getGame`。更新部署後，請在 GPT 編輯器原本的 Action 重新從 `https://ps-game-library.vercel.app/api/openapi` 匯入並儲存，保留原本 API Key / Bearer 驗證。既有 GPT 不會自動更新已匯入的 schema。

## 測試

將網域及 Token 換成正式值：

```bash
curl \
  -H "Authorization: Bearer YOUR_GAMES_API_TOKEN" \
  "https://ps-game-library.vercel.app/api/games"
```

查詢尚未完成的 PS5 收藏：

```bash
curl \
  -H "Authorization: Bearer YOUR_GAMES_API_TOKEN" \
"https://ps-game-library.vercel.app/api/games?platform=PS5&play_status=backlog&ownership_status=owned"
```

只查數量：

```bash
curl \
  -H "Authorization: Bearer YOUR_GAMES_API_TOKEN" \
  "https://ps-game-library.vercel.app/api/games/count?platform=PS4&ownership_status=owned"
```

只取名稱，逐頁取得完整 PS4 收藏：

```bash
curl \
  -H "Authorization: Bearer YOUR_GAMES_API_TOKEN" \
  "https://ps-game-library.vercel.app/api/games?platform=PS4&ownership_status=owned&limit=20&offset=0&fields=id,title"
```

接著用回應的 `nextOffset` 替換 `offset`，直到 `hasMore=false`。同樣可用 `/api/games/count?play_status=completed`、`?play_status=backlog`、`?play_status=playing` 或 `?ownership_status=wishlist` 查詢分類數量。

未帶 Token 會回傳 `401`。未設定資料庫或 Token 會回傳 `503`。

## Response

`GET /api/games?limit=1&offset=0&fields=id,title` 的範例：

```json
{
  "games": [{ "id": "game-1", "title": "Cyberpunk 2077" }],
  "total": 247,
  "hasMore": true,
  "limit": 1,
  "offset": 0,
  "nextOffset": 1,
  "returned": 1,
  "count": 247,
  "generated_at": "2026-10-08T08:00:00.000Z"
}
```

完整單款資料（`GET /api/games/{id}`）的範例：

```json
{
  "game": {
      "id": "7f4d8b5b-...",
      "title": "Cyberpunk 2077",
      "display_title": "電馭叛客 2077",
      "cover_url": "https://images.igdb.com/...jpg",
      "platform": "PS5",
      "status": "owned",
      "play_status": "completed",
      "ownership_status": "owned",
      "ownership_type": "disc",
      "is_owned": true,
      "wishlist": false,
      "genre": ["角色扮演", "冒險"],
      "age_rating": {
        "system": "PEGI",
        "rating": "18",
        "display": "限制級"
      },
      "rating": null,
      "hours_played": 100,
      "is_completed": true,
      "completed_date": null,
      "series": {
        "name": "Cyberpunk",
        "order": null
      },
      "purchase": {
        "price": 1490,
        "date": "2026-01-10"
      },
      "loan_person": null,
      "notes": "",
      "added_at": "2026-01-10T08:00:00.000Z",
      "created_at": "2026-01-10T08:00:00.000Z",
      "updated_at": "2026-07-15T09:00:00.000Z"
    },
  "generated_at": "2026-10-04T08:00:00.000Z"
}
```

回應使用 `Cache-Control: no-store`，因此新增、修改或刪除同步成功後，下一次 API 請求會讀到最新資料。

## 現有資料欄位

目前網站的 `Game` 資料包含：

- `id`
- `title`
- `displayTitle`
- `coverUrl`
- `platform`
- `status`
- `ownershipType`
- `playTimeHours`
- `purchasePrice`
- `purchaseDate`
- `seriesName`
- `seriesOrder`
- `genre`
- `ageRating`
- `isCompleted`
- `loanPerson`
- `notes`
- `addedAt`
- `createdAt`
- `updatedAt`

目前沒有其他 games relationship 或獨立的 tags、ratings、platforms table。IGDB 只負責搜尋候選與帶入 metadata，不是收藏的正式資料來源。

## 狀態 mapping

API 保留網站原始 `status`，另外提供方便 AI 查詢的欄位：

### `ownership_status`

- `wishlist` / `waiting_sale` -> `wishlist`
- `borrowed` -> `borrowed`
- `rented`（目前 UI 表示借出）-> `lent`
- `sold` -> `sold`
- 其他 -> `owned`

### `play_status`

- `isCompleted=true` 或舊 `finished` -> `completed`
- 舊 `playing` -> `playing`
- 舊 `paused` -> `paused`
- 願望清單 -> `not_started`
- 已持有且遊玩時數為 0 -> `backlog`（依現有資料推定）
- 有時數但未記錄明確進度 -> `not_recorded`

目前網站沒有 `dropped`、個人 `rating` 與 `completed_date` 欄位，因此 API 會誠實回傳 `rating: null`、`completed_date: null`，也不會捏造棄坑狀態。若未來要精準回答「最近破關」或「最高評分」，建議在網站資料模型增加：

- `playStatus`
- `userRating`
- `completedAt`
- 選配：`tags`、`priority`

## ChatGPT 與 MCP

個人第一階段最簡單的方式是使用 `/api/openapi` 建立 ChatGPT Custom GPT Action，設定 Bearer authentication。它已足夠回答遊戲庫、願望清單、平台、系列、類型與完成狀態等問題。

若希望在 ChatGPT Developer Mode 或多個 AI client 中使用一致工具名稱，第二階段再建立 Remote MCP Server。MCP 應只包裝同一個唯讀 API，不建立第二份資料。建議工具：

- `list_games`
- `count_games`
- `get_game`
- `search_games`
- `get_currently_playing`
- `get_backlog`
- `get_completed_games`
- `get_wishlist`
- `get_owned_games`
- `get_unowned_games`
- `get_games_by_platform`
- `get_games_by_genre`
- `get_games_by_series`

所有工具只呼叫 `GET /api/games`、`GET /api/games/count` 或 `GET /api/games/{id}`。清單工具需傳入 `limit`、`offset`、`fields`，數量工具只取 `total`。不要實作任何新增、更新、刪除或變更狀態工具。

## 開發驗證

```bash
node --test tests/game-api.test.mjs
npm run lint
npm run build
```

測試使用獨立記憶體 fixture（247 款、含大型封面），不寫入正式資料庫或 localStorage。

## 安全注意事項

- 不要在聊天、Git、前端 JavaScript 或 URL query string 中放 Token。
- `GAMES_API_TOKEN` 與 `GAMES_ADMIN_TOKEN` 必須不同，建議至少 32 bytes 隨機值。
- 若 Token 疑似外洩，立刻在 Vercel 更換並重新部署。
- `/sync` 管理登入目前是單人 App 的共享密碼模式，不是多人帳號系統。
- 手動上傳封面目前會以 data URL 儲存在遊戲資料中；過大的圖片可能碰到 Vercel request body 限制。未來可將上傳封面改存 private Blob，資料表只保留 URL。
