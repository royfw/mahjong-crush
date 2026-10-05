import { memo } from 'react'
import type { Suit, Tile as TileData } from '../game/logic'

const NUMERALS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']
const SUIT_CHAR: Record<Suit, string> = { wan: '萬', tong: '筒', tiao: '條' }

interface Props {
  tile: TileData
  row: number
  col: number
  clearing: boolean
}

function TileView({ tile, row, col, clearing }: Props) {
  return (
    <div
      className={`tile-pos${clearing ? ' clearing' : ''}`}
      style={{ '--r': row, '--c': col } as React.CSSProperties}
    >
      <div className={`tile suit-${tile.suit}`} aria-label={`${tile.value}${SUIT_CHAR[tile.suit]}`}>
        <span className="tile-num">{NUMERALS[tile.value]}</span>
        <span className="tile-suit">{SUIT_CHAR[tile.suit]}</span>
        <span className="tile-corner">{tile.value}</span>
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
