import { useCallback, useEffect, useState } from 'react'
import { api, getFingerprint, type Player } from '../game/player'

export type PlayerStatus = 'loading' | 'new' | 'ready' | 'offline'

export function usePlayer() {
  const [fp, setFp] = useState(() => getFingerprint())
  const [player, setPlayer] = useState<Player | null>(null)
  const [status, setStatus] = useState<PlayerStatus>('loading')
  const [rank, setRank] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    api
      .me(fp)
      .then((p) => {
        if (cancelled) return
        setPlayer(p)
        setStatus(p ? 'ready' : 'new')
      })
      .catch(() => {
        if (cancelled) return
        setPlayer(null)
        // API 不存在（例如純靜態部署）= 離線模式，照樣能玩
        setStatus('offline')
      })
    return () => {
      cancelled = true
    }
  }, [fp])

  const register = useCallback(
    async (name: string) => {
      const p = await api.register(fp, name)
      setPlayer(p)
      setStatus('ready')
    },
    [fp],
  )

  const rename = useCallback(
    async (name: string) => {
      setPlayer(await api.rename(fp, name))
    },
    [fp],
  )

  /** 刪除自己：伺服器移除 + 換新 fingerprint 種子 → 下次是全新玩家 */
  const remove = useCallback(async () => {
    await api.remove(fp)
    setPlayer(null)
    setRank(null)
    setFp(getFingerprint(true))
  }, [fp])

  const submit = useCallback(
    async (score: number, level: number) => {
      if (status !== 'ready' || score <= 0) return null
      try {
        const r = await api.submit(fp, score, level)
        setPlayer(r.player)
        setRank(r.rank || null)
        return r
      } catch {
        return null
      }
    },
    [fp, status],
  )

  return { fp, player, status, rank, setRank, register, rename, remove, submit }
}

export type PlayerApi = ReturnType<typeof usePlayer>
