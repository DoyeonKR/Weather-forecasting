import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { RootBoundary } from './components/ErrorBoundary.tsx'
import { trackVisit } from './lib/track.ts'
import { applySavedAccent } from './lib/accent.ts'
import { captureInstallPrompt } from './lib/install.ts'

trackVisit()
applySavedAccent()
captureInstallPrompt()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootBoundary>
      <App />
    </RootBoundary>
  </StrictMode>,
)

// PWA: 프로덕션에서만 서비스워커 등록
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}
