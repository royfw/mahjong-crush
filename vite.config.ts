import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { leaderboardApi } from './server/leaderboard.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), leaderboardApi()],
  server: {
    // 允許 cloudflared quick tunnel 的網域連入（手機 / 外部 Demo 用）
    allowedHosts: ['.trycloudflare.com'],
  },
})
