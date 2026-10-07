import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const CHECK_INTERVAL_MS = 60 * 60 * 1000 // 一直開著：每小時檢查
const RESUME_CHECK_MS = 5 * 60 * 1000 // 切回 App：距上次檢查超過 5 分鐘就檢查

// 手機開 App 常常是從背景恢復、不會重新載入頁面，瀏覽器就不會自己檢查新版本，所以要主動檢查
let sw: { url: string; registration: ServiceWorkerRegistration } | null = null
let lastCheck = Date.now()

export type UpdateCheckResult = 'found' | 'latest' | 'offline' | 'unsupported'

/** 立刻檢查新版本；找到時會自動出現「有新版本 [更新]」 */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  if (!sw) return 'unsupported'
  if (!navigator.onLine) return 'offline'
  const { url, registration } = sw
  lastCheck = Date.now()
  try {
    // 先確認伺服器可連線（避免機上 Wi-Fi 登入頁之類的情況讓 update() 報錯）
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return 'offline'
    await registration.update()
    return registration.installing || registration.waiting ? 'found' : 'latest'
  } catch {
    return 'offline'
  }
}

function scheduleUpdateChecks(swUrl: string, registration: ServiceWorkerRegistration) {
  sw = { url: swUrl, registration }
  lastCheck = Date.now()
  const checkIfStale = (minGap: number) => {
    if (Date.now() - lastCheck < minGap || registration.installing) return
    void checkForUpdate()
  }
  setInterval(() => checkIfStale(CHECK_INTERVAL_MS), CHECK_INTERVAL_MS)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkIfStale(RESUME_CHECK_MS)
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
