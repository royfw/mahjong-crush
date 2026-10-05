import { SKILLS, type SkillId, type Skills } from '../game/skills'

interface Props {
  level: number
  choices: SkillId[]
  skills: Skills
  onPick: (id: SkillId) => void
}

export function LevelUp({ level, choices, skills, onPick }: Props) {
  return (
    <div className="modal-backdrop levelup-backdrop">
      <div className="modal levelup" role="dialog" aria-labelledby="levelup-title">
        <div id="levelup-title" className="levelup-title">
          LEVEL {level} CLEAR!
        </div>
        <p className="modal-text">選一個技能，重複選同一個會升級</p>
        <div className="choices">
          {choices.map((id) => {
            const def = SKILLS[id]
            const next = (skills[id]?.level ?? 0) + 1
            return (
              <button key={id} className="choice" onClick={() => onPick(id)}>
                <span className="choice-icon">{def.icon}</span>
                <span className="choice-name">
                  {def.name} <small>{next > 1 ? `Lv${next - 1} → Lv${next}` : 'NEW'}</small>
                </span>
                <span className="choice-desc">{def.desc(next)}</span>
                {next === def.maxLevel && <span className="choice-max">MAX</span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
