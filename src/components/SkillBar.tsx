import { SKILLS, type SkillId, type Skills } from '../game/skills'

interface Props {
  skills: Skills
}

// 只有會產生特殊牌的技能顯示在這裡（強身反映在血量上）
const POWER_SKILLS: SkillId[] = ['bomb', 'shovel', 'purge']
const POWER_NAME: Record<string, string> = { bomb: '爆破', shovel: '直線', purge: '同花' }

/** 特殊牌加成（只顯示，不需要操作）：等級越高，對應的特殊牌越常出現 */
export function SkillBar({ skills }: Props) {
  return (
    <div className="skillbar">
      {POWER_SKILLS.map((id) => {
        const def = SKILLS[id]
        const level = skills[id]?.level ?? 0
        const icon = id === 'shovel' && level >= 3 ? '✚' : def.powerIcon
        const name = id === 'shovel' && level >= 3 ? '十字' : POWER_NAME[id]
        return (
          <div
            key={id}
            className={`skill${level ? ' owned' : ' locked'}`}
            title={level ? def.desc(level) : `過關時選「${def.icon} ${def.name}」可以讓 ${def.powerIcon} 更常出現`}
          >
            {!level && <span className="skill-key">🔒</span>}
            <span className="skill-icon">{icon}</span>
            <span className="skill-name">
              {name}
              {level > 0 && <small> Lv{level}</small>}
            </span>
            <span className="pips">
              {Array.from({ length: def.maxLevel }, (_, k) => (
                <i key={k} className={k < level ? 'pip on' : 'pip'} />
              ))}
            </span>
          </div>
        )
      })}
    </div>
  )
}
