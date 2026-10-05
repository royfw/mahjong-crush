---
"mahjong-crush": minor
---

feat(game): 連消倍率、fingerprint 登入排行榜、音效與震動

- 連消：連續 3 步都有消除分數 ×2、6 步以上 ×3（封頂），與單步 Combo 疊加
- 瀏覽器 fingerprint + 本機種子自動識別玩家，免帳密；可改名、刪除自己（刪除後換新種子，下次為全新玩家）
- 排行榜前 20 名、自己名次與 Game Over 名次；API 以 Vite plugin 掛在 dev / preview server，資料存 `data/players.json`
- 無 API 時自動離線模式，遊戲照常可玩
- Web Audio 合成音效（推牌、消除音高隨 Combo 上升、技能、過關、受傷、Game Over）與手機震動，可一鍵靜音
- 手機：整個畫面皆可滑動操作，禁止頁面捲動與下拉重新整理；玩家 ID 固定不受螢幕旋轉影響
