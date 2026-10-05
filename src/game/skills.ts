// 技能與關卡設定（純資料 + 純函式）
import { SIZE, type Board } from './logic'

export type SkillId = 'bomb' | 'shovel' | 'purge' | 'heart'

export interface SkillDef {
  id: SkillId
  icon: string
  name: string
  active: boolean // false = 被動技能，選到即生效
  maxLevel: number
  /** 各等級的最大次數（index = level - 1） */
  charges: number[]
  desc: (level: number) => string
}

export const SKILLS: Record<SkillId, SkillDef> = {
  bomb: {
    id: 'bomb',
    icon: '💣',
    name: '炸彈',
    active: true,
    maxLevel: 3,
    charges: [1, 2, 3],
    desc: (lv) => `炸掉九宮格 3×3 · ${SKILLS.bomb.charges[lv - 1]} 次`,
  },
  shovel: {
    id: 'shovel',
    icon: '🧹',
    name: '剷除',
    active: true,
    maxLevel: 3,
    charges: [1, 2, 2],
    desc: (lv) => (lv >= 3 ? '剷除十字（整列 + 整行）· 2 次' : `剷除整列 · ${SKILLS.shovel.charges[lv - 1]} 次`),
  },
  purge: {
    id: 'purge',
    icon: '✨',
    name: '消除',
    active: true,
    maxLevel: 3,
    charges: [1, 2, 2],
    desc: (lv) =>
      lv >= 3 ? '消除所有同數字的牌（不分花色）· 2 次' : `消除盤面所有相同的牌 · ${SKILLS.purge.charges[lv - 1]} 次`,
  },
  heart: {
    id: 'heart',
    icon: '❤️',
    name: '強身',
    active: false,
    maxLevel: 2,
    charges: [0, 0],
    desc: () => '最大血量 +1，並補滿血',
  },
}

export const SKILL_ORDER: SkillId[] = ['bomb', 'shovel', 'purge', 'heart']
export const BASE_HP = 3
export const SKILL_TILE_SCORE = 30
export const DAMAGE_CLEAR = 10 // 卡死扣血時清掉的牌數

export interface SkillState {
  level: number
  charges: number
}
export type Skills = Partial<Record<SkillId, SkillState>>

export const maxCharges = (id: SkillId, level: number) => SKILLS[id].charges[level - 1] ?? 0

/** 技能作用的格子（目標格 r, c） */
export function skillCells(board: Board, id: SkillId, level: number, r: number, c: number): [number, number][] {
  const out: [number, number][] = []
  const add = (i: number, j: number) => {
    if (i >= 0 && i < SIZE && j >= 0 && j < SIZE && board[i][j]) out.push([i, j])
  }
  if (id === 'bomb') {
    for (let i = r - 1; i <= r + 1; i++) for (let j = c - 1; j <= c + 1; j++) add(i, j)
  } else if (id === 'shovel') {
    for (let j = 0; j < SIZE; j++) add(r, j)
    if (level >= 3) for (let i = 0; i < SIZE; i++) if (i !== r) add(i, c)
  } else if (id === 'purge') {
    const t = board[r][c]
    if (!t) return out
    for (let i = 0; i < SIZE; i++)
      for (let j = 0; j < SIZE; j++) {
        const x = board[i][j]
        if (x && x.value === t.value && (level >= 3 || x.suit === t.suit)) out.push([i, j])
      }
  }
  return out
}

/** 過關可選的技能：排除已滿級，最多 3 個 */
export function rollChoices(skills: Skills, rng: () => number = Math.random): SkillId[] {
  return SKILL_ORDER.filter((id) => (skills[id]?.level ?? 0) < SKILLS[id].maxLevel)
    .sort(() => rng() - 0.5)
    .slice(0, 3)
}

export interface LevelConfig {
  target: number // 本關需要取得的分數
  assistRate: number // 新牌協助湊牌機率
  thirdSpawnRate: number // 每步多生第 3 張的機率
}

/** 難度曲線：第 1 關很簡單，之後逐關變難（有上下限） */
export function levelConfig(level: number): LevelConfig {
  const n = level - 1
  return {
    target: 500 + n * 400,
    assistRate: Math.max(0.6, 0.92 - n * 0.05),
    thirdSpawnRate: Math.min(0.55, n * 0.12),
  }
}
