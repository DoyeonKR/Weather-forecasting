import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { RootBoundary } from './components/ErrorBoundary.tsx'
import UpdateBanner from './components/UpdateBanner.tsx'
import { trackVisit } from './lib/track.ts'
import { captureInstallPrompt } from './lib/install.ts'
import { watchFreshWeb } from './lib/freshWeb.ts'

trackVisit()
captureInstallPrompt()
// 새로 배포된 웹이 있으면 다시 불러온다 (앱은 뒤로 보냈다 열어도 예전 코드를 계속 쓴다)
watchFreshWeb()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootBoundary>
      <App />
    </RootBoundary>
    {/* 안드로이드 앱 안 새 버전 알림 — App 바깥에 둬서 날씨를 못 불러오거나 화면이 깨져도 업데이트 길은 보인다 */}
    <UpdateBanner />
  </StrictMode>,
)

// PWA: 프로덕션에서만 서비스워커 등록
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}
