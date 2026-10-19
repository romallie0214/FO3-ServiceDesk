// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'

// // https://vite.dev/config/
// export default defineConfig({
//   plugins: [react()],
// })


import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src blob:",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' https://www.google.com https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' http://localhost:3001 ws://localhost:5174",
  "frame-src 'self' blob: https://www.google.com",
  "media-src 'self' blob:",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
].join('; ')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5174,
    // Keep the browser origin predictable for the backend CORS allowlist.
    // If it is occupied, Vite reports it instead of silently changing to 5175.
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
    headers: {
      'X-Frame-Options': 'DENY',
    },
  },
  preview: {
    headers: {
      'Content-Security-Policy': contentSecurityPolicy,
      'X-Frame-Options': 'DENY',
    },
  },
})
