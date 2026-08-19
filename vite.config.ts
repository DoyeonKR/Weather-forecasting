import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json'

// GitHub Pages: https://doyeonkr.github.io/Weather-forecasting/
export default defineConfig({
  base: '/Weather-forecasting/',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
})
