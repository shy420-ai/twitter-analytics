import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages base path — https://shy420-ai.github.io/twitter-analytics/
export default defineConfig({
  base: '/twitter-analytics/',
  plugins: [react()],
})
