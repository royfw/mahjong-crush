import { memo } from 'react'
import type { Power, Suit, Tile as TileData } from '../game/logic'

const NUMERALS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']
const SUIT_CHAR: Record<Suit, string> = { wan: '萬', tong: '筒', tiao: '條' }
export const POWER_INFO: Record<Power, { icon: string; name: string }> = {
  plus: { icon: '➕', name: '連帶' },
  row: { icon: '↔', name: '橫排' },
  col: { icon: '↕', name: '直排' },
  cross: { icon: '✚', name: '十字' },
  blast: { icon: '💥', name: '爆破' },
  suit: { icon: '🎨', name: '同花' },
}

interface Props {
  tile: TileData
  row: number
  col: number
  clearing: boolean
}

function TileView({ tile, row, col, clearing }: Props) {
  return (
    <div className={`tile-pos${clearing ? ' clearing' : ''}`} style={{ '--r': row, '--c': col } as React.CSSProperties}>
      <div
        className={`tile suit-${tile.suit}${tile.power ? ` has-power power-${tile.power}` : ''}`}
        aria-label={`${tile.value}${SUIT_CHAR[tile.suit]}${tile.power ? `（${POWER_INFO[tile.power].name}）` : ''}`}
      >
        <span className="tile-num">{NUMERALS[tile.value]}</span>
        <span className="tile-suit">{SUIT_CHAR[tile.suit]}</span>
        <span className="tile-corner">{tile.value}</span>
        {tile.power && (
          <span key={tile.power} className="power-badge">
            {POWER_INFO[tile.power].icon}
          </span>
        )}
      </div>
    </div>
  )
}

export const Tile = memo(TileView)

/** 說明區用的小牌（靜態） */
export function MiniTile({ suit, value }: { suit: Suit; value: number }) {
  return (
    <div className={`tile mini suit-${suit}`}>
      <span className="tile-num">{NUMERALS[value]}</span>
      <span className="tile-suit">{SUIT_CHAR[suit]}</span>
    </div>
  )
}
