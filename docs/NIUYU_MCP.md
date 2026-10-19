# 牛域與 My Games 唯讀連線

## 保留的既有服務

- 網站：`https://ps-game-library.vercel.app`
- REST：`https://ps-game-library.vercel.app/api/games`
- 數量：`https://ps-game-library.vercel.app/api/games/count`
- 原 GPT Action OpenAPI：`https://ps-game-library.vercel.app/api/openapi`
- 新增 MCP：`https://ps-game-library.vercel.app/api/mcp`
- 憑證：原本的 `GAMES_API_TOKEN`，未重設；不要使用管理用的 `GAMES_ADMIN_TOKEN`。

MCP 與 REST 共用正式 Neon 資料庫與唯讀資料服務，不需要搬移收藏、重建資料庫或另外維護清單。未執行資料 migration。

## 既有 Plugin 的限制

本機已安裝的牛域封裝名稱為 `gpt-ee514337f5583ab13de30af2f629bb0f`，版本 `0.4.1`，只有 Skills，沒有 `mcp.json` 或已註冊 App mapping。此名稱是封裝／原 GPT 識別字，不能拿來當 Plugin Creator 要求的後台 `plugin_id`。

目前透過 Plugin 搜尋沒有取得牛域的可編輯後台 ID；個人 Plugin 清單也沒有列出它。這不代表已刪除或權限遭拒，可能是移轉或不同管理範圍。需要由牛域現有 Plugin 詳細頁確認其後台來源，不能冒用其他 Plugin 的 ID、改本機 cache 假裝已更新，或建立同名的新 Plugin。

OpenAI 目前的公開提交文件明確指出：**不支援替既有 Skills-only Plugin 新增 MCP server**。因此目前不能保證在原牛域內直接掛上工具，必須先確認該 Plugin 是否有已存在、可管理的連線，或由 OpenAI 提供保留原 ID 的移轉方式。

官方來源：

- [Upload and submit your plugin：Create the draft](https://developers.openai.com/plugins/deploy/submission)
- [Package your plugin：MCP authentication](https://developers.openai.com/plugins/build/plugins)

## ChatGPT 端下一步

1. 開啟現有「牛域」Plugin 詳細頁，提供該頁網址，以核對正確後台 ID 與管理範圍。
2. 如果該頁原本就有 MCP 連線，編輯既有連線的 URL 為 `https://ps-game-library.vercel.app/api/mcp`，使用 API Key / Bearer，安全填入原 `GAMES_API_TOKEN`。不要把 Token 放入 URL、Skills 或聊天紀錄。
3. 如果只有 Skills，依目前平台限制不能直接新增 MCP。保留牛域，不建立新 Plugin；需要平台支援既有身分移轉或附加連線後才能繼續。
4. 如果連線介面只提供 OAuth，現有固定 Bearer Token 不能冒充 OAuth。此版沒有新建 OAuth 帳號、client secret 或登入流程，應先確認連線介面的實際支援方式。
5. 連線支援時重新掃描工具，應出現 `list_games`、`count_games`、`get_game`、`search_games`，再在同一個牛域測試。

原本「牛的遊戲庫」GPT Action 仍可使用：重新匯入原 OpenAPI URL，保留既有 Bearer 設定。這是既有 Action 的可用途徑，不能當成牛域 Plugin 已完成連線的證明。

此版本沒有建立新的 Plugin，也沒有修改分享對象、安裝其他 Plugin 或把私密資料公開。

## 查詢與資料真實性

- `count_games({})`：所有記錄，包含願望清單。
- `count_games({ownership_status: "owned"})`：自己擁有的收藏。
- `list_games({platform: "PS5", limit: 20, fields: ["id", "title", "hours_played", "is_completed", "completion_source", "play_status", "play_status_source"]})`：查看實際時數與進度來源。
- `search_games({search: "Resident Evil"})`：搜尋遊戲；有更多結果時使用 `nextOffset`。
- `get_game({id: "實際遊戲 ID"})`：查看單款遊戲。

工具只能回報儲存的 `playTimeHours`、`isCompleted` 與明確的舊 `status`。未填時數為 `null`；未記錄完成狀態為 `null`；沒有明確進度為 `not_recorded`。不要把 0 小時當成未玩、把願望清單當成未開始、把未完成當成 backlog，或從備註與聊天記憶猜測。

## 驗證

```bash
node --test tests/game-api.test.mjs
npm run lint
npm run build
```

整合測試使用獨立記憶體 fixture，不寫入正式資料庫。測試包含 MCP 初始化／發現、分頁、來源欄位、錯誤與缺少 Token、跨站 Origin、無效參數及拒絕寫入工具。

正式環境驗證另外比對修改前後的記錄 ID、名稱、平台、原始狀態、時數與時間戳雜湊。API 能回應與 MCP 能呼叫，只證明伺服器可用；必須在 ChatGPT 現有牛域連線完成後才能標記 Plugin 端恢復。

## 既有依賴檢查

此次 `npm audit` 未在新增的 MCP handler / SDK 中列出弱點，但現有 Next.js、PostCSS 與其他既有套件仍有弱點報告（含 critical）。為保持此次連線修改範圍，沒有執行 `npm audit fix --force`、更換 framework 或自動升級整個依賴樹；應另行安排安全版本更新並驗證網站。
