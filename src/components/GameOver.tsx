interface Props {
  score: number
  best: number
  level: number
  isRecord: boolean
  result: { rank: number; total: number } | null
  onRestart: () => void
  onOpenBoard?: () => void
}

export function GameOver({ score, best, level, isRecord, result, onRestart, onOpenBoard }: Props) {
  return (
    <div className="overlay">
      <div className="overlay-card">
        <div className="overlay-title">GAME OVER</div>
        {isRecord && <div className="overlay-record">🀄 新紀錄！</div>}
        <div className="overlay-line">
          到達 <b>LV {level}</b>
        </div>
        <div className="overlay-line">
          Score: <b>{score.toLocaleString()}</b>
        </div>
        <div className="overlay-line">
          Best: <b>{best.toLocaleString()}</b>
        </div>
        {result && (
          <div className="overlay-rank">
            排行榜第 <b>{result.rank}</b> 名 / {result.total} 人
          </div>
        )}
        <div className="overlay-actions">
          <button className="btn primary" onClick={onRestart} autoFocus>
            再玩一次
          </button>
          {onOpenBoard && (
            <button className="btn link" onClick={onOpenBoard}>
              看排行榜
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
