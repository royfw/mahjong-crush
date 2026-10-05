# 雀消 / Mahjong Crush

2048 的上下左右滑動 + 麻將牌型消除 + Combo 計分的 Web 小遊戲。

## 玩法

- ← ↑ → ↓ / WASD / 手機 Swipe：所有牌往該方向推到底
- 水平或垂直連續三張湊成牌型即消除
  - 刻子（三張相同，如 3萬 3萬 3萬）+100
  - 順子（同花色連號，如 4筒 6筒 5筒）+150
- 消除後剩餘牌再次靠攏，形成連鎖 → Combo ×2、×3…（得分 × Combo）
- 每步新增 2～3 張牌，棋盤滿且無法再動 → GAME OVER

## 開發

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

- 遊戲邏輯（純函式）：`src/game/logic.ts`
- UI：`src/components/`（Game / Board / Tile / ScoreBoard / GameOver）
- 難度調整：`logic.ts` 中的 `ASSIST_RATE`、`PUNG_ASSIST`、`THIRD_SPAWN_RATE`

## 開發紀錄

使用 [Changesets](https://github.com/changesets/changesets)：改動時新增 `.changeset/*.md`，發版執行 `npm run version`。
