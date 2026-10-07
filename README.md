# 雀消 / Mahjong Crush

2048 的上下左右滑動 + 麻將牌型消除 + Combo 計分的 Web 小遊戲。

## 玩法

- ← ↑ → ↓ / WASD / 手機 Swipe：所有牌往該方向推到底
- 水平或垂直連續三張湊成牌型即消除
  - 刻子（三張相同，如 3萬 3萬 3萬）+100
  - 順子（同花色連號，如 4筒 6筒 5筒）+150
- 不同花也能消（分數較低）：同號（7萬 7筒 7條）+60、雜順（3萬 4筒 5條）+50、跳號（2條 4條 6條）+40
- 推一張牌（手指從那張牌滑出、或滑鼠拖曳）：和鄰牌交換後能湊成牌型就換；不能就照舊整盤推。換牌次數上限 3，推整盤 5 次回 1 次，過關補滿
- 消除後剩餘牌再次靠攏，形成連鎖 → Combo ×2、×3…（得分 × Combo）
- 連消：連續 3 步都有消除 → 分數 ×2，6 步以上 ×3
- 每關達到目標分數即過關，三選一技能（💣 炸彈 / 🧹 剷除 / ✨ 消除 / ❤️ 強身），重複選可升級
- 棋盤卡死：有技能先用技能，沒有就扣 1 顆心並清掉 10 張牌；血量歸零才 GAME OVER
- 音效（Web Audio 合成）與震動（Android；iOS Safari 不支援 Vibration API），右上角可關閉

## 安裝到手機、離線玩

這是一個 PWA：用手機瀏覽器開過一次後，整個遊戲（程式、字型、圖示）就會存在手機裡，之後沒有網路也能玩，例如在飛機上。

- **iPhone**：用 Safari 開啟 → 分享 → 加入主畫面
- **Android / 桌機 Chrome**：點遊戲下方的「安裝到主畫面」，或網址列的安裝圖示
- 離線時分數會先存在手機，恢復連線後自動上傳到排行榜（只保留最高分）
- 有新版本時畫面會提示「更新」，不會在遊戲中途自動重新整理；開啟時、每小時、切回 App 時都會檢查

## 開發

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

- 遊戲邏輯（純函式）：`src/game/logic.ts`、技能 / 關卡：`src/game/skills.ts`
- 音效 / 震動：`src/game/feedback.ts`
- PWA（安裝提示、更新提示）：`src/components/Pwa.tsx`；設定在 `vite.config.ts` 的 `VitePWA`
- 字型自帶於 `public/fonts/`：Noto Serif TC 只含介面用到的字與常用字（約 120 KB / 字重），其他字退回系統字型
- 玩家識別與排行榜：`src/game/player.ts`（瀏覽器 fingerprint + 本機種子）、API：`server/`、`api/`
- UI：`src/components/`（Game / Board / Tile / ScoreBoard / GameOver）
- 難度調整：`logic.ts` 中的 `ASSIST_RATE`、`PUNG_ASSIST`、`THIRD_SPAWN_RATE`

## 排行榜 API

邏輯集中在 `server/core.ts`，儲存層可替換：

| 環境 | 入口 | 儲存 |
|---|---|---|
| 本機 `npm run dev` / `npm run preview` | Vite plugin（`server/leaderboard.ts`） | `data/players.json`（已 gitignore） |
| Vercel | `api/handler.ts`（`vercel.json` 把 `/api/*` rewrite 過去） | Upstash Redis（`server/store-redis.ts`） |

Vercel 需要在專案 **Storage** 加入 Upstash Redis，會自動注入 `KV_REST_API_URL` / `KV_REST_API_TOKEN`（`UPSTASH_REDIS_REST_*` 亦可）。
沒有 API 時（例如純靜態部署）前端自動切換為離線模式，遊戲照常可玩。
寫入操作有每 IP 每分鐘 30 次的頻率限制；分數只做範圍檢查，不防有心作弊。

| Method | Path | 說明 |
|---|---|---|
| GET | `/api/me?id=` | 取得玩家（未註冊回 `null`） |
| POST | `/api/register` | `{ id, name }` 註冊 / 登入 |
| PATCH | `/api/me` | `{ id, name }` 改名 |
| DELETE | `/api/me` | `{ id }` 刪除自己 |
| POST | `/api/score` | `{ id, score, level }` 提交分數（只保留最高） |
| GET | `/api/leaderboard?id=` | 前 20 名 + 自己的名次 |

## 給玩家的更新內容

每次改版在 `src/game/changelog.ts` 最上面加一筆（玩家看得懂的白話，不寫技術細節）。
玩家更新到新版後會自動跳出一次，右上角 📢 也隨時可以查看。這份和下面的 changeset 開發紀錄分開維護。

## 開發紀錄

使用 [Changesets](https://github.com/changesets/changesets)：改動時新增 `.changeset/*.md`，發版執行 `npm run version`。
