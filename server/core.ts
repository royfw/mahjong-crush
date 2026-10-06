// 排行榜 API 核心：與執行環境無關（Vite dev server / Vercel Functions 共用）
// 只為 Demo：沒有帳密，玩家以瀏覽器 fingerprint 識別；只做輕量的頻率限制

export interface Player {
  id: string
  name: string
  best: number
  bestLevel: number
  games: number
  createdAt: number
  updatedAt: number
}

/** 儲存層介面：本機用 JSON 檔、線上用 Redis */
export interface Store {
  get(id: string): Promise<Player | null>
  /** 寫入玩家並同步排名 */
  put(p: Player): Promise<void>
  remove(id: string): Promise<void>
  /** 分數 > 0 的前 n 名（高分在前，同分先達成者在前） */
  top(n: number): Promise<Player[]>
  /** 名次（1 起算）與上榜總人數；沒上榜回 null */
  rankOf(id: string): Promise<{ rank: number; total: number } | null>
  total(): Promise<number>
  /** 固定視窗計數器：回傳本視窗內第幾次 */
  hit(key: string, windowSec: number): Promise<number>
}

export interface ApiRequest {
  method: string
  route: string // 例如 "me"、"leaderboard"
  query: URLSearchParams
  body: Record<string, unknown>
  ip: string
}

export interface ApiResponse {
  status: number
  body: unknown
}

const ID_RE = /^fp_[0-9a-z]{8,32}$/
const NAME_MAX = 16
const TOP_N = 20
const MAX_SCORE = 10_000_000
// 每個 IP 每分鐘最多的寫入次數
const WRITE_LIMIT_PER_MIN = 30

const ok = (body: unknown): ApiResponse => ({ status: 200, body })
const fail = (status: number, error: string): ApiResponse => ({ status, body: { error } })

function cleanName(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const name = v.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX)
  return name.length ? name : null
}

/** 排名用分數：同分時越早達成越前面（小數部分隨時間遞減，不影響整數分） */
export const rankScore = (p: Player) => p.best + (2e12 - p.updatedAt) / 1e13

export async function handle(store: Store, req: ApiRequest): Promise<ApiResponse> {
  const route = `${req.method} ${req.route}`
  const id = String((req.method === 'GET' ? req.query.get('id') : req.body.id) ?? '')

  if (route === 'GET leaderboard') {
    const [top, me, total] = await Promise.all([
      store.top(TOP_N),
      ID_RE.test(id) ? store.rankOf(id) : null,
      store.total(),
    ])
    return ok({
      top: top.map((p, i) => ({ rank: i + 1, name: p.name, best: p.best, bestLevel: p.bestLevel, me: p.id === id })),
      me,
      total,
    })
  }

  if (!ID_RE.test(id)) return fail(400, '無效的玩家識別碼')

  if (req.method !== 'GET' && (await store.hit(`w:${req.ip}`, 60)) > WRITE_LIMIT_PER_MIN) {
    return fail(429, '操作太頻繁，請稍後再試')
  }

  const me = await store.get(id)

  switch (route) {
    case 'GET me':
      return ok(me)

    case 'POST register': {
      const name = cleanName(req.body.name)
      if (!name) return fail(400, '請輸入暱稱')
      const now = Date.now()
      const p = me ?? { id, name, best: 0, bestLevel: 0, games: 0, createdAt: now, updatedAt: now }
      p.name = name
      await store.put(p)
      return ok(p)
    }

    case 'PATCH me': {
      if (!me) return fail(404, '尚未註冊')
      const name = cleanName(req.body.name)
      if (!name) return fail(400, '請輸入暱稱')
      me.name = name
      await store.put(me)
      return ok(me)
    }

    case 'DELETE me':
      await store.remove(id)
      return ok({ ok: true })

    case 'POST score': {
      if (!me) return fail(404, '尚未註冊')
      const score = Math.floor(Number(req.body.score))
      const level = Math.floor(Number(req.body.level))
      if (!Number.isFinite(score) || score < 0 || score > MAX_SCORE) return fail(400, '分數格式錯誤')
      me.games += 1
      if (score > me.best) {
        me.best = score
        me.bestLevel = Number.isFinite(level) ? level : 0
        me.updatedAt = Date.now()
      }
      await store.put(me)
      const r = await store.rankOf(id)
      return ok({ player: me, rank: r?.rank ?? 0, total: r?.total ?? (await store.total()) })
    }
  }
  return fail(404, 'Not found')
}
