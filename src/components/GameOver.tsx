interface Props {
  score: number
  best: number
  isRecord: boolean
  onRestart: () => void
}

export function GameOver({ score, best, isRecord, onRestart }: Props) {
  return (
    <div className="overlay">
      <div className="overlay-card">
        <div className="overlay-title">GAME OVER</div>
        {isRecord && <div className="overlay-record">🀄 新紀錄！</div>}
        <div className="overlay-line">
          Score: <b>{score.toLocaleString()}</b>
        </div>
        <div className="overlay-line">
          Best: <b>{best.toLocaleString()}</b>
        </div>
        <button className="btn primary" onClick={onRestart} autoFocus>
          再玩一次
        </button>
      </div>
    </div>
  )
}
