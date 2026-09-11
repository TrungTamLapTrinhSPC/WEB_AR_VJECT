import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Production nginx: location /ar/ { alias /home/frontend/ar/; ... }
  const base = env.VITE_BASE_PATH || '/'
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://localhost:3001'

  return {
    base,
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
