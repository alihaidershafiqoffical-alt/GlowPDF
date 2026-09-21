import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { spawn } from 'child_process'
import http from 'http'
import fs from 'fs'

function autoBackendPlugin(): Plugin {
  return {
    name: 'auto-backend-server',
    configureServer() {
      const req = http.get('http://127.0.0.1:8000/api/health', (res) => {
        if (res.statusCode === 200) {
          console.log('[auto-backend] Backend is already running on http://127.0.0.1:8000')
        }
      })
      req.on('error', () => {
        const py = fs.existsSync('server/.venv/Scripts/python.exe')
          ? 'server/.venv/Scripts/python.exe'
          : fs.existsSync('server/.venv/bin/python')
          ? 'server/.venv/bin/python'
          : 'python'
        console.log(`[auto-backend] Starting backend server via ${py}...`)
        const proc = spawn(py, ['server/main.py'], { stdio: 'inherit' })
        process.on('exit', () => proc.kill())
        process.on('SIGINT', () => {
          proc.kill()
          process.exit()
        })
        process.on('SIGTERM', () => {
          proc.kill()
          process.exit()
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), autoBackendPlugin()],
  server: {
    host: true,
    watch: {
      ignored: ['**/server/**', '**/*.tmp', '**/tmp/**', '**/*.docx', '**/*.pdf'],
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        timeout: 120000,
      },
    },
  },
})

