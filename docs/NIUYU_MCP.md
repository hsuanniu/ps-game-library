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
- 目前版本：`0.4.2`
- 目前 release：`pluginrel_6ad654f422648191b5450e3d8fa7cdae`

一般 Plugin 搜尋及個人 Plugin 清單沒有列出這個移轉的 Plugin，但用已核對的後台 ID 成功讀取並更新。不能用原 GPT ID 代替後台 ID，也不能因列表找不到就認定不可編輯。

已更新原牛域的唯讀查詢規則，加入指向既有 `/api/mcp` 的 `mcp.json`，使用 API Key / Bearer 宣告，沒有打包任何 Token，圖示及原有支援檔案保留。來源讀回及網頁均確認有 `MCP servers 1`、版本 `0.4.2`。

但網頁更新後只顯示 **Open in desktop app**，未提供雲端 App 授權入口；因此這是可儲存的桌面 MCP 設定，**不是 ChatGPT 雲端已連線**。不能把看到 MCP server 或成功儲存 release 當成工具可用。

海水缸分析庫採用的是 Skills 加上 `.app.json` 中已註冊的 Reef Tank Controller App；它和單獨宣告一個遠端 `mcp.json` 不同。要在 ChatGPT 雲端取得相同效果，仍需適用的已註冊資料 App 與安全授權，再由現有牛域綁定。

OpenAI 公開提交文件對既有 Skills-only 新增 MCP 的限制，不能籠統套用到私人 Plugin 的原始碼更新；本次實測私人更新可保存，但雲端工具註冊仍未完成。

曾準備移除此次測試新增的 `mcp.json` / `.mcp.json`、將能力恢復為 Skills 並保留查詢指引，以恢復網頁聊天入口。自動審查以「未明確授權刪除 MCP 設定」拒絕該操作；**移除未執行，0.4.2 與 MCP 設定仍保留**。需要使用者明確同意後才可繼續這項恢復。

官方來源：

- [Upload and submit your plugin：Create the draft](https://developers.openai.com/plugins/deploy/submission)
- [Package your plugin：MCP authentication](https://developers.openai.com/plugins/build/plugins)

## ChatGPT 端下一步

1. 牛域身分與管理頁已確認，不需要使用者再尋找 Plugin ID。
2. 目前沒有可綁定的遊戲庫資料 App。若要採海水缸的雲端方式，需要使用者同意註冊遊戲資料連線；該連線可能在 ChatGPT 多出一個 Plugin 項目，與原本「不新增任何 Plugin」的限制有衝突，不能擅自建立。
3. 同意後，保留原牛域，註冊唯讀資料 App 並綁定。使用原 `GAMES_API_TOKEN` 安全授權，不得把 Token 放入 URL、Skills 或聊天紀錄。桌面 MCP 設定的移除也需使用者明確同意。
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
