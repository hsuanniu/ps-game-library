# 牛域與 My Games 唯讀連線

## 保留的既有服務

- 網站：`https://ps-game-library.vercel.app`
- REST：`https://ps-game-library.vercel.app/api/games`
- 數量：`https://ps-game-library.vercel.app/api/games/count`
- 原 GPT Action OpenAPI：`https://ps-game-library.vercel.app/api/openapi`
- 新增 MCP：`https://ps-game-library.vercel.app/api/mcp`
- 憑證：原本的 `GAMES_API_TOKEN`，未重設；不要使用管理用的 `GAMES_ADMIN_TOKEN`。

MCP 與 REST 共用正式 Neon 資料庫與唯讀資料服務，不需要搬移收藏、重建資料庫或另外維護清單。未執行資料 migration。

## 已確認的既有 Plugin

使用者提供原 GPT 連結後，從頁面的「Use plugin」取得真正 Plugin 管理頁：

- 管理頁：`https://chatgpt.com/plugins/plugin_55deb1cc65a88191996997c95d08c3c3`
- 後台 ID：`plugin_55deb1cc65a88191996997c95d08c3c3`
- 封裝名稱：`gpt-ee514337f5583ab13de30af2f629bb0f`
- 範圍：私人 `USER`，原有身分與分享對象未變。
- 目前版本：`0.4.4`
- 目前 release：`pluginrel_6ad6594359d88191bc99e3cc22f244bf`

一般 Plugin 搜尋及個人 Plugin 清單沒有列出這個移轉的 Plugin，但用已核對的後台 ID 成功讀取並更新。不能用原 GPT ID 代替後台 ID，也不能因列表找不到就認定不可編輯。

先前 `0.4.2` 的 portable `mcp.json` 雖可保存，卻讓網頁入口變成 **Open in desktop app**，並未完成雲端連線。使用者明確授權後，在 `0.4.3` 移除此次測試的 `mcp.json` / `.mcp.json`，確認 **Manage / Try in chat** 恢復。

`0.4.4` 改用 `.app.json` 綁定已註冊的私人雲端資料 App，沿用原牛域身分、圖示、Skills 與分享對象。網頁已顯示 **Apps 1 / Connected**，不再使用桌面 MCP 宣告。

這與海水缸分析庫的 Skills + 已註冊資料 App 相同。儲存設定、畫面顯示 Connected 與實際工具成功仍是不同驗證層級，不能互相代替。

## 私人雲端資料 App

- 名稱：My Games 遊戲庫連線。
- App ID：`asdk_app_sites_a826dd121bac8191aa95fe9ccd3c090f`。
- 原生連線 Plugin：`plugin_asdk_app_sites_a826dd121bac8191aa95fe9ccd3c090f`，由 Sites 自動建立，沒有另外建立第二個牛域。
- Sites project：`appgprj_6ad657c372e881918a527741b66dd8c6`。
- 連線網址：`https://my-games-readonly-connector.orangebrush512.chatgpt.site`。
- MCP：同網址的 `/mcp`。
- 原始碼工作目錄：`/Users/ntype/Documents/Codex/my-games-readonly-connector`，由 Sites source helper 維護其專用原始碼儲存庫及部署。

資料流：牛域 → 私人 Sites MCP → 原 Vercel GET API → 原 Neon 資料庫。橋接不使用 D1 / R2，不複製、不同步也不快取另一份遊戲清單。

Sites 限定擁有者存取，工具呼叫還要求平台注入的使用者身分。原 `GAMES_API_TOKEN` 已保存為 Sites runtime secret；沒有使用 `GAMES_ADMIN_TOKEN`，沒有把憑證放進原始碼、Plugin、URL 或聊天。只允許固定上游與四個 GET 唯讀操作，拒絕未知參數、寫入工具及轉址。資料限制為 24 KiB，分頁與欄位選擇保留。

部署時曾遇到 Cloudflare 不支援 `redirect: "error"` 的實際錯誤。已改為 `redirect: "manual"` 並拒絕全部 3xx 回應，確保不會跟隨轉址傳送 Bearer Token。錯誤記錄遮蔽 Token，不記錄遊戲內容。

官方來源：

- [Upload and submit your plugin：Create the draft](https://developers.openai.com/plugins/deploy/submission)
- [Package your plugin：MCP authentication](https://developers.openai.com/plugins/build/plugins)

## ChatGPT 使用

1. 開新對話，選擇 `@牛域`，或從原牛域管理頁按 **Try in chat**。
2. 連線頁應有 **My Games 遊戲庫連線 / Connected**。不需要把 Token 貼到聊天。
3. 可問總數、平台分布、願望清單或實際記錄的完成與時數。
4. 舊對話若沒有新工具，改用新對話；不要刪除牛域、重建遊戲庫或重設憑證。

原本「牛的遊戲庫」GPT Action 仍可使用：重新匯入原 OpenAPI URL，保留既有 Bearer 設定。這是既有 Action 的可用途徑，不能當成牛域 Plugin 已完成連線的證明。

新增資料連線是經使用者明確同意的獨立私人 App；原網站及牛域並未重建，未變更分享對象或公開私密資料。

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

### 2026-10-20 實際驗證

- 牛域 `0.4.4` 的網頁入口正常，已註冊資料 App 顯示 Connected。
- 在 ChatGPT 一般 Chat 模式使用原牛域完成端到端查詢，四個唯讀工具全部成功。
- `count_games`：全部 44 款、PS4 7 款、PS5 37 款；這是全部記錄，不代表全是 PS5，也未額外限定 owned。
- `list_games`：讀完 44 筆並確認 `hasMore=false`；明確完成 8 款、明確記錄遊玩中 0 款、進度未記錄 36 款。
- 抽查 3 款的時數、完成布林與來源、遊玩狀態與來源；空時數保留 null，明確 false 不改成未知。
- 使用清單取得的真實 ID 執行 `get_game`，再以同款名稱執行 `search_games`，回傳一致。
- 原 REST 缺少／錯誤 Token 均回傳 401；有效唯讀 Token 可讀。查詢未改變原 44 筆的 ID、名稱、平台、原始狀態、時數與時間戳。
- 私人 Sites `/mcp` 未登入回傳 401；偽造使用者身分標頭但未登入也回傳 401，未取得遊戲資料。
- 主網站 `npm run lint`、`npm run build` 通過；橋接服務 11 項獨立測試、建置及部署檔驗證通過。
- 橋接正式部署 commit：`d8ed2dca92342e5b3ea5ef0f03fddc779149d158`，Sites deployment：`appgdep_6ad65ab239088191b39fd85e6dbedfba`，狀態 succeeded。

初次端到端測試失敗的對話保留在帳號中；同一驗證對話最後一次已成功。辨識最末的「牛域本次唯讀驗證結果」，不要把前面的診斷失敗當成目前狀態。

## 既有依賴檢查

此次 `npm audit` 未在新增的 MCP handler / SDK 中列出弱點，但現有 Next.js、PostCSS 與其他既有套件仍有弱點報告（含 critical）。為保持此次連線修改範圍，沒有執行 `npm audit fix --force`、更換 framework 或自動升級整個依賴樹；應另行安排安全版本更新並驗證網站。
