// 本機開發：把排行榜 API 掛在 Vite dev / preview server 上，資料存 data/players.json
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect, Plugin } from 'vite'
import { handle } from './core.js'
import { jsonStore } from './store-json.js'

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
  const store = jsonStore(file)

  const handler: Connect.NextHandleFunction = async (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://local')
    if (!url.pathname.startsWith('/api/')) return next()
    const method = req.method ?? 'GET'
    try {
      const r = await handle(store, {
        method,
        route: url.pathname.slice('/api/'.length),
        query: url.searchParams,
        body: method === 'GET' ? {} : await readBody(req),
        ip: req.socket.remoteAddress ?? 'local',
      })
      send(res, r.status, r.body)
    } catch (e) {
      send(res, 500, { error: e instanceof Error ? e.message : '伺服器錯誤' })
    }
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
