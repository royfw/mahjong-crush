import { CHANGELOG, type ReleaseNote } from '../game/changelog'

interface Props {
  onClose: () => void
  /** 更新後自動跳出時：有玩法改變的新版本，在最上面說明新玩法 */
  gameplayNotes?: ReleaseNote[]
}

/** 更新內容：最新的在最上面 */
export function NewsModal({ onClose, gameplayNotes }: Props) {
  const howTo = (gameplayNotes ?? []).flatMap((n) => n.howTo ?? [])
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
      </div>
    </div>
  )
}
