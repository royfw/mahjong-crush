import { useCallback, useEffect, useRef, useState } from 'react'
import { api, getFingerprint, type Player } from '../game/player'

export type PlayerStatus = 'loading' | 'new' | 'ready' | 'offline'

// 離線支援：記住上次登入的玩家；離線時的分數先排隊，恢復連線後補送（伺服器只保留最高分，所以只需存最高的一筆）
const PLAYER_KEY = 'mahjong-crush-player'
const PENDING_KEY = 'mahjong-crush-pending'

interface Pending {
  score: number
  level: number
}

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function save(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* 無痕模式等：忽略 */
  }
}

export function usePlayer() {
  const [fp, setFp] = useState(() => getFingerprint())
  const [player, setPlayerState] = useState<Player | null>(() => {
    const cached = load<Player>(PLAYER_KEY)
    return cached?.id === getFingerprint() ? cached : null
  })
  const [status, setStatus] = useState<PlayerStatus>('loading')
  const [rank, setRank] = useState<number | null>(null)
  const [retry, setRetry] = useState(0)

  const setPlayer = useCallback((p: Player | null) => {
    setPlayerState(p)
    save(PLAYER_KEY, p)
  }, [])

  const flushing = useRef(false)
  const flushPending = useCallback(
    async (id: string) => {
      const pending = load<Pending>(PENDING_KEY)
      if (!pending || flushing.current) return
      flushing.current = true
      try {
        const r = await api.submit(id, pending.score, pending.level)
        save(PENDING_KEY, null)
        setPlayer(r.player)
        setRank(r.rank || null)
      } catch {
        /* 仍然離線：留著下次再送 */
      } finally {
        flushing.current = false
      }
    },
    [setPlayer],
  )

  useEffect(() => {
    let cancelled = false
    api
      .me(fp)
      .then((p) => {
        if (cancelled) return
        setPlayer(p)
        setStatus(p ? 'ready' : 'new')
        if (p) void flushPending(fp)
      })
      .catch(() => {
        // 沒網路，或沒有 API（純靜態部署）：離線模式，照樣能玩；保留快取的玩家資料
        if (!cancelled) setStatus('offline')
      })
    return () => {
      cancelled = true
    }
  }, [fp, retry, setPlayer, flushPending])

  // 恢復連線時重新確認玩家並補送分數
  useEffect(() => {
    const onOnline = () => setRetry((n) => n + 1)
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  const register = useCallback(
    async (name: string) => {
      const p = await api.register(fp, name)
      setPlayer(p)
      setStatus('ready')
    },
    [fp, setPlayer],
  )

  const rename = useCallback(
    async (name: string) => {
      setPlayer(await api.rename(fp, name))
    },
    [fp, setPlayer],
  )

  /** 刪除自己：伺服器移除 + 換新 fingerprint 種子 → 下次是全新玩家 */
  const remove = useCallback(async () => {
    await api.remove(fp)
    setPlayer(null)
    save(PENDING_KEY, null)
    setRank(null)
    setFp(getFingerprint(true))
  }, [fp, setPlayer])

  const queue = (score: number, level: number) => {
    const prev = load<Pending>(PENDING_KEY)
    if (!prev || score > prev.score) save(PENDING_KEY, { score, level })
  }

  /** 回傳排名結果；離線時排隊等連線後補送，回傳 'queued' */
  const submit = useCallback(
    async (score: number, level: number) => {
      if (score <= 0 || !player) return null
      if (status !== 'ready') {
        queue(score, level)
        return 'queued' as const
      }
      try {
        const r = await api.submit(fp, score, level)
        setPlayer(r.player)
        setRank(r.rank || null)
        return r
      } catch {
        queue(score, level)
        setStatus('offline')
        return 'queued' as const
      }
    },
    [fp, status, player, setPlayer],
  )

  return { fp, player, status, rank, setRank, register, rename, remove, submit }
}

export type PlayerApi = ReturnType<typeof usePlayer>
