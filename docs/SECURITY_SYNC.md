# 安全與同步維護說明

更新日期：2026/10/20。這次不增加首頁資訊、分類或圖表，不改遊戲資料表結構，不更換既有 Token。

## 資料來源與儲存結果

- Neon 仍是網站與唯讀 API / MCP 共用的唯一正式資料來源。
- 表單等待儲存結果，不再先顯示雲端同步成功；處理期間防止重複送出。
- 雲端確認寫入後才顯示「儲存成功，已同步雲端」。
- 雲端失敗而本機保存成功時，顯示「已儲存於此裝置，尚未同步雲端」，並保留待重試內容。
- 本機與雲端都失敗時，留在表單，不清除尚未儲存的欄位。
- 本機配額不足不阻止另行嘗試雲端儲存；雲端成功、本機備份失敗會分開提示。
- 未同步內容不會出現在牛域，只有成功寫入 Neon 的內容才能被 API / MCP 查到。

## 衝突與舊資料保護

1. 清單與 revision 在同一個唯讀 Repeatable Read transaction 中取得。
2. 寫入仍使用現有 Serializable transaction 與 expectedRevision；資料庫序列化衝突回傳 409。
3. 每次寫入前重新核對 revision，不使用新的 revision 強行重送舊清單。
4. 多裝置衝突保留本機修改，不自動覆蓋雲端。使用者可稍後處理，或保留復原副本後載入雲端。
5. 沒有同步標記的舊本機資料若與雲端不同，先保留，不當成可安全丟棄的快取。
6. 離線修改與刪除全部的待同步狀態可跨重新整理保留；網路恢復時只自動重試網路錯誤，不自動解決權限或版本衝突。
7. 寫入逾時但資料實際已提交時，重試會比較完整內容，確認相同後接受現有結果，避免重複寫入。
8. 雲端未初始化時不自動上傳，不用空資料初始化，第一次搬移仍走既有 `/sync`。
9. 非法資料列或重複 ID 會阻擋儲存／快照，不會略過資料後再回存不完整清單。
10. 編輯其他欄位不再重寫舊的 playing / finished / paused / waiting_sale、持有形式或 PS4_PS5。createdAt / addedAt 保持原值。

沒有 isCompleted 的舊資料不會因編輯備註就被補成 false；舊 finished 在表單中顯示已完成主線，但未改 checkbox 時保留原始資料。

## 本機儲存

既有遊戲陣列 key 與 Game 結構不變：

| Key | 用途 |
| --- | --- |
| `ps-game-library:v1` | 目前快取或待同步清單 |
| `ps-game-library:backup:v1` | 既有的上一份非空清單備份，會輪替 |
| `ps-game-library:sync-metadata:v1` | baseRevision、dirty、內容 SHA-256 指紋 |
| `ps-game-library:recovery:v1:{fingerprint}` | 使用者選擇載入雲端前的獨立復原副本，含 games、baseRevision、dirty、savedAt |

復原副本不被後續一般儲存輪替或自動清除；同指紋不重複建立。無法寫入副本時中止載入雲端。這些副本只是裝置內的復原紀錄，不是另一份提供 ChatGPT 使用的正式資料庫。

同步標記失敗或與內容不符時不信任快取。不要清除仍有待同步內容的瀏覽器儲存；清除網站資料或使用其他瀏覽器仍可能失去裝置內資料。本機副本也不能取代 Neon 備份與時間點還原，正式備份政策應另外確認。

復原副本不放在首頁，入口為 `/sync` 的「備份與復原」。可下載完整備份、預覽差異並只補回缺少的遊戲，不直接用舊快照覆蓋正式雲端。實際部署狀態與操作流程見 [備份與部署驗收](RELEASE_CHECKLIST.md)。

## 登入與請求限制

- 沿用既有 GAMES_ADMIN_TOKEN、GAMES_API_TOKEN 與管理 Cookie，不重設憑證。
- 管理登入使用 Neon 原子計數，同一來源 15 分鐘最多 10 次，跨 Vercel 冷啟動共用。
- 超限回傳 429 與 Retry-After；計數服務不可用時回傳 503，不跳過登入保護。
- Vercel 僅信任其平台提供的 x-vercel-forwarded-for，資料庫只儲存來源的 HMAC，不儲存原始 IP 或 Token。
- 非 Vercel 環境共用保守的 unknown-client bucket，不能用任意 Forwarded header 繞過限制；其他部署平台需另行配置可信來源識別。
- 此機制降低單來源暴力嘗試風險，不能取代高強度管理密碼或平台層的防機器人保護。
- 登入 JSON 上限 4 KB、完整同步 JSON 上限 4 MB，按實際串流位元組計算，不只相信 Content-Length。
- 新選取的上傳封面上限 1.5 MB；不壓縮、修改或移除既有封面。整份同步若超出 4 MB，保留待同步內容並提示更換較小封面。

## Migration 與部署

新增 `database/migrations/002_login_rate_limit.sql`，只建立獨立的 my_games_login_attempts 表及 index，不改遊戲資料、revision 或密碼。

登入服務會使用既有 DATABASE_URL，在首次登入時以 CREATE TABLE IF NOT EXISTS 建立這兩項；也可先由有權限的維護者在正確資料庫執行 migration。若角色無 DDL 權限，請先由資料庫管理者套用，避免登入回傳 503。

本次本機驗證沒有連線正式 Neon、執行正式 migration、修改正式收藏或變更 Vercel Secrets。程式通過檢查不代表已部署；正式啟用前仍需部署及驗證實際登入、兩裝置衝突與同步。

## 相依套件稽核

最終安裝 Next.js / eslint-config-next 16.4.2、PostCSS 8.5.31，並更新相容的相依套件。2026/10/20 npm audit 結果：0 Critical、5 High。5 項來自同一條 ESLint 相依鏈：eslint-config-next -> @next/eslint-plugin-next -> fast-glob -> micromatch -> braces。

[braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) 尚未提供修補版本，未用強制降級 ESLint 配置來隱藏警示。這條鏈目前用於 lint，並非遊戲 API 的查詢輸入路徑；仍需等待上游修補後再次更新，不宣稱漏洞全部清零。

## 驗證方式

```sh
npm test
npm run lint
npm run build
npm audit
```

測試以注入的假資料庫與獨立 fixture 執行，不讀取 .env.local，也不寫入正式資料。涵蓋斷線、過期登入、多裝置衝突、逾時已提交、容量不足、重複 ID、舊資料保留、原唯讀 API / MCP 驗證及分頁。

本機手機驗證必須停用正式連線，例如：

```sh
env DATABASE_URL= GAMES_API_TOKEN= GAMES_ADMIN_TOKEN= IGDB_CLIENT_ID= IGDB_CLIENT_SECRET= npm run dev -- --hostname 127.0.0.1 --port 3100
```

使用本機測試資料確認新增、重新整理、編輯與 Bottom Navigation 更新按鈕、未儲存離開確認、同步提示焦點與背景捲動鎖定。在 375px、390px 手機寬度與桌面檢查，不以此取代真實 iPhone 或正式 Neon 的端到端測試。
