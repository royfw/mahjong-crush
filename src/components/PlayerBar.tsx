import type { PlayerApi } from './usePlayer'

interface Props {
  p: PlayerApi
  muted: boolean
  onToggleMute: () => void
  onOpenBoard: () => void
}

export function PlayerBar({ p, muted, onToggleMute, onOpenBoard }: Props) {
  return (
    <div className="playerbar">
      <button className="player-chip" onClick={onOpenBoard} disabled={p.status === 'offline'}>
        <span className="avatar">{p.player ? p.player.name.slice(0, 1) : '?'}</span>
        <span className="player-name">{p.player?.name ?? (p.status === 'offline' ? '離線模式' : '未登入')}</span>
        {p.status === 'offline' ? (
          <span className="player-offline">離線</span>
        ) : (
          p.rank && <span className="player-rank">#{p.rank}</span>
        )}
      </button>
      <button className="icon-btn" onClick={onOpenBoard} disabled={p.status === 'offline'} aria-label="排行榜">
        🏆
      </button>
      <button className="icon-btn" onClick={onToggleMute} aria-label={muted ? '開啟音效與震動' : '關閉音效與震動'}>
        {muted ? '🔇' : '🔊'}
      </button>
    </div>
  )
}
