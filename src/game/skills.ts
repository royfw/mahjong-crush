// 技能與關卡設定（純資料 + 純函式）
// 技能 = 特殊牌加成：過關選了之後，盤面立刻出現對應的特殊牌，之後整局也更常出現；不需要手動施放
import {
  DEFAULT_MODS,
  DEFAULT_POWER_SPAWN,
  EARNED_POWER_WEIGHTS,
  type Power,
  type PowerMods,
  type PowerSpawn,
  type PowerWeights,
} from './logic'

export type SkillId = 'bomb' | 'shovel' | 'purge' | 'nimble' | 'heart'

export interface SkillDef {
  id: SkillId
  icon: string
  name: string
  /** 對應的特殊牌（強身沒有） */
  powerIcon?: string
  maxLevel: number
  desc: (level: number) => string
}

export const SKILLS: Record<SkillId, SkillDef> = {
  bomb: {
    id: 'bomb',
    icon: '💣',
    name: '炸彈',
    powerIcon: '💥',
    maxLevel: 3,
    desc: (lv) => (lv >= 3 ? '立刻放 3 張 💥，爆炸範圍變 5×5' : `立刻放 ${lv} 張 💥 爆破牌（九宮格），之後更常出現`),
  },
  shovel: {
    id: 'shovel',
    icon: '🧹',
    name: '剷除',
    powerIcon: '↔',
    maxLevel: 3,
    desc: (lv) =>
      lv >= 3 ? '立刻放 3 張 ✚ 十字牌（整列＋整行），之後直線牌都變十字' : `立刻放 ${lv} 張 ↔↕ 直線牌，之後更常出現`,
  },
  purge: {
    id: 'purge',
    icon: '✨',
    name: '消除',
    powerIcon: '🎨',
    maxLevel: 3,
    desc: (lv) =>
      lv >= 3 ? '立刻放 3 張 🎨，同花之外連同數字也一起消' : `立刻放 ${lv} 張 🎨 同花牌（全盤同花色），之後更常出現`,
  },
  nimble: {
    id: 'nimble',
    icon: '🔄',
    name: '巧手',
    maxLevel: 3,
    desc: (lv) =>
      lv >= 3
        ? '換牌不算步數（擠壓照算）'
        : `換牌 / 擠壓上限 ${SWAP_MAX + lv} 次，推整盤 ${SWAP_RECHARGE - lv} 次回 1 次`,
  },
  heart: {
    id: 'heart',
    icon: '❤️',
    name: '強身',
    maxLevel: 2,
    desc: () => '最大血量 +1，並補滿血',
  },
}

export const SKILL_ORDER: SkillId[] = ['bomb', 'shovel', 'purge', 'nimble', 'heart']
export const BASE_HP = 3
export const DAMAGE_CLEAR = 10 // 卡死扣血時清掉的牌數

// 換牌（Candy Crush 式）/ 擠壓 共用次數：推整盤 SWAP_RECHARGE 次回 1 次，過關補滿
export const SWAP_MAX = 4
export const SWAP_RECHARGE = 5

/** 巧手：Lv1/Lv2 各 +1 上限、回充快 1 次；Lv3 換牌不算步數 */
export interface SwapRules {
  max: number
  recharge: number // 推整盤幾次回 1 次
  freeSwap: boolean // 換牌不扣步數
}
export function swapRules(skills: Partial<Record<SkillId, { level: number }>>): SwapRules {
  const lv = Math.min(skills.nimble?.level ?? 0, 2)
  return { max: SWAP_MAX + lv, recharge: SWAP_RECHARGE - lv, freeSwap: (skills.nimble?.level ?? 0) >= 3 }
}

export interface SkillState {
  level: number
}
export type Skills = Partial<Record<SkillId, SkillState>>

const lv = (skills: Skills, id: SkillId) => skills[id]?.level ?? 0

/** 每級技能提高新牌是特殊牌的機率，並讓對應種類更常出現 */
const RATE_PER_LEVEL = 0.01
const WEIGHT_PER_LEVEL = 25

/** 依目前技能等級算出特殊牌的出現機率、種類權重與 Lv3 強化 */
export function powerSetup(skills: Skills): { spawn: PowerSpawn; earned: PowerWeights; mods: PowerMods } {
  const bomb = lv(skills, 'bomb')
  const shovel = lv(skills, 'shovel')
  const purge = lv(skills, 'purge')
  const cross = shovel >= 3
  const boost: Partial<Record<Power, number>> = {
    blast: bomb * WEIGHT_PER_LEVEL,
    // 剷除 Lv3：直線牌全部改成十字
    row: cross ? 0 : (shovel * WEIGHT_PER_LEVEL) / 2,
    col: cross ? 0 : (shovel * WEIGHT_PER_LEVEL) / 2,
    cross: cross ? shovel * WEIGHT_PER_LEVEL : 0,
    suit: purge * WEIGHT_PER_LEVEL,
  }
  const apply = (weights: PowerWeights): PowerWeights => {
    const out = weights.map(([p, w]): [Power, number] => [p, w + (boost[p] ?? 0)])
    if (cross) {
      // 原本的直線權重轉給十字
      const line = out.filter(([p]) => p === 'row' || p === 'col').reduce((a, [, w]) => a + w, 0)
      return [...out.filter(([p]) => p !== 'row' && p !== 'col'), ['cross', line + (boost.cross ?? 0)]]
    }
    return out
  }
  return {
    spawn: {
      ...DEFAULT_POWER_SPAWN,
      rate: DEFAULT_POWER_SPAWN.rate + (bomb + shovel + purge) * RATE_PER_LEVEL,
      weights: apply(DEFAULT_POWER_SPAWN.weights),
    },
    earned: apply(EARNED_POWER_WEIGHTS),
    mods: { ...DEFAULT_MODS, blastRadius: bomb >= 3 ? 2 : 1, suitAlsoNumber: purge >= 3 },
  }
}

/** 選了技能後立刻放到盤面上的特殊牌：張數 = 等級 */
export function skillPlacement(
  id: SkillId,
  level: number,
  rng: () => number = Math.random,
): { pick: () => Power; count: number } | null {
  if (id === 'bomb') return { pick: () => 'blast', count: level }
  if (id === 'purge') return { pick: () => 'suit', count: level }
  if (id === 'shovel') return { pick: () => (level >= 3 ? 'cross' : rng() < 0.5 ? 'row' : 'col'), count: level }
  return null
}

/** 過關可選的技能：排除已滿級，最多 3 個 */
export function rollChoices(skills: Skills, rng: () => number = Math.random): SkillId[] {
  return SKILL_ORDER.filter((id) => (skills[id]?.level ?? 0) < SKILLS[id].maxLevel)
    .sort(() => rng() - 0.5)
    .slice(0, 3)
}

export interface LevelConfig {
  target: number // 本關需要取得的分數
  moves: number // 本關可用步數；用完還沒到目標 → 扣 1 顆心、本關重來
  assistRate: number // 新牌協助湊牌機率
  thirdSpawnRate: number // 每步多生第 3 張的機率
  extraSpawn: number // 每步額外多生的張數（每 2 關 +1，後期加壓，避免特殊牌與換牌讓遊戲玩不完）
}

/** 難度曲線：第 1 關很簡單，之後逐關變難（有上下限） */
export function levelConfig(level: number): LevelConfig {
  const n = level - 1
  return {
    // 目標每關再乘 1.08：連消倍率讓後期得分變快，線性目標會被追上；指數成長 + 步數上限保證一定會結束
    target: Math.round(((500 + n * 400) * 1.08 ** n) / 10) * 10,
    // 步數上限讓遊戲一定會結束（模擬：一般玩家約到第 8 關、會玩的約第 10 關，每局約 180–240 步）
    moves: Math.max(15, 24 - Math.floor(n / 2)),
    assistRate: Math.max(0.5, 0.75 - n * 0.05),
    thirdSpawnRate: Math.min(0.55, n * 0.12),
    extraSpawn: Math.floor(n / 2),
  }
}
