// 안드로이드 앱(APK) 안에서만: 홈 화면 위젯과 이야기한다 (네이티브 쪽: android/.../WidgetBridge.java).
// 웹(브라우저·홈 화면 웹앱)에서는 모두 아무 일도 하지 않는다. @capacitor/core 는 앱 안에서만 불러온다(웹 번들에 안 넣는다).

interface WidgetBridgePlugin {
  setPlace(o: { lat: number; lon: number; label: string }): Promise<void>
  pin(): Promise<{ requested: boolean }>
  info(): Promise<{ pinSupported: boolean; count: number }>
}

type CapWindow = { Capacitor?: { isNativePlatform?: () => boolean } }

/** 우리 안드로이드 앱 안에서 열렸나 */
export function isNativeApp(): boolean {
  try {
    return !!(window as unknown as CapWindow).Capacitor?.isNativePlatform?.()
  } catch {
    return false
  }
}

// ⚠ 플러그인 객체(Proxy)는 Promise 로 넘기거나 async 함수에서 return 하면 안 된다 — Promise 가 .then 을 찾다가
//   그걸 네이티브 메서드 "then" 으로 불러 영원히 기다린다(실제로 위젯 추가 버튼이 아무 반응 없었다).
//   그래서 상자({ p })에 담아 두고, 꺼낸 자리에서 바로 메서드를 부른다.
let box: Promise<{ p: WidgetBridgePlugin }> | null = null
function bridge(): Promise<{ p: WidgetBridgePlugin }> {
  box ??= import('@capacitor/core').then(({ registerPlugin }) => ({ p: registerPlugin<WidgetBridgePlugin>('WidgetBridge') }))
  return box
}

/** 앱에서 보고 있는 동네를 위젯에 넘긴다 — 위젯은 마지막으로 본 동네를 보여준다 */
export function syncWidgetPlace(place: { lat: number; lon: number; label: string }): void {
  if (!isNativeApp()) return
  bridge()
    .then((b) => b.p.setPlace({ lat: place.lat, lon: place.lon, label: place.label }))
    .catch(() => {})
}

/** 시스템 "위젯 추가" 창. 런처가 지원하지 않으면 false (직접 추가 안내를 보여준다) */
export async function pinWidget(): Promise<boolean> {
  if (!isNativeApp()) return false
  try {
    const b = await bridge()
    return (await b.p.pin()).requested
  } catch {
    return false
  }
}

export async function widgetInfo(): Promise<{ pinSupported: boolean; count: number } | null> {
  if (!isNativeApp()) return null
  try {
    const b = await bridge()
    return await b.p.info()
  } catch {
    return null
  }
}

/** 안드로이드 앱(APK) 받기 — GitHub Releases 의 고정 주소. 새 버전을 올려도 이 주소는 그대로 최신을 준다 */
export const APK_URL = 'https://github.com/DoyeonKR/Weather-forecasting/releases/latest/download/eojeboda-weather.apk'

/** 안드로이드 폰의 웹(브라우저·홈 화면 웹앱)에서만 "앱 받기"를 보여준다 — 앱 안·아이폰·PC 에서는 숨김 */
export function showApkDownload(ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): boolean {
  return /Android/i.test(ua) && !/EojebodaApp/.test(ua) && !isNativeApp()
}
