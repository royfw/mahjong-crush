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
  removeMatches,
  spawnTiles,
  streakMultiplier,
  trySwap,
  MELD_NAME,
  type Board as BoardData,
  type Direction,
} from '../game/logic'
import {
  BASE_HP,
  DAMAGE_CLEAR,
  SKILLS,
  SKILL_ORDER,
  SKILL_TILE_SCORE,
  levelConfig,
  maxCharges,
  rollChoices,
  skillCells,
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
import { getSeenRelease, latestRelease, markReleaseSeen } from '../game/changelog'
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
  const [targeting, setTargeting] = useState<SkillId | null>(null)
  const [hover, setHover] = useState<[number, number] | null>(null)
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
  const openNews = () => {
    markReleaseSeen()
    setHasNews(false)
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
    } else if (seen !== latestRelease()) {
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
  const targetingRef = useRef<SkillId | null>(null)
  targetingRef.current = targeting

  const s = g.current
  const cfg = levelConfig(s.level)

  const commit = (b: BoardData) => {
    g.current.board = b
    render()
  }

  const showToast = (text: string, tone: 'good' | 'bad' = 'good') => setToast({ text, key: ++fxId.current, tone })

  const addFloat = (cells: [number, number][], text: string) => {
    const cx = cells.reduce((a, [, c]) => a + c + 0.5, 0) / cells.length / SIZE
    const cy = cells.reduce((a, [r]) => a + r + 0.5, 0) / cells.length / SIZE
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

  const hasCharges = () => SKILL_ORDER.some((id) => SKILLS[id].active && (g.current.skills[id]?.charges ?? 0) > 0)

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
      if (hasCharges()) {
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
      const cur = st.skills[pick]
      const level = (cur?.level ?? 0) + 1
      st.skills[pick] = { level, charges: 0 }
      if (pick === 'heart') {
        st.maxHp += 1
        st.hp = st.maxHp
      }
    }
    // 過關補滿所有技能次數
    for (const id of SKILL_ORDER) {
      const sk = st.skills[id]
      if (sk) sk.charges = maxCharges(id, sk.level)
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
   * 一步操作。from = 手指起點格：
   *   先試「和 dir 方向的鄰牌交換」，能形成牌型就換（Candy Crush 式，消耗 1 次換牌）；
   *   否則照舊整盤往 dir 推。
   */
  const handleMove = useCallback(async (dir: Direction, from?: [number, number]) => {
    if (busyRef.current || g.current.over || modalRef.current) return
    if (targetingRef.current) setTargeting(null)
    const gen = genRef.current
    const alive = () => gen === genRef.current
    const st0 = g.current

    let moved: BoardData | null = null
    // 換牌消除後像 Candy Crush 一樣往下掉；推整盤則往推的方向靠攏
    let collapseDir: Direction = dir
    const swapped = from && st0.swaps > 0 ? trySwap(st0.board, from[0], from[1], dir) : null
    if (swapped) {
      moved = swapped
      collapseDir = 'down'
      st0.swaps -= 1
    } else {
      const m = moveBoard(st0.board, dir)
      if (m.moved) moved = m.board
    }
    if (!moved) {
      fx.invalid()
      setShake(true)
      setTimeout(() => setShake(false), 200)
      return
    }
    if (!swapped && st0.swaps < SWAP_MAX && --st0.slidesToRecharge <= 0) {
      st0.swaps += 1
      st0.slidesToRecharge = SWAP_RECHARGE
    }

    fx.move()
    busyRef.current = true
    setStuck(false)
    let b = moved
    let chain = 0
    let bonusGiven = false
    let cleared = false
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
        const pts = calculateScore(matches, chain) * mult
        const { board: removed, removedIds } = removeMatches(b, matches)
        // 只有一種牌型時顯示名稱，讓玩家知道是什麼被消掉（寬鬆牌型尤其需要）
        const kinds = new Set(matches.map((m) => m.kind))
        const label = kinds.size === 1 ? `${MELD_NAME[matches[0].kind]} ` : ''
        addFloat(
          matches.flatMap((m) => m.cells),
          `${label}+${pts.toLocaleString()}${mult > 1 ? ` ×${mult}` : ''}`,
        )
        fx.clear(chain)
        setClearing(removedIds)
        if (chain >= 2) setCombo({ n: chain, key: ++fxId.current })
        addScore(pts)

        // Combo ×3 以上：隨機補 1 次技能
        if (chain >= 3 && !bonusGiven) {
          const sk = g.current.skills
          const ids = SKILL_ORDER.filter((id) => {
            const x = sk[id]
            return SKILLS[id].active && x && x.charges < maxCharges(id, x.level)
          })
          if (ids.length) {
            const id = ids[Math.floor(Math.random() * ids.length)]
            sk[id]!.charges += 1
            bonusGiven = true
            showToast(`Combo 獎勵 +1 ${SKILLS[id].icon}`)
          }
        }

        await sleep(CLEAR_MS)
        if (!alive()) return
        setClearing(new Set())
        b = collapseBoard(removed, collapseDir)
        commit(b)
        await sleep(SLIDE_MS)
      }
    }

    await resolve()
    if (!alive()) return

    const lc = levelConfig(g.current.level)
    const count = 2 + (Math.random() < lc.thirdSpawnRate ? 1 : 0) + lc.extraSpawn
    b = spawnTiles(b, count, Math.random, lc.assistRate).board
    commit(b)
    await sleep(SPAWN_MS)
    await resolve() // 新牌剛好湊成也算（連鎖繼續）
    if (!alive()) return
    if (!cleared) g.current.streak = 0
    render()

    await endTurn(alive)
  }, [])

  const castSkill = async (r: number, c: number) => {
    const id = targetingRef.current
    if (!id || busyRef.current) return
    const st = g.current
    const sk = st.skills[id]
    if (!sk || sk.charges <= 0) return
    const cells = skillCells(st.board, id, sk.level, r, c)
    if (!cells.length) {
      fx.invalid()
      setShake(true)
      setTimeout(() => setShake(false), 200)
      return
    }
    const gen = genRef.current
    const alive = () => gen === genRef.current
    busyRef.current = true
    sk.charges -= 1
    setTargeting(null)
    setHover(null)
    setStuck(false)

    ;({ bomb: fx.bomb, shovel: fx.sweep, purge: fx.sparkle, heart: fx.sparkle })[id]()
    const { board, removedIds } = removeCells(st.board, cells)
    const pts = cells.length * SKILL_TILE_SCORE
    addFloat(cells, `${SKILLS[id].icon} +${pts}`)
    setClearing(removedIds)
    addScore(pts)
    await sleep(CLEAR_MS)
    if (!alive()) return
    setClearing(new Set())
    commit(board)
    await endTurn(alive)
  }

  const toggleSkill = useCallback((id: SkillId) => {
    if (busyRef.current || g.current.over) return
    const sk = g.current.skills[id]
    if (!sk || sk.charges <= 0 || !SKILLS[id].active) return
    setTargeting((t) => (t === id ? null : id))
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
    setTargeting(null)
    setChoices(null)
    setStuck(false)
    render()
  }, [])

  // 鍵盤：方向 / WASD 移動，1~3 選技能，Esc 取消
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modalRef.current || (e.target as HTMLElement).tagName === 'INPUT') return
      if (e.key === 'Escape') return setTargeting(null)
      const n = Number(e.key)
      if (n >= 1 && n <= 3) {
        const actives = SKILL_ORDER.filter((id) => SKILLS[id].active && g.current.skills[id])
        if (actives[n - 1]) toggleSkill(actives[n - 1])
        return
      }
      const dir = KEY_DIR[e.key] ?? KEY_DIR[e.key.toLowerCase()]
      if (!dir) return
      e.preventDefault()
      if (!e.repeat) handleMove(dir)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleMove, toggleSkill])

  // 手機滑動（短距離視為點擊，交給 onClick）
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const lastSwipe = useRef(0)
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
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const st = touchStart.current
    touchStart.current = null
    if (!st || (e.target as Element).closest('input')) return
    const t = e.changedTouches[0]
    const dx = t.clientX - st.x
    const dy = t.clientY - st.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return
    lastSwipe.current = Date.now()
    handleMove(swipeDir(dx, dy), cellFromPoint(st.x, st.y))
  }

  // 桌機：滑鼠在牌上拖曳 = 推那張牌（觸控交給上面的 touch 事件）
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
    lastSwipe.current = Date.now()
    handleMove(swipeDir(dx, dy), cellFromPoint(st.x, st.y))
  }

  const cellAt = (e: React.MouseEvent): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clamp = (v: number) => Math.min(SIZE - 1, Math.max(0, Math.floor(v * SIZE)))
    return [clamp((e.clientY - rect.top) / rect.height), clamp((e.clientX - rect.left) / rect.width)]
  }
  const onBoardClick = (e: React.MouseEvent) => {
    if (!targeting || Date.now() - lastSwipe.current < 350) return
    const [r, c] = cellAt(e)
    void castSkill(r, c)
  }
  const onBoardHover = (e: React.MouseEvent) => {
    if (!targeting) return
    const [r, c] = cellAt(e)
    if (!hover || hover[0] !== r || hover[1] !== c) setHover([r, c])
  }

  // 技能瞄準預覽
  const preview = new Set<string>()
  if (targeting && hover) {
    const sk = s.skills[targeting]
    if (sk)
      for (const [r, c] of skillCells(s.board, targeting, sk.level, hover[0], hover[1])) preview.add(s.board[r][c]!.id)
  }

  return (
    <>
      <div className={`game${hurt ? ' hurt-' + (hurt % 2) : ''}`} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
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
              preview={preview}
              floats={floats}
              shake={shake}
              targeting={!!targeting}
              onClick={onBoardClick}
              onMouseMove={onBoardHover}
              onMouseLeave={() => setHover(null)}
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
              {stuck && !targeting && <div className="stuck-hint">卡住了！使用技能開路 👇</div>}
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
          <SkillBar skills={s.skills} targeting={targeting} onToggle={toggleSkill} />

          <footer className="help">
            <p className="hint">
              {targeting ? (
                `點選棋盤施放 ${SKILLS[targeting].name}（Esc 取消）`
              ) : (
                <>
                  滑動整盤，或推一張牌
                  <wbr />
                  換位湊牌型！
                </>
              )}
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
              不同花也能消：同號 <b>+60</b>　雜順 <b>+50</b>　跳號 <b>+40</b>
            </p>
            <div className="keys">
              <span className="keys-text">方向鍵推整盤，滑鼠拖牌換位，1–3 選技能</span>
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
      {modal === 'news' && <NewsModal onClose={() => setModal(null)} />}
      {(modal === 'welcome' || modal === 'board') && (
        <PlayerModal key={modal + player.fp} p={player} mode={modal} onClose={() => setModal(null)} />
      )}
    </>
  )
}
