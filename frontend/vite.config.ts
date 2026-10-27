import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The API is always same-origin under /api: nginx proxies it in Docker,
// Vercel rewrites it in production, and this proxy does it in local dev.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
