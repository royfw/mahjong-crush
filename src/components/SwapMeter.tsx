import { SWAP_MAX } from '../game/skills'

interface Props {
  swaps: number
  slidesToRecharge: number
}

/** 換牌次數：推一張牌和鄰牌交換時消耗，推整盤幾次回 1 次 */
export function SwapMeter({ swaps, slidesToRecharge }: Props) {
  return (
    <div className="swapmeter" title="推一張牌和旁邊的牌交換，能湊成牌型才會換">
      <span className="swap-label">🔄 換牌</span>
      <span className="pips">
        {Array.from({ length: SWAP_MAX }, (_, i) => (
          <i key={i} className={i < swaps ? 'pip on' : 'pip'} />
        ))}
      </span>
      <span className="swap-note">{swaps >= SWAP_MAX ? '已滿' : `再推整盤 ${slidesToRecharge} 次 +1`}</span>
    </div>
  )
}
