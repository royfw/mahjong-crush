import { CHANGELOG } from '../game/changelog'

interface Props {
  onClose: () => void
}

/** 更新內容：最新的在最上面 */
export function NewsModal({ onClose }: Props) {
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wide news" role="dialog" aria-labelledby="news-title">
        <button className="modal-close" onClick={onClose} aria-label="關閉">
          ✕
        </button>
        <div id="news-title" className="modal-title">
          更新內容
        </div>
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
