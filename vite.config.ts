import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages: https://<user>.github.io/eojeboda/
export default defineConfig({
  base: '/eojeboda/',
  plugins: [react()],
})
