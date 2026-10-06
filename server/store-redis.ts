// 線上儲存：Upstash Redis（REST，適合 serverless）
//   mc:p:{id}  hash   玩家資料
//   mc:rank    zset   排名（score = rankScore，只放分數 > 0 的玩家）
//   mc:rl:{k}  string 頻率限制計數
import { Redis } from '@upstash/redis'
import { rankScore, type Player, type Store } from './core.js'

const P = (id: string) => `mc:p:${id}`
const RANK = 'mc:rank'

/** Vercel 的 Upstash 整合依建立方式可能給 KV_* 或 UPSTASH_* 變數，兩種都接受 */
export function redisFromEnv(env: Record<string, string | undefined> = process.env): Redis {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN
  if (!url || !token) throw new Error('缺少 Upstash Redis 環境變數（UPSTASH_REDIS_REST_URL / KV_REST_API_URL）')
  return new Redis({ url, token })
}

function toPlayer(h: Record<string, unknown> | null): Player | null {
  if (!h || !h.id) return null
  return {
    id: String(h.id),
    name: String(h.name),
    best: Number(h.best) || 0,
    bestLevel: Number(h.bestLevel) || 0,
    games: Number(h.games) || 0,
    createdAt: Number(h.createdAt) || 0,
    updatedAt: Number(h.updatedAt) || 0,
  }
}

export function redisStore(redis: Redis): Store {
  return {
    async get(id) {
      return toPlayer(await redis.hgetall<Record<string, unknown>>(P(id)))
    },
    async put(p) {
      const tx = redis.multi()
      // 名稱強制存字串，避免 Upstash 把純數字暱稱自動轉成 number
      tx.hset(P(p.id), { ...p, name: `${p.name}` })
      if (p.best > 0) tx.zadd(RANK, { score: rankScore(p), member: p.id })
      await tx.exec()
    },
    async remove(id) {
      const tx = redis.multi()
      tx.del(P(id))
      tx.zrem(RANK, id)
      await tx.exec()
    },
    async top(n) {
      const ids = await redis.zrange<string[]>(RANK, 0, n - 1, { rev: true })
      if (!ids.length) return []
      const pipe = redis.pipeline()
      for (const id of ids) pipe.hgetall(P(id))
      const rows = await pipe.exec<(Record<string, unknown> | null)[]>()
      return rows.map(toPlayer).filter((p): p is Player => p !== null)
    },
    async rankOf(id) {
      const [rank, total] = await Promise.all([redis.zrevrank(RANK, id), redis.zcard(RANK)])
      return rank === null ? null : { rank: rank + 1, total }
    },
    async total() {
      return redis.zcard(RANK)
    },
    async hit(key, windowSec) {
      const k = `mc:rl:${key}`
      const tx = redis.multi()
      tx.incr(k)
      tx.expire(k, windowSec, 'NX')
      const [n] = await tx.exec<[number, number]>()
      return n
    },
  }
}
