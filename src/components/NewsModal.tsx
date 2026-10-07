import { useState } from 'react'
import { CHANGELOG, type ReleaseNote } from '../game/changelog'
import { checkForUpdate } from './Pwa'

const UPDATE_TEXT = {
  found: '找到新版本，點下方「更新」',
  latest: '已經是最新版本',
  offline: '目前沒有網路，連上網路後再試',
  unsupported: '這個瀏覽器不支援離線版更新，重新整理頁面即可',
} as const

const buildDate = () => {
  const d = new Date(__BUILD_TIME__)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

interface Props {
  onClose: () => void
  /** 更新後自動跳出時：有玩法改變的新版本，在最上面說明新玩法 */
  gameplayNotes?: ReleaseNote[]
}

/** 更新內容：最新的在最上面 */
export function NewsModal({ onClose, gameplayNotes }: Props) {
  const howTo = (gameplayNotes ?? []).flatMap((n) => n.howTo ?? [])
  const [checking, setChecking] = useState<keyof typeof UPDATE_TEXT | 'checking' | null>(null)
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wide news" role="dialog" aria-labelledby="news-title">
        <button className="modal-close" onClick={onClose} aria-label="關閉">
          ✕
        </button>
        <div id="news-title" className="modal-title">
          {howTo.length ? '玩法有更新' : '更新內容'}
        </div>
        {howTo.length > 0 && (
          <ul className="howto">
            {howTo.map((h) => (
              <li key={h.text}>
                <span className="howto-icon">{h.icon}</span>
                <span>{h.text}</span>
              </li>
            ))}
          </ul>
        )}
        {CHANGELOG.map((note, i) => (
          <section key={note.id} className={`release${i === 0 ? ' latest' : ''}`}>
            <div className="release-head">
              <span className="release-title">{note.title}</span>
              <span className="release-date">{note.date}</span>
            </div>
            <ul className="release-items">
              {note.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
        <button className="btn primary" onClick={onClose}>
          開始玩
        </button>
        <div className="version-row">
          <span>
            目前版本 {__APP_VERSION__} · {buildDate()}
          </span>
          <button
            className="btn small"
            disabled={checking === 'checking'}
            onClick={async () => {
              setChecking('checking')
              setChecking(await checkForUpdate())
            }}
          >
            {checking === 'checking' ? '檢查中…' : '檢查更新'}
          </button>
        </div>
        {checking && checking !== 'checking' && <p className="version-note">{UPDATE_TEXT[checking]}</p>}
      </div>
    </div>
  )
}
