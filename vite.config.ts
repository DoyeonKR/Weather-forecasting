import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages: https://doyeonkr.github.io/Weather-forecasting/
export default defineConfig({
  base: '/Weather-forecasting/',
  plugins: [react()],
})
