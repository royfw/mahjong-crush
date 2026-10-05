// 雀消 / Mahjong Crush — 純遊戲邏輯（不依賴 React，可單獨測試）

export type Suit = 'wan' | 'tong' | 'tiao'

export interface Tile {
  id: string
  suit: Suit
  value: number
}

export type Cell = Tile | null
export type Board = Cell[][]
export type Direction = 'up' | 'down' | 'left' | 'right'
export type MeldKind = 'pung' | 'chow' // 刻子 | 順子

export interface Match {
  kind: MeldKind
  cells: [number, number][]
  base: number
}

export const SIZE = 6
export const SUITS: Suit[] = ['wan', 'tong', 'tiao']
export const BASE_SCORE: Record<MeldKind, number> = { pung: 100, chow: 150 }
export const OVERLAP_BONUS = 50
export const INITIAL_TILES = 16
export const SEED_TILES = 4

// 新牌「幫忙湊牌」的機率：越高越容易消除
export const ASSIST_RATE = 0.85
// 每步新增 2 張，有此機率改為 3 張
// 協助時產生「相同牌」(刻子) 的比例，其餘為同花色 ±1~2 (順子)
export const PUNG_ASSIST = 0.5
export const THIRD_SPAWN_RATE = 0.2

type Rng = () => number

let uid = 0
export function createTile(suit: Suit, value: number): Tile {
  uid += 1
  return { id: `t${uid}`, suit, value }
}

export function emptyBoard(): Board {
  return Array.from({ length: SIZE }, () => Array<Cell>(SIZE).fill(null))
}

/** 每條線的座標，從「靠攏的那一側」開始排列 */
function lines(dir: Direction): [number, number][][] {
  const out: [number, number][][] = []
  for (let i = 0; i < SIZE; i++) {
    const line: [number, number][] = []
    for (let j = 0; j < SIZE; j++) {
      if (dir === 'left') line.push([i, j])
      else if (dir === 'right') line.push([i, SIZE - 1 - j])
      else if (dir === 'up') line.push([j, i])
      else line.push([SIZE - 1 - j, i])
    }
    out.push(line)
  }
  return out
}

/** 把所有牌往 dir 推到底（保持相對順序、不重疊） */
export function moveBoard(board: Board, dir: Direction): { board: Board; moved: boolean } {
  const next = emptyBoard()
  let moved = false
  for (const line of lines(dir)) {
    const tiles = line.map(([r, c]) => board[r][c]).filter((t): t is Tile => t !== null)
    tiles.forEach((t, k) => {
      const [r, c] = line[k]
      next[r][c] = t
      if (board[r][c] !== t) moved = true
    })
  }
  return { board: next, moved }
}

/** 消除後讓剩餘牌往本次方向靠攏（規則與移動相同） */
export function collapseBoard(board: Board, dir: Direction): Board {
  return moveBoard(board, dir).board
}

function meldOf(a: Tile, b: Tile, c: Tile): MeldKind | null {
  if (a.suit !== b.suit || b.suit !== c.suit) return null
  if (a.value === b.value && b.value === c.value) return 'pung'
  const v = [a.value, b.value, c.value].sort((x, y) => x - y)
  if (v[1] === v[0] + 1 && v[2] === v[1] + 1) return 'chow'
  return null
}

/** 只檢查水平 / 垂直連續三格 */
export function findMatches(board: Board): Match[] {
  const matches: Match[] = []
  const check = (cells: [number, number][]) => {
    const [a, b, c] = cells.map(([r, cc]) => board[r][cc])
    if (!a || !b || !c) return
    const kind = meldOf(a, b, c)
    if (kind) matches.push({ kind, cells, base: BASE_SCORE[kind] })
  }
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c <= SIZE - 3; c++)
      check([
        [r, c],
        [r, c + 1],
        [r, c + 2],
      ])
  for (let c = 0; c < SIZE; c++)
    for (let r = 0; r <= SIZE - 3; r++)
      check([
        [r, c],
        [r + 1, c],
        [r + 2, c],
      ])
  return matches
}

/** 同一張牌出現在多組牌型中的「多出來」次數（用於 Bonus） */
export function countOverlaps(matches: Match[]): number {
  const seen = new Map<string, number>()
  for (const m of matches)
    for (const [r, c] of m.cells) {
      const k = `${r},${c}`
      seen.set(k, (seen.get(k) ?? 0) + 1)
    }
  let extra = 0
  for (const n of seen.values()) extra += n - 1
  return extra
}

/** 移除所有命中的牌；同一格只會被移除一次 */
export function removeMatches(board: Board, matches: Match[]): { board: Board; removedIds: Set<string> } {
  const next = board.map((row) => row.slice())
  const removedIds = new Set<string>()
  for (const m of matches)
    for (const [r, c] of m.cells) {
      const t = next[r][c]
      if (t) {
        removedIds.add(t.id)
        next[r][c] = null
      }
    }
  return { board: next, removedIds }
}

export function calculateScore(matches: Match[], combo: number): number {
  const base = matches.reduce((s, m) => s + m.base, 0)
  const bonus = countOverlaps(matches) * OVERLAP_BONUS
  return (base + bonus) * combo
}

function randomTile(rng: Rng): Tile {
  return createTile(SUITS[Math.floor(rng() * 3)], 1 + Math.floor(rng() * 9))
}

/**
 * Demo 友善的新牌：有機率參考同一行/列上的牌，
 * 產生「相同牌」或「同花色差 1~2」的牌，讓牌型更容易成形。
 */
function assistedTile(board: Board, r: number, c: number, rng: Rng): Tile {
  if (rng() >= ASSIST_RATE) return randomTile(rng)
  const near: Tile[] = []
  const all: Tile[] = []
  for (let i = 0; i < SIZE; i++)
    for (let j = 0; j < SIZE; j++) {
      const t = board[i][j]
      if (!t) continue
      all.push(t)
      // 同行/列且距離 ≤ 2 的牌：推動後最容易湊成一組
      if ((i === r && Math.abs(j - c) <= 2) || (j === c && Math.abs(i - r) <= 2)) near.push(t)
    }
  const pool = near.length ? near : all
  if (!pool.length) return randomTile(rng)
  const ref = pool[Math.floor(rng() * pool.length)]
  if (rng() < PUNG_ASSIST) return createTile(ref.suit, ref.value)
  const offsets = [-2, -1, 1, 2].filter((d) => ref.value + d >= 1 && ref.value + d <= 9)
  return createTile(ref.suit, ref.value + offsets[Math.floor(rng() * offsets.length)])
}

/** 只在空格生成新牌 */
export function spawnTiles(board: Board, count: number, rng: Rng = Math.random): { board: Board; spawnedIds: Set<string> } {
  const next = board.map((row) => row.slice())
  const empties: [number, number][] = []
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!next[r][c]) empties.push([r, c])
  // Fisher–Yates
  for (let i = empties.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[empties[i], empties[j]] = [empties[j], empties[i]]
  }
  const spawnedIds = new Set<string>()
  for (const [r, c] of empties.slice(0, count)) {
    const t = assistedTile(next, r, c, rng)
    next[r][c] = t
    spawnedIds.add(t.id)
  }
  return { board: next, spawnedIds }
}

/** 開局：不填滿、且不會一開始就有現成的牌型 */
export function createInitialBoard(rng: Rng = Math.random): Board {
  // 先放幾張純隨機牌當「種子」確保花色多樣，其餘用協助生成，避免整盤變同一花色
  let board = emptyBoard()
  const cells = Array.from({ length: SIZE * SIZE }, (_, i) => i).sort(() => rng() - 0.5)
  for (const i of cells.slice(0, SEED_TILES)) board[Math.floor(i / SIZE)][i % SIZE] = randomTile(rng)
  board = spawnTiles(board, INITIAL_TILES - SEED_TILES, rng).board
  for (let guard = 0; guard < 200; guard++) {
    const m = findMatches(board)
    if (!m.length) break
    const [r, c] = m[0].cells[1]
    board = board.map((row) => row.slice())
    board[r][c] = randomTile(rng)
  }
  return board
}

export function isFull(board: Board): boolean {
  return board.every((row) => row.every((t) => t !== null))
}

/** 沒有可消除牌型，且四個方向都推不動 → GAME OVER */
export function checkGameOver(board: Board): boolean {
  if (findMatches(board).length) return false
  const dirs: Direction[] = ['up', 'down', 'left', 'right']
  return dirs.every((d) => !moveBoard(board, d).moved)
}
