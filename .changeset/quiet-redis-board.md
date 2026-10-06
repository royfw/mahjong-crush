---
"mahjong-crush": minor
---

feat(api): 排行榜支援 Vercel + Upstash Redis

- 排行榜邏輯抽成 `server/core.ts`，儲存層介面化：本機 JSON 檔、線上 Upstash Redis
- 新增 Vercel Function `api/handler.ts`，`vercel.json` 把 `/api/*` rewrite 過去；API 格式不變，前端不需修改
- Redis 以 hash 存玩家、sorted set 排名（同分先達成者在前）
- 寫入操作加上每 IP 每分鐘 30 次的頻率限制
- 支援 `KV_REST_API_*` 與 `UPSTASH_REDIS_REST_*` 兩種環境變數命名
