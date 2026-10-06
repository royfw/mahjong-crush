# 雀消 / Mahjong Crush

2048 的上下左右滑動 + 麻將牌型消除 + Combo 計分的 Web 小遊戲。

## 玩法

- ← ↑ → ↓ / WASD / 手機 Swipe：所有牌往該方向推到底
- 水平或垂直連續三張湊成牌型即消除
  - 刻子（三張相同，如 3萬 3萬 3萬）+100
  - 順子（同花色連號，如 4筒 6筒 5筒）+150
- 消除後剩餘牌再次靠攏，形成連鎖 → Combo ×2、×3…（得分 × Combo）
- 連消：連續 3 步都有消除 → 分數 ×2，6 步以上 ×3
- 每關達到目標分數即過關，三選一技能（💣 炸彈 / 🧹 剷除 / ✨ 消除 / ❤️ 強身），重複選可升級
- 棋盤卡死：有技能先用技能，沒有就扣 1 顆心並清掉 10 張牌；血量歸零才 GAME OVER
- 音效（Web Audio 合成）與震動（Android；iOS Safari 不支援 Vibration API），右上角可關閉

## 開發

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

- 遊戲邏輯（純函式）：`src/game/logic.ts`、技能 / 關卡：`src/game/skills.ts`
- 音效 / 震動：`src/game/feedback.ts`
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

## 開發紀錄

使用 [Changesets](https://github.com/changesets/changesets)：改動時新增 `.changeset/*.md`，發版執行 `npm run version`。
