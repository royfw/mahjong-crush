// 玩家識別：瀏覽器 fingerprint + 本機隨機種子
// - 只用裝置訊號：同型號手機（例如兩支同款 iPhone）會撞成同一人，所以加上本機種子
// - 刪除自己 = 伺服器刪資料 + 換新種子 → 下次就是全新玩家
// - 區網 http 不是 secure context，無法用 crypto.subtle，改用純 JS hash

const SEED_KEY = 'mahjong-crush-seed'
const ID_KEY = 'mahjong-crush-id'

export interface Player {
  id: string
  name: string
  best: number
  bestLevel: number
  games: number
}

export interface RankRow {
  rank: number
  name: string
  best: number
  bestLevel: number
  me: boolean
}

export interface Leaderboard {
  top: RankRow[]
  me: { rank: number; total: number } | null
  total: number
}

/** cyrb53：快速、分佈不錯的 53-bit 字串 hash */
function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

function canvasSignal(): string {
  try {
    const c = document.createElement('canvas')
    c.width = 200
    c.height = 40
    const x = c.getContext('2d')
    if (!x) return ''
    x.textBaseline = 'top'
    x.font = '16px serif'
    x.fillStyle = '#c8232c'
    x.fillText('雀消 Mahjong 🀄 123', 2, 2)
    x.fillStyle = 'rgba(29,95,184,0.7)'
    x.fillRect(120, 10, 60, 20)
    return c.toDataURL()
  } catch {
    return ''
  }
}

function getSeed(renew = false): string {
  try {
    let seed = renew ? null : localStorage.getItem(SEED_KEY)
    if (!seed) {
      seed = Math.random().toString(36).slice(2) + Date.now().toString(36)
      localStorage.setItem(SEED_KEY, seed)
    }
    return seed
  } catch {
    return 'no-storage'
  }
}

/** 取得玩家 ID：第一次算好就存起來，避免螢幕旋轉、縮放等訊號變動造成 ID 改變 */
export function getFingerprint(renew = false): string {
  try {
    const saved = renew ? null : localStorage.getItem(ID_KEY)
    if (saved && /^fp_[0-9a-z]{8,32}$/.test(saved)) return saved
  } catch {
    /* ignore */
  }
  const id = computeFingerprint(renew)
  try {
    localStorage.setItem(ID_KEY, id)
  } catch {
    /* ignore */
  }
  return id
}

function computeFingerprint(renew: boolean): string {
  const n = navigator as Navigator & { deviceMemory?: number }
  const signals = [
    n.userAgent,
    n.language,
    n.hardwareConcurrency,
    n.deviceMemory,
    screen.width,
    screen.height,
    screen.colorDepth,
    devicePixelRatio,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    'ontouchstart' in window,
    canvasSignal(),
    getSeed(renew),
  ].join('|')
  return 'fp_' + cyrb53(signals).toString(36) + cyrb53(signals, 7).toString(36)
}

/** 顯示用短碼，例如 7K3F-Q9 */
export const shortCode = (id: string) => id.slice(3, 7).toUpperCase() + '-' + id.slice(-2).toUpperCase()

const NICKS = ['雀神', '自摸王', '槓上開花', '清一色', '聽牌中', '海底撈月', '一條龍', '碰碰胡']
export const randomNick = () => NICKS[Math.floor(Math.random() * NICKS.length)] + Math.floor(Math.random() * 900 + 100)

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  // 非 JSON（例如靜態部署回了 index.html）也視為失敗 → 離線模式
  const data = await res.json().catch(() => undefined)
  if (!res.ok || data === undefined)
    throw Object.assign(new Error(data?.error ?? `HTTP ${res.status}`), { status: res.status })
  return data as T
}

export const api = {
  me: (id: string) => call<Player | null>('GET', `/api/me?id=${encodeURIComponent(id)}`),
  register: (id: string, name: string) => call<Player>('POST', '/api/register', { id, name }),
  rename: (id: string, name: string) => call<Player>('PATCH', '/api/me', { id, name }),
  remove: (id: string) => call<{ ok: true }>('DELETE', '/api/me', { id }),
  submit: (id: string, score: number, level: number) =>
    call<{ player: Player; rank: number; total: number }>('POST', '/api/score', { id, score, level }),
  leaderboard: (id: string) => call<Leaderboard>('GET', `/api/leaderboard?id=${encodeURIComponent(id)}`),
}
