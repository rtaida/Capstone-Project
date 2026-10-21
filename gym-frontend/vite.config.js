import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const certDir = path.resolve(__dirname, 'certs')
const keyPath = path.join(certDir, 'localhost-key.pem')
const certPath = path.join(certDir, 'localhost-cert.pem')
const localHttps = fs.existsSync(keyPath) && fs.existsSync(certPath)
  ? {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    }
  : undefined
const proxyTarget = process.env.VITE_PROXY_TARGET || 'http://localhost/Capstone%20Project/gym-backend'

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    https: localHttps,
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
      '/Capstone%20Project': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
      '/Capstone Project': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
      '/profile_uploads': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
      '/qrcodes': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
      '/session_uploads': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: false,
    https: localHttps,
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
      '/Capstone%20Project': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
      '/Capstone Project': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
      '/profile_uploads': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
      '/qrcodes': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
      '/session_uploads': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})