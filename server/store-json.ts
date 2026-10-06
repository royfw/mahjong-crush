// 本機開發用儲存：記憶體 + JSON 檔（單一行程，原子寫入）
import fs from 'node:fs'
import path from 'node:path'
import { rankScore, type Player, type Store } from './core.js'

export function jsonStore(file: string): Store {
  let players: Record<string, Player> = {}
  try {
    players = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    players = {}
  }
  const counters = new Map<string, { n: number; until: number }>()

  const save = () => {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const tmp = `${file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(players, null, 2))
    fs.renameSync(tmp, file) // 原子寫入，避免寫到一半壞檔
  }
  const ranked = () =>
    Object.values(players)
      .filter((p) => p.best > 0)
      .sort((a, b) => rankScore(b) - rankScore(a))

  return {
    async get(id) {
      return players[id] ? { ...players[id] } : null
    },
    async put(p) {
      players[p.id] = { ...p }
      save()
    },
    async remove(id) {
      delete players[id]
      save()
    },
    async top(n) {
      return ranked().slice(0, n)
    },
    async rankOf(id) {
      const list = ranked()
      const i = list.findIndex((p) => p.id === id)
      return i >= 0 ? { rank: i + 1, total: list.length } : null
    },
    async total() {
      return ranked().length
    },
    async hit(key, windowSec) {
      const now = Date.now()
      const c = counters.get(key)
      if (!c || c.until < now) {
        counters.set(key, { n: 1, until: now + windowSec * 1000 })
        return 1
      }
      return ++c.n
    },
  }
}
