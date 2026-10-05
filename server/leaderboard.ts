// 極簡排行榜 API：以 Vite plugin 掛在 dev / preview server 上，資料存 JSON 檔
// 只為 Demo：沒有防作弊、沒有帳密，玩家以瀏覽器 fingerprint 識別
import fs from 'node:fs'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect, Plugin } from 'vite'

export interface Player {
  id: string
  name: string
  best: number
  bestLevel: number
  games: number
  createdAt: number
  updatedAt: number
}

const ID_RE = /^fp_[0-9a-z]{8,32}$/
const NAME_MAX = 16
const TOP_N = 20

function createStore(file: string) {
  let players: Record<string, Player> = {}
  try {
    players = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    players = {}
  }
  const save = () => {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const tmp = `${file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(players, null, 2))
    fs.renameSync(tmp, file) // 原子寫入，避免寫到一半壞檔
  }
  return { players, save }
}

function cleanName(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const name = v.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX)
  return name.length ? name : null
}

function ranked(players: Record<string, Player>) {
  return Object.values(players)
    .filter((p) => p.best > 0)
    .sort((a, b) => b.best - a.best || a.updatedAt - b.updatedAt)
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (c) => {
      raw += c
      if (raw.length > 10_000) req.destroy()
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        resolve({})
      }
    })
  })
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export function leaderboardApi(file = path.resolve('data/players.json')): Plugin {
  const store = createStore(file)
  const { players } = store

  const handler: Connect.NextHandleFunction = async (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://local')
    if (!url.pathname.startsWith('/api/')) return next()
    const route = `${req.method} ${url.pathname}`
    const body = req.method === 'GET' ? {} : await readBody(req)
    const id = String((req.method === 'GET' ? url.searchParams.get('id') : body.id) ?? '')

    if (route === 'GET /api/leaderboard') {
      const list = ranked(players)
      const myRank = list.findIndex((p) => p.id === id)
      return send(res, 200, {
        top: list
          .slice(0, TOP_N)
          .map((p, i) => ({ rank: i + 1, name: p.name, best: p.best, bestLevel: p.bestLevel, me: p.id === id })),
        me: myRank >= 0 ? { rank: myRank + 1, total: list.length } : null,
        total: list.length,
      })
    }

    if (!ID_RE.test(id)) return send(res, 400, { error: '無效的玩家識別碼' })
    const me = players[id]

    switch (route) {
      case 'GET /api/me':
        return send(res, 200, me ?? null)

      case 'POST /api/register': {
        const name = cleanName(body.name)
        if (!name) return send(res, 400, { error: '請輸入暱稱' })
        const now = Date.now()
        players[id] = me ?? { id, name, best: 0, bestLevel: 0, games: 0, createdAt: now, updatedAt: now }
        players[id].name = name
        store.save()
        return send(res, 200, players[id])
      }

      case 'PATCH /api/me': {
        if (!me) return send(res, 404, { error: '尚未註冊' })
        const name = cleanName(body.name)
        if (!name) return send(res, 400, { error: '請輸入暱稱' })
        me.name = name
        me.updatedAt = Date.now()
        store.save()
        return send(res, 200, me)
      }

      case 'DELETE /api/me':
        delete players[id]
        store.save()
        return send(res, 200, { ok: true })

      case 'POST /api/score': {
        if (!me) return send(res, 404, { error: '尚未註冊' })
        const score = Math.floor(Number(body.score))
        const level = Math.floor(Number(body.level))
        if (!Number.isFinite(score) || score < 0 || score > 10_000_000) return send(res, 400, { error: '分數格式錯誤' })
        me.games += 1
        if (score > me.best) {
          me.best = score
          me.bestLevel = Number.isFinite(level) ? level : 0
          me.updatedAt = Date.now()
        }
        store.save()
        const list = ranked(players)
        return send(res, 200, { player: me, rank: list.findIndex((p) => p.id === id) + 1, total: list.length })
      }
    }
    return send(res, 404, { error: 'Not found' })
  }

  return {
    name: 'mahjong-crush-leaderboard',
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    },
  }
}
