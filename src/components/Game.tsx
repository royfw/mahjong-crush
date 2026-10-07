import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import {
  SIZE,
  calculateScore,
  checkGameOver,
  collapseBoard,
  createInitialBoard,
  findMatches,
  moveBoard,
  randomFilledCells,
  removeCells,
  spawnTiles,
  streakMultiplier,
  trySwap,
  squeezeCells,
  SQUEEZE_TILE_SCORE,
  expandRemoval,
  grantPower,
  placePowers,
  isEmpty,
  CLEAR_BOARD_BONUS,
  REFILL_TILES,
  countOverlaps,
  POWER_TILE_SCORE,
  type PowerHit,
  MELD_NAME,
  type Board as BoardData,
  type Direction,
} from '../game/logic'
import {
  BASE_HP,
  DAMAGE_CLEAR,
  SKILLS,
  levelConfig,
  powerSetup,
  rollChoices,
  skillPlacement,
  type SkillId,
  type Skills,
  SWAP_MAX,
  SWAP_RECHARGE,
} from '../game/skills'
import { fx, isMuted, setMuted, unlockAudio } from '../game/feedback'
import { Board, type FloatText } from './Board'
import { GameOver } from './GameOver'
import { LevelUp } from './LevelUp'
import { PlayerBar } from './PlayerBar'
import { PlayerModal } from './PlayerModal'
import { NewsModal } from './NewsModal'
import {
  getSeenRelease,
  hasGameplayChange,
  latestRelease,
  markReleaseSeen,
  unseenReleases,
  type ReleaseNote,
} from '../game/changelog'
import { InstallButton, PwaPrompt } from './Pwa'
import { ScoreBoard } from './ScoreBoard'
import { SkillBar } from './SkillBar'
import { SwapMeter } from './SwapMeter'
import { StatusBar } from './StatusBar'
import { MiniTile } from './Tile'
import { usePlayer } from './usePlayer'

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
const DIRS: Direction[] = ['up', 'down', 'left', 'right']
const LONG_PRESS_MS = 280 // 長按多久算選牌
const PRESS_SLOP = 10 // 長按期間手指可容許的晃動（px）

const POWER_ICON = { plus: '➕', row: '↔', col: '↕', cross: '✚', blast: '💥', suit: '🎨' } as const
const powerIcons = (hits: PowerHit[]) =>
  hits.length ? [...new Set(hits.map((h) => POWER_ICON[h.power]))].join('') + ' ' : ''

/** 有觸發特殊牌時播最強那種的音效，否則播一般消除音 */
function playHits(hits: PowerHit[], chain: number) {
  const ps = new Set(hits.map((h) => h.power))
  if (ps.has('suit')) fx.sparkle()
  else if (ps.has('blast')) fx.bomb()
  else if (ps.has('row') || ps.has('col') || ps.has('cross')) fx.sweep()
  else fx.clear(chain)
}

function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0
  } catch {
    return 0
  }
}

interface GameState {
  board: BoardData
  score: number
  best: number
  startBest: number
  level: number
  levelStart: number // 進入本關時的分數
  hp: number
  maxHp: number
  skills: Skills
  streak: number // 連續有消除的步數
  swaps: number // 剩餘換牌次數
  slidesToRecharge: number // 再推幾次整盤回 1 次換牌
  over: boolean
}

function newGame(best: number): GameState {
  return {
    board: createInitialBoard(),
    score: 0,
    best,
    startBest: best,
    level: 1,
    levelStart: 0,
    hp: BASE_HP,
    maxHp: BASE_HP,
    skills: {},
    streak: 0,
    swaps: SWAP_MAX,
    slidesToRecharge: SWAP_RECHARGE,
    over: false,
  }
}

export function Game() {
  // 真實遊戲狀態放 ref：非同步動畫流程中途讀到的永遠是最新值；改完呼叫 render()
  const g = useRef<GameState>(null as unknown as GameState)
  if (!g.current) g.current = newGame(loadBest())
  const [, render] = useReducer((n: number) => n + 1, 0)

  // 純視覺的暫態
  const [clearing, setClearing] = useState<Set<string>>(new Set())
  const [floats, setFloats] = useState<FloatText[]>([])
  const [combo, setCombo] = useState<{ n: number; key: number } | null>(null)
  const [toast, setToast] = useState<{ text: string; key: number; tone: 'good' | 'bad' } | null>(null)
  const [shake, setShake] = useState(false)
  const [hurt, setHurt] = useState(0)
  const [bump, setBump] = useState(0)
  const [choices, setChoices] = useState<SkillId[] | null>(null)
  const [stuck, setStuck] = useState(false)
  const [muted, setMutedState] = useState(isMuted)
  const [modal, setModal] = useState<'welcome' | 'board' | 'news' | null>(null)
  const [result, setResult] = useState<{ rank: number; total: number } | 'queued' | null>(null)

  const player = usePlayer()
  const submitRef = useRef(player.submit)
  submitRef.current = player.submit
  const modalRef = useRef(modal)
  modalRef.current = modal

  // 更新內容：沒看過最新一筆就在 📢 顯示紅點
  const [hasNews, setHasNews] = useState(() => getSeenRelease() !== latestRelease())
  const [gameplayNotes, setGameplayNotes] = useState<ReleaseNote[] | undefined>()
  const openNews = () => {
    markReleaseSeen()
    setHasNews(false)
    setGameplayNotes(undefined)
    setModal('news')
  }

  // 第一次遇到新玩家：跳出取暱稱畫面（新玩家不需要看更新內容，直接記為已看過）
  // 老玩家更新到新版後：自動跳出一次更新內容
  const welcomed = useRef(false)
  useEffect(() => {
    if (welcomed.current || player.status === 'loading') return
    welcomed.current = true
    const seen = getSeenRelease()
    if (player.status === 'new') {
      // 真正第一次來：記為已看過；沒登入的老玩家：保留紅點，讓他自己點來看
      if (seen === null) {
        markReleaseSeen()
        setHasNews(false)
      }
      setModal('welcome')
    } else if (seen === null && !player.player) {
      // 離線且從沒玩過：當新玩家處理，不跳更新內容
      markReleaseSeen()
      setHasNews(false)
    } else if (seen !== latestRelease() && hasGameplayChange(seen)) {
      // 玩法有改變才自動跳出並說明新玩法；一般更新只亮 📢 紅點
      setGameplayNotes(unseenReleases(seen).filter((n) => n.gameplay))
      markReleaseSeen()
      setHasNews(false)
      setModal('news')
    }
  }, [player.status, player.player])

  // 手機：整個畫面都能滑動操作，禁止頁面捲動 / 下拉重新整理（iOS 不完全遵守 touch-action，需要 preventDefault）
  // 彈窗內（排行榜列表、輸入框）仍可正常捲動
  useEffect(() => {
    const block = (e: TouchEvent) => {
      if (!(e.target as Element | null)?.closest?.('.modal')) e.preventDefault()
    }
    document.addEventListener('touchmove', block, { passive: false })
    return () => document.removeEventListener('touchmove', block)
  }, [])

  // 手機瀏覽器需要使用者手勢才能出聲
  useEffect(() => {
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  const busyRef = useRef(false)
  const genRef = useRef(0) // 重開局時讓進行中的流程失效
  const fxId = useRef(0)

  const s = g.current
  const cfg = levelConfig(s.level)

  const commit = (b: BoardData) => {
    g.current.board = b
    render()
  }

  const showToast = (text: string, tone: 'good' | 'bad' = 'good') => setToast({ text, key: ++fxId.current, tone })

  const addFloat = (cells: [number, number][], text: string) => {
    const cx = cells.reduce((a, [, c]) => a + c + 0.5, 0) / cells.length / SIZE
    // 浮動文字會往上飄，最上排時往下移一點，避免飄出棋盤蓋到分數
    const cy = Math.max(0.2, cells.reduce((a, [r]) => a + r + 0.5, 0) / cells.length / SIZE)
    const id = ++fxId.current
    setFloats((f) => [...f, { id, x: cx, y: cy, text }])
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 900)
  }

  const addScore = (pts: number) => {
    const st = g.current
    st.score += pts
    setBump((n) => n + 1)
    if (st.score > st.best) {
      st.best = st.score
      try {
        localStorage.setItem(BEST_KEY, String(st.best))
      } catch {
        /* 無痕模式等情況：忽略 */
      }
    }
    render()
  }

  /** 回合結束：先檢查過關，再檢查卡死 / 扣血 */
  const endTurn = async (alive: () => boolean) => {
    const st = g.current
    if (st.score - st.levelStart >= levelConfig(st.level).target) {
      const opts = rollChoices(st.skills)
      if (opts.length) {
        setChoices(opts) // 選完技能後由 pickSkill 繼續
        return
      }
      levelUp(null)
    }
    if (checkGameOver(st.board)) {
      const canSqueeze = st.swaps > 0 && DIRS.some((d) => squeezeCells(st.board, d))
      if (canSqueeze) {
        setStuck(true)
      } else {
        await takeDamage(alive)
        if (!alive()) return
      }
    }
    busyRef.current = false
  }

  const takeDamage = async (alive: () => boolean) => {
    const st = g.current
    st.hp -= 1
    setHurt((n) => n + 1)
    render()
    if (st.hp <= 0) {
      st.over = true
      setResult(null)
      fx.gameOver()
      render()
      void submitRef
        .current(st.score, st.level)
        .then((r) => r && setResult(r === 'queued' ? r : { rank: r.rank, total: r.total }))
      return
    }
    fx.damage()
    showToast('卡死！−1 ❤  破陣', 'bad')
    const cells = randomFilledCells(st.board, DAMAGE_CLEAR)
    const { board, removedIds } = removeCells(st.board, cells)
    setClearing(removedIds)
    await sleep(CLEAR_MS)
    if (!alive()) return
    setClearing(new Set())
    commit(board)
  }

  const levelUp = (pick: SkillId | null) => {
    const st = g.current
    if (pick) {
      const level = (st.skills[pick]?.level ?? 0) + 1
      st.skills[pick] = { level }
      if (pick === 'heart') {
        st.maxHp += 1
        st.hp = st.maxHp
      }
      // 技能 = 特殊牌：立刻把盤面上幾張牌變成對應的特殊牌
      const place = skillPlacement(pick, level)
      if (place) {
        const { board, cells } = placePowers(st.board, place.pick, place.count)
        st.board = board
        if (cells.length) {
          addFloat(cells, `${SKILLS[pick].powerIcon} ×${cells.length}`)
          fx.sparkle()
        }
      }
    }
    st.level += 1
    st.levelStart = st.score
    st.swaps = SWAP_MAX
    showToast(`LEVEL ${st.level}`)
    fx.levelUp()
    render()
  }

  const pickSkill = (id: SkillId) => {
    setChoices(null)
    levelUp(id)
    const gen = genRef.current
    void endTurn(() => gen === genRef.current)
  }

  /**
   * 一步操作：
   *   from 沒給 → 整盤往 dir 推；推不動就擠壓（消耗 1 次換牌）
   *   from 有給 → 把那張牌和 dir 方向的鄰牌交換（長按牌再滑 / 滑鼠拖牌）；能湊成牌型才換，否則只提示
   */
  const handleMove = useCallback(async (dir: Direction, from?: [number, number]) => {
    if (busyRef.current || g.current.over || modalRef.current) return
    const gen = genRef.current
    const alive = () => gen === genRef.current
    const st0 = g.current
    const powers = powerSetup(st0.skills) // 技能等級決定特殊牌的機率與強化

    // 三種操作：swap 換牌（從牌上滑、能湊牌型）｜slide 推整盤｜squeeze 推不動時再推＝擠壓
    let moved: BoardData | null = null
    let kind: 'swap' | 'slide' | 'squeeze' = 'slide'
    // 換牌消除後像 Candy Crush 一樣往下掉；推整盤 / 擠壓則往推的方向靠攏
    let collapseDir: Direction = dir
    let squeeze: ReturnType<typeof expandRemoval> | null = null
    let squeezed = 0
    if (from) {
      // 換牌是明確動作（長按牌再滑 / 滑鼠拖牌）：換不了就提示原因，不會改成推整盤
      const swapped = st0.swaps > 0 ? trySwap(st0.board, from[0], from[1], dir) : null
      if (!swapped) {
        fx.invalid()
        setShake(true)
        setTimeout(() => setShake(false), 200)
        showToast(st0.swaps > 0 ? '換了也湊不成牌型' : '換牌次數用完了', 'bad')
        return
      }
      moved = swapped
      kind = 'swap'
      collapseDir = 'down'
    } else {
      const m = moveBoard(st0.board, dir)
      if (m.moved) moved = m.board
      else if (st0.swaps > 0) {
        // 擠壓：每一排滿的牌把最靠牆那張擠掉（被擠到的特殊牌照樣觸發）
        const sc = squeezeCells(st0.board, dir)
        if (sc) {
          kind = 'squeeze'
          squeeze = expandRemoval(st0.board, sc, Math.random, powers.mods)
          squeezed = sc.length
        }
      }
    }
    if (!moved && !squeeze) {
      fx.invalid()
      setShake(true)
      setTimeout(() => setShake(false), 200)
      return
    }
    if (kind === 'slide') {
      if (st0.swaps < SWAP_MAX && --st0.slidesToRecharge <= 0) {
        st0.swaps += 1
        st0.slidesToRecharge = SWAP_RECHARGE
      }
    } else st0.swaps -= 1

    busyRef.current = true
    setStuck(false)
    if (squeeze) {
      const { cells, extra, hits } = squeeze
      const { board: removed, removedIds } = removeCells(st0.board, cells)
      const pts = squeezed * SQUEEZE_TILE_SCORE + extra * POWER_TILE_SCORE
      addFloat(cells, `${powerIcons(hits)}擠壓 +${pts}`)
      if (hits.length) playHits(hits, 1)
      else fx.sweep()
      setClearing(removedIds)
      addScore(pts)
      await sleep(CLEAR_MS)
      if (!alive()) return
      setClearing(new Set())
      moved = collapseBoard(removed, dir)
    } else fx.move()
    let b = moved!
    let chain = 0
    let cleared = false
    let granted = false // 每步最多因大消除獲得 1 張特殊牌
    const prevStreak = g.current.streak
    commit(b)
    await sleep(SLIDE_MS)

    // 消除 → 靠攏 → 再檢查，直到沒有牌型
    const resolve = async () => {
      for (;;) {
        if (!alive()) return
        const matches = findMatches(b)
        if (!matches.length) return
        chain += 1
        if (!cleared) {
          // 本步第一次消除 → 連消 +1，跨過門檻時提示
          cleared = true
          const st = (g.current.streak = prevStreak + 1)
          if (streakMultiplier(st) > streakMultiplier(prevStreak)) {
            showToast(`${st} 連消！分數 ×${streakMultiplier(st)}`)
            fx.streak()
          }
        }
        const mult = streakMultiplier(g.current.streak)
        const seeds = matches.flatMap((m) => m.cells)
        // 特殊牌：被消到就連帶觸發（可連鎖引爆）
        const { cells, extra, hits } = expandRemoval(b, seeds, Math.random, powers.mods)
        const pts = (calculateScore(matches, chain) + extra * POWER_TILE_SCORE * chain) * mult
        const { board: removed, removedIds } = removeCells(b, cells)
        // 只有一種牌型時顯示名稱，讓玩家知道是什麼被消掉（寬鬆牌型尤其需要）
        const kinds = new Set(matches.map((m) => m.kind))
        const label = kinds.size === 1 ? `${MELD_NAME[matches[0].kind]} ` : ''
        addFloat(seeds, `${powerIcons(hits)}${label}+${pts.toLocaleString()}${mult > 1 ? ` ×${mult}` : ''}`)
        playHits(hits, chain)
        setClearing(removedIds)
        if (chain >= 2) setCombo({ n: chain, key: ++fxId.current })
        addScore(pts)

        await sleep(CLEAR_MS)
        if (!alive()) return
        setClearing(new Set())
        b = collapseBoard(removed, collapseDir)
        // 交叉消除或 Combo ×2 以上：在消除處附近生一張特殊牌
        if (!granted && (countOverlaps(matches) > 0 || chain >= 2)) {
          granted = true
          b = grantPower(b, seeds[Math.floor(seeds.length / 2)], Math.random, powers.earned)
        }
        commit(b)
        await sleep(SLIDE_MS)
      }
    }

    await resolve()
    if (!alive()) return

    const lc = levelConfig(g.current.level)
    const count = 2 + (Math.random() < lc.thirdSpawnRate ? 1 : 0) + lc.extraSpawn
    b = spawnTiles(b, count, Math.random, lc.assistRate, powers.spawn).board
    commit(b)
    await sleep(SPAWN_MS)
    await resolve() // 新牌剛好湊成也算（連鎖繼續）
    if (!alive()) return
    // 清盤：特殊牌把整盤消光 → 獎勵分數並補一批新牌（空盤推不動，不能算卡死）
    if (isEmpty(b)) {
      showToast(`清盤！+${CLEAR_BOARD_BONUS}`)
      fx.levelUp()
      addScore(CLEAR_BOARD_BONUS)
      b = spawnTiles(b, REFILL_TILES, Math.random, lc.assistRate, powers.spawn).board
      commit(b)
      await sleep(SPAWN_MS)
      await resolve()
      if (!alive()) return
    }
    if (!cleared) g.current.streak = 0
    render()

    await endTurn(alive)
  }, [])

  const restart = useCallback(() => {
    // 中途重開也記錄這局分數
    const prev = g.current
    if (!prev.over && prev.score > 0) void submitRef.current(prev.score, prev.level)
    setResult(null)
    genRef.current += 1
    busyRef.current = false
    g.current = newGame(g.current.best)
    setClearing(new Set())
    setFloats([])
    setCombo(null)
    setToast(null)
    setChoices(null)
    setStuck(false)
    render()
  }, [])

  // 鍵盤：方向 / WASD 移動
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modalRef.current || (e.target as HTMLElement).tagName === 'INPUT') return
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
  /** 螢幕座標落在哪一格（棋盤外回 undefined） */
  const cellFromPoint = (x: number, y: number): [number, number] | undefined => {
    const el = document.querySelector('.board')
    if (!el) return undefined
    const rect = el.getBoundingClientRect()
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) return undefined
    return [Math.floor(((y - rect.top) / rect.height) * SIZE), Math.floor(((x - rect.left) / rect.width) * SIZE)]
  }
  const swipeDir = (dx: number, dy: number): Direction =>
    Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
  // 一般滑動 = 推整盤；長按一張牌（手指不動）選起來後再滑 = 和旁邊的牌換位
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const armedRef = useRef<[number, number] | null>(null)
  const [armed, setArmed] = useState<string | null>(null) // 被長按選起來的牌 id（畫面高亮用）
  const clearPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current)
    pressTimer.current = null
  }
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
    clearPress()
    armedRef.current = null
    const cell = cellFromPoint(t.clientX, t.clientY)
    const tile = cell && g.current.board[cell[0]][cell[1]]
    if (!cell || !tile || busyRef.current) return
    pressTimer.current = setTimeout(() => {
      armedRef.current = cell
      setArmed(tile.id)
      try {
        navigator.vibrate?.(15)
      } catch {
        /* ignore */
      }
    }, LONG_PRESS_MS)
  }
  const onTouchMove = (e: React.TouchEvent) => {
    // 長按成立前手指就移動了 → 是一般滑動，取消長按
    const st = touchStart.current
    if (!st || armedRef.current) return
    const t = e.touches[0]
    if (Math.hypot(t.clientX - st.x, t.clientY - st.y) > PRESS_SLOP) clearPress()
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    clearPress()
    const st = touchStart.current
    const from = armedRef.current
    touchStart.current = null
    armedRef.current = null
    setArmed(null)
    if (!st || (e.target as Element).closest('input')) return
    const t = e.changedTouches[0]
    const dx = t.clientX - st.x
    const dy = t.clientY - st.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return // 長按後沒滑 = 取消選取
    handleMove(swipeDir(dx, dy), from ?? undefined)
  }

  // 桌機：滑鼠拖一張牌 = 換牌（推整盤用方向鍵；觸控交給上面的 touch 事件）
  const mouseStart = useRef<{ x: number; y: number } | null>(null)
  const onBoardPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button === 0) mouseStart.current = { x: e.clientX, y: e.clientY }
  }
  const onBoardPointerUp = (e: React.PointerEvent) => {
    const st = mouseStart.current
    mouseStart.current = null
    if (!st || e.pointerType !== 'mouse') return
    const dx = e.clientX - st.x
    const dy = e.clientY - st.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 16) return
    handleMove(swipeDir(dx, dy), cellFromPoint(st.x, st.y))
  }

  return (
    <>
      <div
        className={`game${hurt ? ' hurt-' + (hurt % 2) : ''}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => {
          clearPress()
          armedRef.current = null
          setArmed(null)
        }}
      >
        <aside className="side side-info">
          <PlayerBar
            p={player}
            muted={muted}
            onToggleMute={() => {
              setMuted(!muted)
              setMutedState(!muted)
            }}
            onOpenBoard={() => setModal('board')}
            hasNews={hasNews}
            onOpenNews={openNews}
          />
          <header className="header">
            <div className="brand">
              <h1 className="title">雀消</h1>
              <div className="subtitle">MAHJONG CRUSH</div>
            </div>
            <ScoreBoard score={s.score} best={s.best} bump={bump} />
          </header>

          <StatusBar
            level={s.level}
            progress={s.score - s.levelStart}
            target={cfg.target}
            hp={s.hp}
            maxHp={s.maxHp}
            hurtKey={hurt}
            streak={s.streak}
          />
        </aside>

        <main className="stage">
          <div className="board-wrap">
            <Board
              board={s.board}
              clearing={clearing}
              floats={floats}
              shake={shake}
              armed={armed}
              onPointerDown={onBoardPointerDown}
              onPointerUp={onBoardPointerUp}
            >
              {combo && !choices && (
                <div key={combo.key} className="combo" onAnimationEnd={() => setCombo(null)}>
                  COMBO ×{combo.n}!
                </div>
              )}
              {toast && !choices && (
                <div key={toast.key} className={`toast ${toast.tone}`} onAnimationEnd={() => setToast(null)}>
                  {toast.text}
                </div>
              )}
              {stuck && <div className="stuck-hint">卡住了！往任一方向再推一次可以擠壓</div>}
              {s.over && (
                <GameOver
                  score={s.score}
                  best={s.best}
                  level={s.level}
                  isRecord={s.score > s.startBest && s.score > 0}
                  result={result}
                  onRestart={restart}
                  onOpenBoard={player.status === 'ready' ? () => setModal('board') : undefined}
                />
              )}
            </Board>
          </div>
        </main>

        <aside className="side side-play">
          <SwapMeter swaps={s.swaps} slidesToRecharge={s.slidesToRecharge} />
          <SkillBar skills={s.skills} />

          <footer className="help">
            <p className="hint">
              滑動推整盤，
              <wbr />
              長按一張牌再滑可以換位！
            </p>
            <div className="rules">
              <div className="rule">
                <div className="rule-tiles">
                  <MiniTile suit="wan" value={3} />
                  <MiniTile suit="wan" value={3} />
                  <MiniTile suit="wan" value={3} />
                </div>
                <span>
                  刻子 <b>+100</b>
                </span>
              </div>
              <div className="rule">
                <div className="rule-tiles">
                  <MiniTile suit="tong" value={4} />
                  <MiniTile suit="tong" value={5} />
                  <MiniTile suit="tong" value={6} />
                </div>
                <span>
                  順子 <b>+150</b>
                </span>
              </div>
            </div>
            <p className="rules-loose">
              不同花也能消：
              <span>
                同號 <b>+60</b>
              </span>{' '}
              <span>
                雜順 <b>+50</b>
              </span>{' '}
              <span>
                跳號 <b>+40</b>
              </span>
              <br />
              特殊牌：<span>➕ 多消 2 張</span> <span>↔ 整列</span> <span>↕ 整行</span> <span>💥 九宮格</span>{' '}
              <span>🎨 同花</span>
            </p>
            <div className="keys">
              <span className="keys-text">方向鍵推整盤，滑鼠拖一張牌換位</span>
              <InstallButton />
              <button className="btn ghost" onClick={restart}>
                重新開始
              </button>
            </div>
          </footer>
        </aside>
      </div>
      {choices && <LevelUp level={s.level} choices={choices} skills={s.skills} onPick={pickSkill} />}
      <PwaPrompt />
      {modal === 'news' && <NewsModal gameplayNotes={gameplayNotes} onClose={() => setModal(null)} />}
      {(modal === 'welcome' || modal === 'board') && (
        <PlayerModal key={modal + player.fp} p={player} mode={modal} onClose={() => setModal(null)} />
      )}
    </>
  )
}
