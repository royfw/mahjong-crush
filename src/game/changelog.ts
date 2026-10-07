// 玩家看得到的「更新內容」：每次改版在最上面加一筆，用玩家的語言寫（不寫技術細節）
// id 用來判斷玩家看過沒有，新增一筆就會在 📢 按鈕上出現紅點，並在更新後自動跳出一次

export interface ReleaseNote {
  id: string // 唯一識別，例如日期；同一天多次改版加 -2
  date: string
  title: string
  items: string[]
}

export const CHANGELOG: ReleaseNote[] = [
  {
    id: '2026-10-07',
    date: '2026/10/07',
    title: '特殊牌登場、推一張牌換位、不同花也能消',
    items: [
      '手指從一張牌滑出去，和旁邊的牌交換後能湊成牌型就會換位消除；不能湊就照舊推整盤',
      '換牌最多存 3 次，推整盤 5 次回 1 次，過關補滿',
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
