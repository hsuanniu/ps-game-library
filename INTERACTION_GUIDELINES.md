# Interaction Guidelines

使用者目前正在看的 Page 應該保持穩定。

暫時性的操作只是在 Page 上方開啟一個獨立介面；關閉後 Page 完全恢復，不需要重新理解畫面。

## Temporary Action

例如：

- Filter
- 排序
- 更多選項
- 快速操作

規則：

- 使用 Bottom Sheet 或 Dialog。
- 不要直接插入目前頁面 Layout。
- 不要讓目前頁面因為展開選單而改變排列。
- 不要覆蓋部分內容造成閱讀混亂。
- 開啟時要有 Backdrop。
- 背景內容不可操作。
- 背景不可捲動。
- 點擊 Backdrop 或 ESC 可以關閉。

## Permanent Action

例如：

- 新增遊戲
- 編輯遊戲
- 遊戲詳細資料
- 設定

規則：

- 使用獨立 Page 或 Full Screen。
- 不要使用小 Popup 承載主要流程。
- 頁面要有清楚的返回或取消入口。

## UX 原則

- Information First, Actions Second.
- 一個主要功能只保留一個主要入口。
- 每個區塊都要提供新的資訊。
- 不為了看起來豐富而增加資訊。
