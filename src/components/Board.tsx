import type { Board as BoardData } from '../game/logic'
import { SIZE } from '../game/logic'
import { Tile } from './Tile'

export interface FloatText {
  id: number
  x: number // 0~1，相對棋盤寬度
  y: number
  text: string
}

interface Props {
  board: BoardData
  clearing: Set<string>
  preview: Set<string>
  targeting: boolean
  floats: FloatText[]
  shake: boolean
  children?: React.ReactNode
  onClick: (e: React.MouseEvent) => void
  onMouseMove: (e: React.MouseEvent) => void
  onMouseLeave: () => void
}

export function Board({ board, clearing, preview, targeting, floats, shake, children, ...handlers }: Props) {
  const tiles = []
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      const t = board[r][c]
      if (t)
        tiles.push(
          <Tile key={t.id} tile={t} row={r} col={c} clearing={clearing.has(t.id)} targeted={preview.has(t.id)} />,
        )
    }
  // 依 id 排序讓 DOM 順序穩定，避免移動時重新掛載
  tiles.sort((a, b) => String(a.key).localeCompare(String(b.key)))

  return (
    <div className={`board${shake ? ' shake' : ''}${targeting ? ' targeting' : ''}`} {...handlers}>
      {Array.from({ length: SIZE * SIZE }, (_, i) => (
        <div key={i} className="cell" style={{ '--r': Math.floor(i / SIZE), '--c': i % SIZE } as React.CSSProperties} />
      ))}
      {tiles}
      {floats.map((f) => (
        <div key={f.id} className="float-score" style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%` }}>
          {f.text}
        </div>
      ))}
      {children}
    </div>
  )
}
