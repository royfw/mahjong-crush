interface Props {
  score: number
  best: number
  bump: number
}

export function ScoreBoard({ score, best, bump }: Props) {
  return (
    <div className="scoreboard">
      <div className="score-box">
        <div className="score-label">SCORE</div>
        <div key={bump} className="score-value bump">
          {score.toLocaleString()}
        </div>
      </div>
      <div className="score-box best">
        <div className="score-label">BEST</div>
        <div className="score-value">{best.toLocaleString()}</div>
      </div>
    </div>
  )
}
