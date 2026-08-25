// 웹푸시 구독 관리 — 매일 아침·밤 날씨 알림
import { SB_ANON, SB_URL } from './track'

const VAPID_PUBLIC =
  'BPoiXRatsIBxTbpFwTPoZ87skWs4-qKJsX3VVbZn1OS-8QigkrTI7FfZeN5Uq-SDWJaykFUdPXey0GfBdDrMU5g'

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export type NotifyState = 'on' | 'off' | 'unsupported' | 'needs-install'

/** 홈 화면에 설치된 상태(PWA)로 실행 중인지 */
function isStandalone(): boolean {
  try {
    return (
      window.matchMedia?.('(display-mode: standalone)').matches === true ||
      (navigator as { standalone?: boolean }).standalone === true
    )
  } catch {
    return false
  }
}

export async function getNotifyState(): Promise<NotifyState> {
  // iOS 는 홈 화면에 추가한 웹앱 안에서만 알림을 지원한다 (영구 미지원처럼 안내하지 않는다)
  if (/iP(hone|od|ad)/.test(navigator.userAgent) && !isStandalone()) return 'needs-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window))
    return 'unsupported'
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return import.meta.env.PROD ? 'off' : 'unsupported'
    const sub = await reg.pushManager.getSubscription()
    return sub ? 'on' : 'off'
  } catch {
    return 'unsupported'
  }
}

/** serviceWorker.ready 는 워커가 없으면 영원히 대기하므로 시간 제한을 둔다 */
async function readyWithTimeout(ms = 8000): Promise<ServiceWorkerRegistration | null> {
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), ms)),
    ])
  } catch {
    return null
  }
}

/** 알림 켜기 — 권한 요청 후 구독을 서버에 저장. 슬롯 형식 'HHmm' (예 '0730', '2130') */
export async function enableNotify(
  loc: { lat: number; lon: number; label: string },
  nightTime = '2130',
  morningTime = '0730',
): Promise<boolean> {
  try {
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return false
    const reg = await readyWithTimeout()
    if (!reg) return false
    // 이미 등록돼 있던 구독인지 기억해 둔다 (저장 실패 시 되돌릴지 판단)
    const hadSubscription = (await reg.pushManager.getSubscription()) !== null
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC).buffer as ArrayBuffer,
    })
    const j = sub.toJSON()
    if (!j.endpoint || !j.keys) return false
    const headers = {
      apikey: SB_ANON,
      Authorization: `Bearer ${SB_ANON}`,
      'Content-Type': 'application/json',
    }
    // endpoint 는 유니크 제약이 있으므로 upsert 로 저장한다.
    // 예전처럼 삭제 후 삽입하면 그 사이에 실패했을 때 구독이 통째로 사라진다.
    const res = await fetch(`${SB_URL}/rest/v1/weather_push_subs`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        endpoint: j.endpoint,
        p256dh: j.keys.p256dh,
        auth: j.keys.auth,
        lat: loc.lat,
        lon: loc.lon,
        label: loc.label.slice(0, 60),
        night_time: nightTime,
        morning_time: morningTime,
      }),
    })
    if (!res.ok) {
      // 서버에 저장하지 못했는데 브라우저 구독만 남으면 상태가 어긋난다.
      // 이번에 새로 만든 경우에만 되돌린다 (시간 변경 등 기존 구독은 유지).
      if (!hadSubscription) await sub.unsubscribe().catch(() => {})
      return false
    }
    return true
  } catch {
    return false
  }
}

/** 알림 끄기 — 서버 구독 삭제 후 브라우저 구독 해제 */
export async function disableNotify(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (sub) {
      await fetch(
        `${SB_URL}/rest/v1/weather_push_subs?endpoint=eq.${encodeURIComponent(sub.endpoint)}`,
        {
          method: 'DELETE',
          headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` },
        },
      ).catch(() => {})
      await sub.unsubscribe()
    }
  } catch {
    // 무시
  }
}
