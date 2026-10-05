import { useCallback, useEffect, useRef, useState } from 'react'
import {
  SIZE,
  THIRD_SPAWN_RATE,
  calculateScore,
  checkGameOver,
  collapseBoard,
  createInitialBoard,
  findMatches,
  moveBoard,
  removeMatches,
  spawnTiles,
  type Board as BoardData,
  type Direction,
} from '../game/logic'
import { Board, type FloatText } from './Board'
import { GameOver } from './GameOver'
import { ScoreBoard } from './ScoreBoard'
import { MiniTile } from './Tile'

// 動畫時間（需與 CSS 對應）
const SLIDE_MS = 150
const CLEAR_MS = 320
const SPAWN_MS = 180

const BEST_KEY = 'mahjong-crush-best'
const KEY_DIR: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))

function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0
  } catch {
    return 0
  }
}

export function Game() {
  const [board, setBoard] = useState<BoardData>(createInitialBoard)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(loadBest)
  const [clearing, setClearing] = useState<Set<string>>(new Set())
  const [floats, setFloats] = useState<FloatText[]>([])
  const [combo, setCombo] = useState<{ n: number; key: number } | null>(null)
  const [over, setOver] = useState(false)
  const [shake, setShake] = useState(false)
  const [bump, setBump] = useState(0)
  const [isRecord, setIsRecord] = useState(false)

  // 真實狀態放 ref：動畫流程中途不受 React 批次更新影響
  const boardRef = useRef(board)
  const scoreRef = useRef(0)
  const bestRef = useRef(best)
  const startBestRef = useRef(best)
  const busyRef = useRef(false)
  const genRef = useRef(0) // 重開局時讓進行中的流程失效
  const floatId = useRef(0)

  const commit = (b: BoardData) => {
    boardRef.current = b
    setBoard(b)
  }

  const addScore = (pts: number) => {
    scoreRef.current += pts
    setScore(scoreRef.current)
    setBump((n) => n + 1)
    if (scoreRef.current > bestRef.current) {
      bestRef.current = scoreRef.current
      setBest(bestRef.current)
      try {
        localStorage.setItem(BEST_KEY, String(bestRef.current))
      } catch {
        /* 無痕模式等情況：忽略 */
      }
    }
  }

  const handleMove = useCallback(async (dir: Direction) => {
    if (busyRef.current) return
    const gen = genRef.current
    const alive = () => gen === genRef.current

    const { board: moved, moved: ok } = moveBoard(boardRef.current, dir)
    if (!ok) {
      setShake(true)
      setTimeout(() => setShake(false), 200)
      return
    }

    busyRef.current = true
    let b = moved
    let chain = 0
    commit(b)
    await sleep(SLIDE_MS)

    // 消除 → 靠攏 → 再檢查，直到沒有牌型
    const resolve = async () => {
      for (;;) {
        if (!alive()) return
        const matches = findMatches(b)
        if (!matches.length) return
        chain += 1
        const pts = calculateScore(matches, chain)
        const { board: removed, removedIds } = removeMatches(b, matches)

        // 浮動分數放在所有命中格的中心
        const cells = matches.flatMap((m) => m.cells)
        const cx = cells.reduce((s, [, c]) => s + c + 0.5, 0) / cells.length / SIZE
        const cy = cells.reduce((s, [r]) => s + r + 0.5, 0) / cells.length / SIZE
        const id = ++floatId.current
        setFloats((f) => [...f, { id, x: cx, y: cy, text: `+${pts.toLocaleString()}` }])
        setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 900)

        setClearing(removedIds)
        if (chain >= 2) setCombo({ n: chain, key: id })
        addScore(pts)
        await sleep(CLEAR_MS)
        if (!alive()) return

        setClearing(new Set())
        b = collapseBoard(removed, dir)
        commit(b)
        await sleep(SLIDE_MS)
      }
    }

    await resolve()
    if (!alive()) return

    const count = 2 + (Math.random() < THIRD_SPAWN_RATE ? 1 : 0)
    b = spawnTiles(b, count).board
    commit(b)
    await sleep(SPAWN_MS)
    await resolve() // 新牌剛好湊成也算（連鎖繼續）
    if (!alive()) return

    if (checkGameOver(b)) {
      setIsRecord(scoreRef.current > startBestRef.current && scoreRef.current > 0)
      setOver(true)
    }
    busyRef.current = false
  }, [])

  const restart = useCallback(() => {
    genRef.current += 1
    busyRef.current = false
    scoreRef.current = 0
    startBestRef.current = bestRef.current
    setScore(0)
    setClearing(new Set())
    setFloats([])
    setCombo(null)
    setOver(false)
    setIsRecord(false)
    commit(createInitialBoard())
  }, [])

  // 鍵盤
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dir = KEY_DIR[e.key] ?? KEY_DIR[e.key.toLowerCase()]
      if (!dir) return
      e.preventDefault()
      if (!e.repeat) handleMove(dir)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleMove])

  // 手機滑動
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchStart.current
    touchStart.current = null
    if (!s) return
    const t = e.changedTouches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return
    handleMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')
  }

  return (
    <div className="game">
      <header className="header">
        <div className="brand">
          <h1 className="title">雀消</h1>
          <div className="subtitle">MAHJONG CRUSH</div>
        </div>
        <ScoreBoard score={score} best={best} bump={bump} />
      </header>

      <div className="board-wrap">
        <Board
          board={board}
          clearing={clearing}
          floats={floats}
          shake={shake}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {combo && (
            <div key={combo.key} className="combo" onAnimationEnd={() => setCombo(null)}>
              COMBO ×{combo.n}!
            </div>
          )}
          {over && <GameOver score={score} best={best} isRecord={isRecord} onRestart={restart} />}
        </Board>
      </div>

      <footer className="help">
        <p className="hint">滑動牌面，湊出順子或刻子！</p>
        <div className="rules">
          <div className="rule">
            <div className="rule-tiles">
              <MiniTile suit="wan" value={3} />
              <MiniTile suit="wan" value={3} />
              <MiniTile suit="wan" value={3} />
            </div>
            <span>刻子 <b>+100</b></span>
          </div>
          <div className="rule">
            <div className="rule-tiles">
              <MiniTile suit="tong" value={4} />
              <MiniTile suit="tong" value={5} />
              <MiniTile suit="tong" value={6} />
            </div>
            <span>順子 <b>+150</b></span>
          </div>
        </div>
        <p className="keys">
          ← ↑ → ↓ / WASD / Swipe　·　連鎖消除 Combo 倍率加乘
          <button className="btn ghost" onClick={restart}>
            重新開始
          </button>
        </p>
      </footer>
    </div>
  )
}
