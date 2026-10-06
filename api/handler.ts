// Vercel Function：所有 /api/* 經 vercel.json rewrite 到這裡，route 由 __route 參數帶入
import { handle } from '../server/core.js'
import { redisFromEnv, redisStore } from '../server/store-redis.js'

let store: ReturnType<typeof redisStore> | null = null

async function run(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const route = url.searchParams.get('__route') ?? ''
  url.searchParams.delete('__route')
  let body: Record<string, unknown> = {}
  if (request.method !== 'GET') {
    try {
      const text = await request.text()
      if (text.length <= 10_000 && text) body = JSON.parse(text)
    } catch {
      body = {}
    }
  }
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  try {
    store ??= redisStore(redisFromEnv())
    const r = await handle(store, {
      method: request.method,
      route,
      query: url.searchParams,
      body,
      ip: request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown',
    })
    return new Response(JSON.stringify(r.body), { status: r.status, headers })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: '伺服器錯誤' }), { status: 500, headers })
  }
}

export const GET = run
export const POST = run
export const PATCH = run
export const DELETE = run
