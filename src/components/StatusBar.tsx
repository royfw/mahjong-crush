import { streakMultiplier } from '../game/logic'

interface Props {
  level: number
  progress: number
  target: number
  hp: number
  maxHp: number
  hurtKey: number
  streak: number
  movesLeft: number
}

export function StatusBar({ level, progress, target, hp, maxHp, hurtKey, streak, movesLeft }: Props) {
  const pct = Math.min(100, (progress / target) * 100)
  const mult = streakMultiplier(streak)
  return (
    <div className="status">
      <div className="level-badge">LV {level}</div>
      <div
        key={`moves-${movesLeft}`}
        className={`moves${movesLeft <= 5 ? ' low' : ''}`}
        title="本關剩餘步數；用完還沒到目標分數會扣 1 顆心、本關重來"
      >
        剩 <b>{movesLeft}</b> 步
      </div>
      {streak >= 2 && (
        <div key={`streak-${streak}`} className={`streak${mult > 1 ? ' hot' : ''}`} title="連續消除的步數">
          {streak} 連消{mult > 1 && <b> ×{mult}</b>}
        </div>
      )}
      <div className="progress" title={`${progress} / ${target}`}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
        <span className="progress-text">
          {Math.min(progress, target).toLocaleString()} / {target.toLocaleString()}
        </span>
      </div>
      <div key={hurtKey} className={`hearts${hurtKey ? ' hit' : ''}`} aria-label={`HP ${hp}/${maxHp}`}>
        {Array.from({ length: maxHp }, (_, i) => (
          <span key={i} className={i < hp ? 'heart on' : 'heart off'}>
            ❤
          </span>
        ))}
      </div>
    </div>
  )
}
