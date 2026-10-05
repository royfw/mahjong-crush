---
"mahjong-crush": minor
---

feat(game): 雀消 / Mahjong Crush 可玩 MVP

- 6×6 棋盤，方向鍵 / WASD / 手機 Swipe 推動所有麻將牌（萬、筒、條 1–9）
- 水平 / 垂直連續三格判定：刻子 +100、順子 +150（順子不限排列順序）
- 同一張牌屬於多組牌型只消除一次，並給予重疊 Bonus +50
- 消除後往操作方向靠攏並連鎖判定，Combo ×N 倍率計分與畫面中央動畫
- 開局 16 張、每步新增 2～3 張（只生成於空格），Demo 友善的協助生成提高成形機率
- 棋盤無牌型且四方向都推不動即 GAME OVER；Best Score 以 localStorage 保存
- 深色霓虹東方風 UI：牌滑動、消除縮放淡出、浮動得分、新牌彈出、Game Over Overlay
- 動畫流程期間鎖定輸入，避免快速連按破壞棋盤狀態
