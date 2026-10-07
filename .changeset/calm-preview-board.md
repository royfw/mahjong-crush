---
"mahjong-crush": patch
---

fix(api): 預覽版排行榜與正式站分開

Redis 鍵依 `VERCEL_ENV` 加前綴：正式站維持 `mc:`（既有資料不搬動），預覽版用 `mc:preview:`，其他環境用 `mc:dev:`。預覽版玩的分數不再出現在正式排行榜。
