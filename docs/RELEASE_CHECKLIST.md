# 備份、復原與正式部署驗收

## 本輪狀態（2026/10/20）

| 項目 | 狀態 |
| --- | --- |
| Repository / branch | 已確認 hsuanniu/ps-game-library，main |
| Vercel 專案 | 已確認原 ps-game-library，正式站 https://ps-game-library.vercel.app |
| 正式部署基準 | 3b0d17ca2e30ef36e2bb040dfd11f2bd61afbad0；本輪尚未推送或部署 |
| Neon 對應 | Vercel 顯示 my-games-db，resource hidden-river-68215108，Free / Available |
| Preview 隔離 | 現有資料庫連到 All Environments，不能直接用 Preview 寫入驗收 |
| 正式 API 無 Token / 錯誤 Token | GET /api/games 與 count 無 Token 401；games 錯誤 Token 401 |
| 正式 API 外部寫入方法 | POST / PUT / DELETE /api/games 都回 405，未送遊戲資料 |
| 正式完整備份 / 還原演練 | 未執行，等待允許使用既有連線憑證；沒有修改正式資料 |
| Neon 歷史還原期限 | 尚未確認；Open in Neon 停在 Email Verification |
| 設定頁備份與復原 | 已實作；不修改首頁 |
| 本機 UI 復原 | 已驗證測試資料 2 -> 1 -> 2，預覽只補回缺少 1 款 |
| 本機 JSON 下載 | 已下載並讀回確認 2 款獨立 QA 資料，不是正式收藏備份 |
| 本機自動檢查 | 64 項測試、lint、build 通過；audit 為 0 Critical、5 High |
| 檔案選擇匯入 | 驗證邏輯有單元測試；自動瀏覽器匯入受 Chrome extension 本機檔案權限限制，尚未完成實測 |
| CI / 部署檢查 | 工作流程與 vercel.json 已建立；GitHub 實際執行須待推送後確認 |
| 正式新增 / 修改 / 刪除及牛域即時讀取 | 本輪尚未驗證，不以單元測試或本機畫面代替 |

## 正式備份

操作前先確認 Vercel / GitHub / Neon 資源名稱與目前生產部署一致。既有 GAMES_API_TOKEN 只送到原遊戲庫 API，DATABASE_URL 只用於原 Neon 連線，不印出或修改憑證。

```sh
npm run backup:games -- --confirm-project=ps-game-library --verify-restore
```

此程式會：

1. 在唯讀 Repeatable Read transaction 取得 my_games_games、my_games_state 及欄位描述。
2. 經正式唯讀 API 分頁核對完整 ID 集合，防止把其他資料庫當成正式來源。
3. 以 0700 資料夾、0600 檔案保存至 ~/Documents/Codex/private-backups/ps-game-library，不放在 repository 或 public。
4. 讀回檔案核對 SHA-256，保留全部 Game JSON 欄位、封面與日期。
5. 使用同一個 transaction 的 TEMP tables 載入備份並逐欄核對雜湊；ON COMMIT DROP 自動清除暫存表，沒有 INSERT / UPDATE / DELETE public 收藏表。

這是兩張收藏資料表的邏輯備份，不是整個 PostgreSQL cluster 的 pg_dump。程式完成不代表 Neon PITR 已確認；需要另外檢查實際方案的 history window。

備份包含私人備註與購買資料，請勿 commit、上傳公開空間或貼入聊天。移至其他裝置時應選擇安全位置；此副本不是 API 的第二份正式資料來源。

## 設定頁復原

入口為 `/sync` 的「備份與復原」：

- 下載雲端備份會先重新讀取雲端，不匯出過期快取冒充最新資料。
- 下載本機備份包含尚未同步內容。
- 可預覽既有復原副本或選擇 JSON 檔。支援攜帶式備份、舊 Game 陣列及具正確 checksum 的資料庫備份。
- 預覽分為可補回、同 ID 但內容不同、完全相同、僅目前存在。內容不同與僅目前存在者都不覆蓋、不刪除。
- 雲端已初始化且管理登入有效時，只補回缺少 ID；重新核對 preview revision 後才寫入，衝突即停止。
- 本機有未核對或待同步修改時，先阻擋雲端復原；可下載本機備份，或處理同步衝突後再補回。
- 無雲端管理連線或雲端未初始化時，只提供本機補回，標記 dirty，不自動初始化雲端。
- 補回前保留現況復原副本。容量不足時中止，不清除既有副本或資料。
- 檔案限制 8 MB，限制結構深度與節點數；格式錯誤、重複 ID、無效日期／數值一律阻擋，不略過壞資料再寫入。

## 自動檢查

```sh
npm run verify
```

依序執行 lint、全部單元測試、Next.js build。任何步驟失敗即非零結束。vercel.json 指定相同 buildCommand，因此新版 Vercel deployment 必須通過這些檢查。

GitHub Actions 在 main push、pull request 與手動執行時驗證，使用 Node 24、npm ci、固定 SHA 的官方 Actions、唯讀 repository 權限及無正式憑證的測試環境。另以 npm audit --audit-level=critical 阻擋 Critical 警示；現有 ESLint 相依鏈的 5 High 仍需追蹤。尚未設定 GitHub branch protection，不能把建立 workflow 當成已啟用 required checks。

## 上線驗收順序

1. 正式備份成功、讀回 checksum 正確、隔離還原演練通過後，才推送 main。
2. 確認 Vercel READY、正式 domain 對應正確 commit，並確認 GitHub workflow 真正通過。
3. 確認新增的 login rate-limit 表可建立，不改遊戲資料表、不重設 Token。
4. 重測無 Token / 錯誤 Token / 唯讀 Token / 禁止寫入方法與 MCP。
5. 使用真正隔離的 Neon 測試分支驗證新增、編輯、刪除、斷線重試及多裝置衝突；未隔離前不在共用正式資料庫做寫入測試。
6. 以原本 iPhone 瀏覽器和使用中的主畫面 App 確認登入與資料。不要清除網站資料或重新匯入舊快取。
7. 核對正式資料與上線前備份。若期間有正常使用者修改，先辨認新修改，不強行回滾到舊快照。

## 失敗處理

建置失敗不切換正式版本。程式回退可以選擇 Vercel 先前 deployment，但不等於資料庫還原。若真正需要恢復歷史資料，先保存現況，再在隔離分支驗證備份；不要直接對 production 執行整庫 PITR。

官方文件：

- [Neon Instant Restore](https://neon.com/docs/postgres/backup-restore/branch-restore)
- [Vercel buildCommand](https://vercel.com/docs/project-configuration/vercel-json#buildcommand)
- [GitHub Node.js CI](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs)
