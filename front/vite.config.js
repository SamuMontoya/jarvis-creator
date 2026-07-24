import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['.ngrok-free.app', '.ngrok.app', 'nuptials-slacks-gender.ngrok-free.dev'],
    hmr: {
      clientPort: 443
    }
  }
})
