import { SKILLS, SKILL_ORDER, maxCharges, type SkillId, type Skills } from '../game/skills'

interface Props {
  skills: Skills
  targeting: SkillId | null
  onToggle: (id: SkillId) => void
}

export function SkillBar({ skills, targeting, onToggle }: Props) {
  const actives = SKILL_ORDER.filter((id) => SKILLS[id].active)
  return (
    <div className="skillbar">
      {actives.map((id, i) => {
        const def = SKILLS[id]
        const sk = skills[id]
        const max = sk ? maxCharges(id, sk.level) : 0
        const ready = !!sk && sk.charges > 0
        return (
          <button
            key={id}
            className={`skill${sk ? '' : ' locked'}${ready ? ' ready' : ''}${targeting === id ? ' active' : ''}`}
            onClick={() => onToggle(id)}
            disabled={!ready}
            title={sk ? def.desc(sk.level) : '過關後可解鎖'}
          >
            <span className="skill-key">{sk ? i + 1 : '🔒'}</span>
            <span className="skill-icon">{def.icon}</span>
            <span className="skill-name">
              {def.name}
              {sk && <small> Lv{sk.level}</small>}
            </span>
            <span className="pips">
              {Array.from({ length: max }, (_, k) => (
                <i key={k} className={k < (sk?.charges ?? 0) ? 'pip on' : 'pip'} />
              ))}
            </span>
          </button>
        )
      })}
    </div>
  )
}
