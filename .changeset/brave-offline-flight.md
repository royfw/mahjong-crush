---
"mahjong-crush": minor
---

feat(pwa): 可安裝到手機主畫面、離線遊玩

- 加入 PWA（vite-plugin-pwa）：manifest、App 圖示、service worker 預先快取整個遊戲（約 810 KB），開過一次後沒有網路也能玩
- 字型改為自帶：Noto Serif TC 只取介面用到的字與常用字做子集（每個字重約 120 KB），不再依賴 Google Fonts
- 離線時記住上次登入的玩家；分數先存在手機，恢復連線後自動補送排行榜
- 「安裝到主畫面」按鈕：Android / 桌機 Chrome 直接安裝，iPhone 顯示 Safari 加入主畫面步驟
- 下載完成提示「沒有網路也能玩」；有新版本時提示更新，不在遊戲中途自動重新整理
