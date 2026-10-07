// 玩家看得到的「更新內容」：每次改版在最上面加一筆，用玩家的語言寫（不寫技術細節）
// id 用來判斷玩家看過沒有：新增一筆就會在 📢 按鈕上出現紅點
// gameplay: true（玩法有改變）→ 老玩家更新後自動跳出，並在最上面用 howTo 說明新的玩法；
// 一般修正、文字調整不設 gameplay，只亮紅點、不打斷遊戲

/**
 * 一條玩法說明。topic 相同時，較新版本的說明會取代舊的（例如換牌方式改了，舊說明就不再顯示）；
 * returningOnly：只對老玩家有意義（例如「不用再手動施放」），新玩家的教學不顯示
 */
export interface HowTo {
  icon: string
  text: string
  topic?: string
  returningOnly?: boolean
}

export interface ReleaseNote {
  id: string // 唯一識別，例如日期；同一天多次改版加 -2
  date: string
  title: string
  items: string[]
  gameplay?: boolean // 玩法有改變：更新後自動跳出說明
  howTo?: HowTo[] // 新玩法的簡短操作說明
}

export const CHANGELOG: ReleaseNote[] = [
  {
    id: '2026-10-07-4',
    date: '2026/10/07',
    title: '每關有步數上限',
    gameplay: true,
    howTo: [
      { icon: '⏳', text: '每關有步數上限，要在步數內達到目標分數；用完還沒到就扣 1 顆心、本關重來', topic: 'moves' },
    ],
    items: [
      '每關有步數上限（第 1 關 24 步，每 2 關少 1 步，最少 15 步），推整盤、換牌、擠壓都算一步',
      '步數用完還沒到目標：扣 1 顆心、本關重來；心歸零就結束',
      '剩 5 步以內會亮紅色提醒',
      '修正推不動、換牌次數又用完時遊戲卡住不會結束的問題；只剩換牌能開路時會提示長按換牌',
    ],
  },
  {
    id: '2026-10-07-3',
    date: '2026/10/07',
    title: '換牌改成長按，不會再誤推整盤',
    gameplay: true,
    howTo: [
      { icon: '👉', text: '一般滑動：推整盤（推不動就擠壓）', topic: 'slide' },
      { icon: '✋', text: '長按一張牌，等牌浮起來再往旁邊滑：和鄰牌換位', topic: 'swap' },
    ],
    items: [
      '換牌改成長按一張牌（會輕震、牌浮起來）再滑；一般滑動一律推整盤，不會再誤觸',
      '換了湊不成牌型或次數用完時，只會提示原因，不會移動任何牌',
      '手機從背景切回遊戲時會自動檢查新版本',
      '📢 更新內容最下面可以看目前版本，也能手動「檢查更新」',
    ],
  },
  {
    id: '2026-10-07-2',
    date: '2026/10/07',
    title: '技能改成特殊牌，不用再手動施放',
    gameplay: true,
    howTo: [
      { icon: '🎁', text: '過關選技能後，盤面會立刻出現對應的特殊牌：💣→💥、🧹→↔↕、✨→🎨', topic: 'skill' },
      { icon: '📈', text: '技能等級越高，那種特殊牌越常出現；Lv3 還會變強', topic: 'skill-level' },
      { icon: '👆', text: '不用再點技能、點棋盤，全部只要滑動', topic: 'no-cast', returningOnly: true },
    ],
    items: [
      '過關選技能後立刻放特殊牌（張數 = 等級），之後整局那種特殊牌更常出現',
      'Lv3 強化：💥 爆炸範圍變 5×5、直線牌變 ✚ 十字（整列＋整行）、🎨 連同數字也一起消',
      '技能列改成顯示你的特殊牌等級，不需要操作',
      '清盤（整盤消光）會獎勵 +300 並補一批新牌',
      '卡住時改用擠壓脫困；平衡調整：盤面同時最多 3 張自然出現的特殊牌、每 2 關每步多長 1 張牌',
    ],
  },
  {
    id: '2026-10-07',
    date: '2026/10/07',
    title: '特殊牌登場、推一張牌換位、擠壓、不同花也能消',
    gameplay: true,
    howTo: [
      { icon: '👆', text: '從一張牌往旁邊滑：和鄰牌換位能湊成牌型就會換', topic: 'swap' },
      { icon: '🧱', text: '推不動時往同方向再推一次：每排最靠牆的牌被擠掉', topic: 'squeeze' },
      { icon: '✨', text: '發光的特殊牌被消到會連帶爆開', topic: 'power' },
      { icon: '🀄', text: '不同花也能消：同號、雜順、跳號（分數較低）', topic: 'loose' },
    ],
    items: [
      '手指從一張牌滑出去，和旁邊的牌交換後能湊成牌型就會換位消除；不能湊就照舊推整盤',
      '擠壓：牌推不動時往同方向再推一次，每一排滿的牌把最靠牆那張擠掉（每張 +10），卡住時也能用來脫困',
      '換牌和擠壓共用次數，最多存 4 次，推整盤 5 次回 1 次，過關補滿',
      '不同花也能消，分數較低：同號（7萬 7筒 7條）+60、雜順（3萬 4筒 5條）+50、跳號（2條 4條 6條）+40',
      '牌面會出現發光的特殊牌，消到它會連帶觸發：➕ 多消 2 張、↔ 整列、↕ 整行、💥 九宮格、🎨 全盤同花色',
      '特殊牌炸到另一張特殊牌會接著引爆；交叉消除或 Combo ×2 以上一定會生一張特殊牌',
      '消除時會顯示是哪種牌型',
      '右上角 📢 可以看每次改版的內容',
    ],
  },
  {
    id: '2026-10-06',
    date: '2026/10/06',
    title: '可以安裝到手機、離線玩',
    items: [
      '加到主畫面後像 App 一樣開啟，開過一次就能在飛機上玩',
      '離線時的分數會在連上網路後自動上傳排行榜',
      '有新版本時會提示「更新」，不會在遊戲中途自動重新整理',
    ],
  },
  {
    id: '2026-10-05',
    date: '2026/10/05',
    title: '雀消正式上線',
    items: [
      '滑動整盤湊出刻子、順子，連鎖消除有 Combo 加乘，連續幾步都有消除還有連消倍率',
      '過關三選一技能：炸彈、剷除、消除、強身，重複選可升級',
      '血量制：卡住會扣血並清出空間，血量歸零才結束',
      '免帳號登入、排行榜、改名、刪除自己的紀錄',
      '音效與震動，可以一鍵靜音',
    ],
  },
]

const SEEN_KEY = 'mahjong-crush-seen-release'
export const latestRelease = () => CHANGELOG[0].id

/** 比 seen 新的版本（seen 不在清單裡就視為全部沒看過） */
export function unseenReleases(seen: string | null): ReleaseNote[] {
  const i = CHANGELOG.findIndex((n) => n.id === seen)
  return i === -1 ? CHANGELOG : CHANGELOG.slice(0, i)
}

/**
 * 合併多個版本的玩法說明（新到舊）：同 topic 只保留最新的一條，避免出現已過時、互相矛盾的說明
 */
export function mergeHowTo(notes: ReleaseNote[], forNewPlayer = false): HowTo[] {
  const seenTopics = new Set<string>()
  const out: HowTo[] = []
  for (const n of notes)
    for (const h of n.howTo ?? []) {
      if (forNewPlayer && h.returningOnly) continue
      if (h.topic) {
        if (seenTopics.has(h.topic)) continue
        seenTopics.add(h.topic)
      }
      out.push(h)
    }
  return out
}

/** 新玩家的玩法教學：所有版本合併後的「目前玩法」 */
export const currentHowTo = () => mergeHowTo(CHANGELOG, true)

/** 沒看過的版本裡有沒有玩法改變 */
export const hasGameplayChange = (seen: string | null) => unseenReleases(seen).some((n) => n.gameplay)

export function getSeenRelease(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY)
  } catch {
    return null
  }
}

export function markReleaseSeen() {
  try {
    localStorage.setItem(SEEN_KEY, latestRelease())
  } catch {
    /* ignore */
  }
}
