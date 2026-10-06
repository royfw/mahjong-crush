import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const CHECK_INTERVAL_MS = 60 * 60 * 1000

/**
 * 定期檢查新版本：每小時一次，另外在切回 App 時也檢查（手機放背景時計時器會暫停）。
 * 兩者共用節流，最多一小時檢查一次；離線時略過。
 */
function scheduleUpdateChecks(swUrl: string, registration: ServiceWorkerRegistration) {
  let lastCheck = Date.now()
  const check = async () => {
    if (Date.now() - lastCheck < CHECK_INTERVAL_MS || registration.installing || !navigator.onLine) return
    lastCheck = Date.now()
    try {
      // 先確認伺服器可連線，避免在不穩的網路下讓 update() 報錯
      const res = await fetch(swUrl, { cache: 'no-store' })
      if (res.ok) await registration.update()
    } catch {
      /* 網路不穩：下次再試 */
    }
  }
  setInterval(check, CHECK_INTERVAL_MS)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check()
  })
}

/** 下載完成（可離線）與有新版本時的提示 */
export function PwaPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (registration) scheduleUpdateChecks(swUrl, registration)
    },
  })

  useEffect(() => {
    if (!offlineReady) return
    const t = setTimeout(() => setOfflineReady(false), 6000)
    return () => clearTimeout(t)
  }, [offlineReady, setOfflineReady])

  if (needRefresh) {
    return (
      <div className="pwa-banner" role="status">
        <span>有新版本</span>
        <button className="btn small" onClick={() => void updateServiceWorker(true)}>
          更新
        </button>
      </div>
    )
  }
  if (offlineReady) {
    return (
      <div className="pwa-banner" role="status">
        <span>已下載完成，沒有網路也能玩</span>
      </div>
    )
  }
  return null
}

interface InstallEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

const isIos = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** 「安裝到主畫面」：Android / 桌機 Chrome 直接跳安裝；iOS 顯示操作步驟 */
export function InstallButton() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone)
  const [showIosHelp, setShowIosHelp] = useState(false)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as InstallEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed || (!deferred && !isIos())) return null

  return (
    <>
      <button
        className="btn ghost"
        onClick={async () => {
          if (deferred) {
            await deferred.prompt()
            if ((await deferred.userChoice).outcome === 'accepted') setInstalled(true)
            setDeferred(null)
          } else {
            setShowIosHelp(true)
          }
        }}
      >
        安裝到主畫面
      </button>
      {showIosHelp && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowIosHelp(false)}>
          <div className="modal">
            <button className="modal-close" onClick={() => setShowIosHelp(false)} aria-label="關閉">
              ✕
            </button>
            <div className="modal-title">安裝到主畫面</div>
            <ol className="install-steps">
              <li>
                用 <b>Safari</b> 開啟這個頁面
              </li>
              <li>
                點下方工具列的 <b>分享</b> 按鈕
              </li>
              <li>
                選 <b>加入主畫面</b>，再點 <b>新增</b>
              </li>
            </ol>
            <p className="modal-text">安裝後從主畫面開啟，沒有網路也能玩。分數會在連線後自動上傳到排行榜。</p>
          </div>
        </div>
      )}
    </>
  )
}
