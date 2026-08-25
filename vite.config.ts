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
  build: {
    rollupOptions: {
      output: {
        // 리액트는 버전을 올려도 거의 안 바뀌니 따로 떼어 캐시가 살아남게 한다.
        // 진입점 이름('react-dom')만 적으면 실제 구현이 앱 청크에 남아 효과가 없다.
        manualChunks(id: string) {
          if (/node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react'
        },
      },
    },
  },
})
