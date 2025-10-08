import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/rotating-multi-arc-game/',
  server: {
    open: true,
  },
  preview: {
    open: true,
  },
})
