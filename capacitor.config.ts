import type { CapacitorConfig } from '@capacitor/cli'

// 안드로이드 앱(APK) 껍데기 — 홈 화면 위젯을 붙이려고 만든다. 스토어 없이 APK 로 직접 나눠 준다(2026-11-25).
// server.url — 앱 안에 화면을 넣지 않고 배포된 사이트를 연다. 웹을 배포하면 앱을 다시 설치하지 않아도 바뀐다.
// 위젯(android/app/src/main/java/.../widget)은 네이티브라 위젯을 바꿀 때만 APK 를 다시 만든다.
// ⚠ appId 는 한 번 정하면 못 바꾼다(바꾸면 다른 앱으로 깔린다).
const config: CapacitorConfig = {
  appId: 'com.doyeonkr.weather',
  appName: '무능한 날씨예측기',
  webDir: 'native-shell', // 사이트에 못 닿을 때 보여줄 안내 한 장만 앱에 넣는다
  backgroundColor: '#f4f4f2',
  // 웹앱이 "우리 앱 안"임을 알게 — 이게 없으면 카카오톡 같은 앱 안 브라우저로 보고 위치를 막는다 (lib/inapp.ts)
  appendUserAgent: 'EojebodaApp',
  server: {
    url: 'https://doyeonkr.github.io/Weather-forecasting/',
    errorPath: 'index.html',
  },
}

export default config
