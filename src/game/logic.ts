// 雀消 / Mahjong Crush — 純遊戲邏輯（不依賴 React，可單獨測試）

export type Suit = 'wan' | 'tong' | 'tiao'

// 特殊牌：被消掉時連帶觸發。plus 隨機多消 2 張｜row 整列｜col 整行｜cross 十字｜blast 九宮格｜suit 全盤同花
export type Power = 'plus' | 'row' | 'col' | 'cross' | 'blast' | 'suit'

export interface Tile {
  id: string
  suit: Suit
  value: number
  power?: Power
}

export type Cell = Tile | null
export type Board = Cell[][]
export type Direction = 'up' | 'down' | 'left' | 'right'
// 正規牌型：刻子 | 順子；寬鬆牌型（低分）：同號 | 雜順 | 跳號
export type MeldKind = 'pung' | 'chow' | 'triplet' | 'mixedChow' | 'skip'

export interface Match {
  kind: MeldKind
  cells: [number, number][]
  base: number
}

export const SIZE = 6
export const SUITS: Suit[] = ['wan', 'tong', 'tiao']
export const BASE_SCORE: Record<MeldKind, number> = { pung: 100, chow: 150, triplet: 60, mixedChow: 50, skip: 40 }
export const MELD_NAME: Record<MeldKind, string> = {
  pung: '刻子',
  chow: '順子',
  triplet: '同號',
  mixedChow: '雜順',
  skip: '跳號',
}
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
  const sameSuit = a.suit === b.suit && b.suit === c.suit
  const v = [a.value, b.value, c.value].sort((x, y) => x - y)
  const sameValue = v[0] === v[2]
  const run = v[1] === v[0] + 1 && v[2] === v[1] + 1
  if (sameValue) return sameSuit ? 'pung' : 'triplet' // 刻子 / 同號（同數字、花色不全相同）
  if (run) return sameSuit ? 'chow' : 'mixedChow' // 順子 / 雜順（連號、花色不全相同）
  if (sameSuit && v[1] === v[0] + 2 && v[2] === v[1] + 2) return 'skip' // 跳號：同花、差 2
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
function assistedTile(board: Board, r: number, c: number, rng: Rng, assistRate: number): Tile {
  if (rng() >= assistRate) return randomTile(rng)
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
export function spawnTiles(
  board: Board,
  count: number,
  rng: Rng = Math.random,
  assistRate = ASSIST_RATE,
  powers: PowerSpawn = DEFAULT_POWER_SPAWN,
): { board: Board; spawnedIds: Set<string> } {
  const next = board.map((row) => row.slice())
  const empties: [number, number][] = []
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!next[r][c]) empties.push([r, c])
  // Fisher–Yates
  for (let i = empties.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[empties[i], empties[j]] = [empties[j], empties[i]]
  }
  const spawnedIds = new Set<string>()
  let powerCount = next.flat().filter((t) => t?.power).length
  for (const [r, c] of empties.slice(0, count)) {
    const t = assistedTile(next, r, c, rng, assistRate)
    if (powerCount < powers.max && rng() < powers.rate) {
      t.power = rollPower(powers.weights, rng)
      powerCount++
    }
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

const DELTA: Record<Direction, [number, number]> = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }

/** 把 (r, c) 的牌和 dir 方向的鄰牌交換；鄰格超出棋盤或是空格回 null */
export function swapTiles(board: Board, r: number, c: number, dir: Direction): Board | null {
  const [dr, dc] = DELTA[dir]
  const r2 = r + dr
  const c2 = c + dc
  if (r2 < 0 || r2 >= SIZE || c2 < 0 || c2 >= SIZE || !board[r][c] || !board[r2][c2]) return null
  const next = board.map((row) => row.slice())
  ;[next[r][c], next[r2][c2]] = [next[r2][c2], next[r][c]]
  return next
}

/** 交換後能形成牌型才回傳新盤面（Candy Crush 規則），否則 null */
export function trySwap(board: Board, r: number, c: number, dir: Direction): Board | null {
  const next = swapTiles(board, r, c, dir)
  return next && findMatches(next).length ? next : null
}

function hasAnySwap(board: Board): boolean {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) if (trySwap(board, r, c, 'right') || trySwap(board, r, c, 'down')) return true
  return false
}

/** 沒有可消除牌型、四個方向都推不動、也沒有能消除的換牌 → 卡死（扣血） */
export function checkGameOver(board: Board): boolean {
  if (findMatches(board).length) return false
  const dirs: Direction[] = ['up', 'down', 'left', 'right']
  return dirs.every((d) => !moveBoard(board, d).moved) && !hasAnySwap(board)
}

/** 移除指定格子（技能 / 受傷用） */
export function removeCells(board: Board, cells: [number, number][]): { board: Board; removedIds: Set<string> } {
  return removeMatches(board, [{ kind: 'pung', cells, base: 0 }])
}

export function randomFilledCells(board: Board, count: number, rng: Rng = Math.random): [number, number][] {
  const filled: [number, number][] = []
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (board[r][c]) filled.push([r, c])
  return filled.sort(() => rng() - 0.5).slice(0, count)
}

/** 連消：連續幾步都有消除 → 分數倍率（3 連 ×2、6 連 ×3 封頂） */
export const STREAK_TIERS: { at: number; mult: number }[] = [
  { at: 6, mult: 3 },
  { at: 3, mult: 2 },
]
export function streakMultiplier(streak: number): number {
  return STREAK_TIERS.find((t) => streak >= t.at)?.mult ?? 1
}

// ── 特殊牌 ───────────────────────────────────────────

export const POWER_TILE_SCORE = 20 // 特殊牌連帶消掉的每張牌分數（再乘 Combo / 連消倍率）

export type PowerWeights = [Power, number][]
/** 新牌是特殊牌的機率與種類權重（技能等級會提高對應種類） */
export interface PowerSpawn {
  rate: number
  weights: PowerWeights
  max: number // 盤面上同時最多幾張特殊牌（超過就不再自然生成，避免滾雪球一直清盤）
}
/** 技能 Lv3 的強化效果 */
export interface PowerMods {
  blastRadius: number // 1 = 3×3、2 = 5×5
  suitAlsoNumber: boolean // 同花牌也消同數字
}
export const DEFAULT_MODS: PowerMods = { blastRadius: 1, suitAlsoNumber: false }

// 隨機出現：小效果常見、大效果少見
export const DEFAULT_POWER_SPAWN: PowerSpawn = {
  rate: 0.08,
  max: 3,
  weights: [
    ['plus', 40],
    ['row', 15],
    ['col', 15],
    ['blast', 20],
    ['suit', 10],
  ],
}
// 大消除獎勵：偏向強的效果
export const EARNED_POWER_WEIGHTS: PowerWeights = [
  ['row', 30],
  ['col', 30],
  ['blast', 30],
  ['suit', 10],
]

function rollPower(weights: [Power, number][], rng: Rng): Power {
  let n = rng() * weights.reduce((a, [, w]) => a + w, 0)
  for (const [p, w] of weights) if ((n -= w) < 0) return p
  return weights[0][0]
}

/** 特殊牌觸發時影響的格子（只回傳有牌的格子） */
function powerTargets(
  board: Board,
  power: Power,
  r: number,
  c: number,
  taken: Set<number>,
  rng: Rng,
  mods: PowerMods,
): number[] {
  const out: number[] = []
  const add = (i: number, j: number) => {
    if (i >= 0 && i < SIZE && j >= 0 && j < SIZE && board[i][j]) out.push(i * SIZE + j)
  }
  const k = mods.blastRadius
  if (power === 'row' || power === 'cross') for (let j = 0; j < SIZE; j++) add(r, j)
  if (power === 'col' || power === 'cross') for (let i = 0; i < SIZE; i++) add(i, c)
  if (power === 'blast') for (let i = r - k; i <= r + k; i++) for (let j = c - k; j <= c + k; j++) add(i, j)
  else if (power === 'suit') {
    const { suit, value } = board[r][c]!
    for (let i = 0; i < SIZE; i++)
      for (let j = 0; j < SIZE; j++) {
        const t = board[i][j]
        if (t && (t.suit === suit || (mods.suitAlsoNumber && t.value === value))) add(i, j)
      }
  } else if (power === 'plus') {
    // plus：隨機多消 2 張還沒被消的牌
    const rest: number[] = []
    for (let i = 0; i < SIZE; i++)
      for (let j = 0; j < SIZE; j++) if (board[i][j] && !taken.has(i * SIZE + j)) rest.push(i * SIZE + j)
    for (let k = 0; k < 2 && rest.length; k++) out.push(rest.splice(Math.floor(rng() * rest.length), 1)[0])
  }
  return out
}

export interface PowerHit {
  power: Power
  r: number
  c: number
}

/**
 * 從要消的格子出發，觸發其中的特殊牌；被炸到的特殊牌也會接著觸發（連鎖引爆）。
 * 回傳最終要消的格子、連帶多消的張數、觸發了哪些特殊牌。
 */
export function expandRemoval(
  board: Board,
  seeds: [number, number][],
  rng: Rng = Math.random,
  mods: PowerMods = DEFAULT_MODS,
): { cells: [number, number][]; extra: number; hits: PowerHit[] } {
  const taken = new Set<number>()
  for (const [r, c] of seeds) if (board[r][c]) taken.add(r * SIZE + c)
  const base = taken.size
  const queue = [...taken]
  const fired = new Set<number>()
  const hits: PowerHit[] = []
  while (queue.length) {
    const k = queue.shift()!
    const r = Math.floor(k / SIZE)
    const c = k % SIZE
    const t = board[r][c]
    if (!t?.power || fired.has(k)) continue
    fired.add(k)
    hits.push({ power: t.power, r, c })
    for (const n of powerTargets(board, t.power, r, c, taken, rng, mods)) {
      if (taken.has(n)) continue
      taken.add(n)
      queue.push(n)
    }
  }
  const cells = [...taken].map((k): [number, number] => [Math.floor(k / SIZE), k % SIZE])
  return { cells, extra: taken.size - base, hits }
}

/** 大消除獎勵：把離 near 最近、還不是特殊牌的牌變成特殊牌 */
export function grantPower(
  board: Board,
  near: [number, number],
  rng: Rng = Math.random,
  weights: PowerWeights = EARNED_POWER_WEIGHTS,
): Board {
  let best: [number, number] | null = null
  let bestD = Infinity
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      const t = board[r][c]
      if (!t || t.power) continue
      const d = Math.abs(r - near[0]) + Math.abs(c - near[1]) + rng() * 0.5 // 同距離時隨機
      if (d < bestD) {
        bestD = d
        best = [r, c]
      }
    }
  if (!best) return board
  const next = board.map((row) => row.slice())
  const [r, c] = best
  next[r][c] = { ...next[r][c]!, power: rollPower(weights, rng) } // 保留 id：牌不重新掛載，只長出角標
  return next
}

// ── 擠壓 ─────────────────────────────────────────────

export const SQUEEZE_TILE_SCORE = 10 // 被擠掉的每張牌分數

/**
 * 擠壓：往 dir 推不動時再推一次，每一排滿的牌把最靠牆那張擠掉。
 * 回傳被擠掉的格子；沒有任何一排是滿的回 null。
 */
export function squeezeCells(board: Board, dir: Direction): [number, number][] | null {
  const out: [number, number][] = []
  for (const line of lines(dir)) if (line.every(([r, c]) => board[r][c])) out.push(line[0])
  return out.length ? out : null
}

/** 過關選技能：把盤面上隨機 count 張一般牌變成指定的特殊牌，回傳新盤面與被變的格子 */
export function placePowers(
  board: Board,
  pick: () => Power,
  count: number,
  rng: Rng = Math.random,
): { board: Board; cells: [number, number][] } {
  const plain: [number, number][] = []
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) if (board[r][c] && !board[r][c]!.power) plain.push([r, c])
  const next = board.map((row) => row.slice())
  const cells: [number, number][] = []
  for (let k = 0; k < count && plain.length; k++) {
    const [r, c] = plain.splice(Math.floor(rng() * plain.length), 1)[0]
    next[r][c] = { ...next[r][c]!, power: pick() }
    cells.push([r, c])
  }
  return { board: next, cells }
}

export function weightedPower(weights: PowerWeights, rng: Rng = Math.random): Power {
  return rollPower(weights, rng)
}

// ── 清盤 ─────────────────────────────────────────────
// 特殊牌連鎖可能把整盤消光；空盤沒有任何方向能推，不能被當成卡死

export const CLEAR_BOARD_BONUS = 300
export const REFILL_TILES = 10

export const isEmpty = (board: Board) => board.every((row) => row.every((t) => t === null))
