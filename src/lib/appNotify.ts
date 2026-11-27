// 안드로이드 앱(APK) 안 날씨 알림 (네이티브: android/.../AppNotify.java, notify/).
// 웹뷰는 웹 푸시를 못 받아서 앱이 직접 아침·밤에 예보를 받아 알림을 만든다 (서버와 같은 문구).
// 1.0.110 부터 있는 플러그인 — 그 전 앱(1.0.106·1.0.108)에서는 canAppNotify() 가 false 라 "앱을 업데이트" 안내만.
import { isNativeApp } from './nativeWidget'

export type AppNotifyInfo = { enabled: boolean; allowed: boolean; morning: string; night: string; label: string }
export type AppNotifyPrefs = {
  lat?: number
  lon?: number
  label?: string
  persona?: string
  morning?: string
  night?: string
}

interface AppNotifyPlugin {
  info(): Promise<AppNotifyInfo>
  enable(p: AppNotifyPrefs): Promise<{ status: 'on' | 'denied' | 'blocked' }>
  disable(): Promise<void>
  update(p: AppNotifyPrefs): Promise<void>
  test(): Promise<{ status: 'sent' | 'failed' | 'blocked' }>
  openSettings(): Promise<void>
}

type CapWindow = { Capacitor?: { isPluginAvailable?: (n: string) => boolean } }

/** 이 앱이 스스로 알림을 띄울 수 있나 (AppNotify 플러그인이 있는 앱) */
export function canAppNotify(): boolean {
  if (!isNativeApp()) return false
  try {
    return !!(window as unknown as CapWindow).Capacitor?.isPluginAvailable?.('AppNotify')
  } catch {
    return false
  }
}

// ⚠ 플러그인 Proxy 를 Promise 로 넘기지 않는다 (nativeWidget.ts 와 같은 이유) — 상자에 담는다
let box: Promise<{ p: AppNotifyPlugin }> | null = null
function plugin(): Promise<{ p: AppNotifyPlugin }> {
  box ??= import('@capacitor/core').then(({ registerPlugin }) => ({ p: registerPlugin<AppNotifyPlugin>('AppNotify') }))
  return box
}

export async function appNotifyInfo(): Promise<AppNotifyInfo | null> {
  if (!canAppNotify()) return null
  try {
    const b = await plugin()
    return await b.p.info()
  } catch {
    return null
  }
}

export async function appNotifyEnable(p: AppNotifyPrefs): Promise<'on' | 'denied' | 'blocked' | 'failed'> {
  try {
    const b = await plugin()
    return (await b.p.enable(p)).status
  } catch {
    return 'failed'
  }
}

export async function appNotifyDisable(): Promise<boolean> {
  try {
    const b = await plugin()
    await b.p.disable()
    return true
  } catch {
    return false
  }
}

/** 기준 지역·말투·시간을 앱에 넘긴다 (꺼져 있어도 저장 — 켤 때 그대로 쓴다). 지역을 모르면(null) 지역은 그대로 */
export function syncAppNotify(place: { lat: number; lon: number; label: string } | null, persona: string): void {
  if (!canAppNotify()) return
  const p: AppNotifyPrefs = { persona }
  if (place) Object.assign(p, { lat: place.lat, lon: place.lon, label: place.label })
  plugin()
    .then((b) => b.p.update(p))
    .catch(() => {})
}

/** 값 일부만 바꾸기 (시간 등) — 끝날 때까지 기다린다 */
export async function appNotifyUpdate(p: AppNotifyPrefs): Promise<void> {
  try {
    const b = await plugin()
    await b.p.update(p)
  } catch {
    // 다음에 다시
  }
}

export async function appNotifyTest(): Promise<'sent' | 'failed' | 'blocked'> {
  try {
    const b = await plugin()
    return (await b.p.test()).status
  } catch {
    return 'failed'
  }
}

export async function appNotifyOpenSettings(): Promise<void> {
  try {
    const b = await plugin()
    await b.p.openSettings()
  } catch {
    // 설정 화면을 못 열면 안내 문구만
  }
}
