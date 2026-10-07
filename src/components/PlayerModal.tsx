import { useEffect, useState } from 'react'
import { api, randomNick, shortCode, type Leaderboard } from '../game/player'
import { currentHowTo } from '../game/changelog'
import type { PlayerApi } from './usePlayer'

interface Props {
  p: PlayerApi
  mode: 'welcome' | 'board'
  onClose: () => void
}

export function PlayerModal({ p, mode, onClose }: Props) {
  const [name, setName] = useState(() => p.player?.name ?? randomNick())
  const [board, setBoard] = useState<Leaderboard | null>(null)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (mode !== 'board') return
    api
      .leaderboard(p.fp)
      .then((b) => {
        setBoard(b)
        p.setRank(b.me?.rank ?? null)
      })
      .catch(() => setError('排行榜載入失敗'))
  }, [mode, p.fp, p.player?.name, p.player?.best])

  const run = async (fn: () => Promise<void>) => {
    setSaving(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失敗')
    } finally {
      setSaving(false)
    }
  }

  if (mode === 'welcome') {
    return (
      <div className="modal-backdrop">
        <form
          className="modal"
          onSubmit={(e) => {
            e.preventDefault()
            void run(async () => {
              await p.register(name)
              onClose()
            })
          }}
        >
          <div className="modal-title">歡迎來到雀消</div>
          <ul className="howto compact">
            <li>
              <span className="howto-icon">🀄</span>
              <span>水平或垂直三張湊成刻子、順子就會消除</span>
            </li>
            {currentHowTo().map((h) => (
              <li key={h.text}>
                <span className="howto-icon">{h.icon}</span>
                <span>{h.text}</span>
              </li>
            ))}
          </ul>
          <p className="modal-text">取個暱稱就能上排行榜（用瀏覽器指紋自動登入，不用帳號密碼）。</p>
          <input
            className="name-input"
            value={name}
            maxLength={16}
            onChange={(e) => setName(e.target.value)}
            aria-label="暱稱"
            autoFocus
          />
          {error && <p className="modal-error">{error}</p>}
          <button className="btn primary" disabled={saving || !name.trim()}>
            開始遊戲
          </button>
          <button type="button" className="btn link" onClick={onClose}>
            先不登入，直接玩
          </button>
        </form>
      </div>
    )
  }

  const me = p.player
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wide">
        <button className="modal-close" onClick={onClose} aria-label="關閉">
          ✕
        </button>
        <div className="modal-title">排行榜</div>

        <ol className="ranks">
          {board?.top.length === 0 && <li className="ranks-empty">還沒有人上榜，打一場搶第一！</li>}
          {board?.top.map((r) => (
            <li key={r.rank} className={`rank-row${r.me ? ' me' : ''}${r.rank <= 3 ? ' podium' : ''}`}>
              <span className="rank-no">{r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}</span>
              <span className="rank-name">{r.name}</span>
              <span className="rank-lv">LV {r.bestLevel}</span>
              <span className="rank-score">{r.best.toLocaleString()}</span>
            </li>
          ))}
          {!board && !error && <li className="ranks-empty">載入中…</li>}
        </ol>
        {board?.me && board.me.rank > board.top.length && (
          <p className="modal-text">
            你目前第 {board.me.rank} 名（共 {board.me.total} 人）
          </p>
        )}

        {me ? (
          <div className="profile">
            <form
              className="rename"
              onSubmit={(e) => {
                e.preventDefault()
                void run(() => p.rename(name))
              }}
            >
              <input
                className="name-input"
                value={name}
                maxLength={16}
                onChange={(e) => setName(e.target.value)}
                aria-label="暱稱"
              />
              <button className="btn small" disabled={saving || !name.trim() || name.trim() === me.name}>
                改名
              </button>
            </form>
            <p className="profile-meta">
              最高 {me.best.toLocaleString()} 分 · 玩了 {me.games} 場 · 指紋 {shortCode(p.fp)}
            </p>
            {confirmDelete ? (
              <div className="danger-confirm">
                <span>刪除後你的紀錄會從排行榜消失，這台裝置下次會是全新玩家。</span>
                <div className="danger-actions">
                  <button className="btn small" onClick={() => setConfirmDelete(false)}>
                    保留
                  </button>
                  <button
                    className="btn small danger"
                    disabled={saving}
                    onClick={() =>
                      void run(async () => {
                        await p.remove()
                        onClose()
                      })
                    }
                  >
                    刪除我的資料
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn link danger-link" onClick={() => setConfirmDelete(true)}>
                刪除我的指紋與紀錄
              </button>
            )}
          </div>
        ) : (
          <div className="profile">
            <p className="modal-text">還沒登入，分數不會上榜。</p>
            <button
              className="btn small"
              onClick={() =>
                void run(async () => {
                  await p.register(name)
                })
              }
            >
              以「{name}」登入
            </button>
          </div>
        )}
        {error && <p className="modal-error">{error}</p>}
      </div>
    </div>
  )
}
