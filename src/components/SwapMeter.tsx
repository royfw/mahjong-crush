import { swapRules, type Skills } from '../game/skills'

interface Props {
  swaps: number
  slidesToRecharge: number
  skills: Skills
}

/** 換牌 / 擠壓共用次數：推整盤幾次回 1 次；過關選「🔄 巧手」可提高上限、加快回充，Lv3 換牌不算步數 */
export function SwapMeter({ swaps, slidesToRecharge, skills }: Props) {
  const { max, freeSwap } = swapRules(skills)
  const level = skills.nimble?.level ?? 0
  return (
    <div className="swapmeter" title="長按一張牌再滑可以換位；推不動時再推一次可以擠壓。過關選「🔄 巧手」可以升級">
      <span className="swap-label">🔄 換牌 / 擠壓{level > 0 && <small> Lv{level}</small>}</span>
      <span className="pips">
        {Array.from({ length: max }, (_, i) => (
          <i key={i} className={i < swaps ? 'pip on' : 'pip'} />
        ))}
      </span>
      <span className="swap-note">
        {freeSwap && <b className="nowrap">換牌免步數　</b>}
        <span className="nowrap">{swaps >= max ? '已滿' : `再推整盤 ${slidesToRecharge} 次 +1`}</span>
      </span>
    </div>
  )
}
