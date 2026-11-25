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

let bridge: Promise<WidgetBridgePlugin> | null = null
function getBridge(): Promise<WidgetBridgePlugin> {
  bridge ??= import('@capacitor/core').then(({ registerPlugin }) => registerPlugin<WidgetBridgePlugin>('WidgetBridge'))
  return bridge
}

/** 앱에서 보고 있는 동네를 위젯에 넘긴다 — 위젯은 마지막으로 본 동네를 보여준다 */
export function syncWidgetPlace(p: { lat: number; lon: number; label: string }): void {
  if (!isNativeApp()) return
  getBridge()
    .then((b) => b.setPlace({ lat: p.lat, lon: p.lon, label: p.label }))
    .catch(() => {})
}

/** 시스템 "위젯 추가" 창. 런처가 지원하지 않으면 false (직접 추가 안내를 보여준다) */
export async function pinWidget(): Promise<boolean> {
  if (!isNativeApp()) return false
  try {
    return (await (await getBridge()).pin()).requested
  } catch {
    return false
  }
}

export async function widgetInfo(): Promise<{ pinSupported: boolean; count: number } | null> {
  if (!isNativeApp()) return null
  try {
    return await (await getBridge()).info()
  } catch {
    return null
  }
}
