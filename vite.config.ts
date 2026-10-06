import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { leaderboardApi } from './server/leaderboard.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    leaderboardApi(),
    // PWA：可安裝到手機主畫面；開過一次後整個遊戲離線可玩（排行榜 API 不快取）
    VitePWA({
      registerType: 'prompt', // 有新版時由畫面提示更新，避免遊戲中途被重新整理
      includeManifestIcons: false, // 圖示已由 globPatterns 的 png 涵蓋，避免重複
      manifest: {
        name: '雀消 Mahjong Crush',
        short_name: '雀消',
        description: '滑動麻將牌，湊出順子或刻子的消除遊戲',
        lang: 'zh-Hant',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0d0a14',
        theme_color: '#0d0a14',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    // 允許 cloudflared quick tunnel 的網域連入（手機 / 外部 Demo 用）
    allowedHosts: ['.trycloudflare.com'],
  },
})
