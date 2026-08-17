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

export type NotifyState = 'on' | 'off' | 'unsupported'

export async function getNotifyState(): Promise<NotifyState> {
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

/** 알림 켜기 — 권한 요청 후 구독을 서버에 저장. nightTime: 밤 알림 슬롯(예 '2130') */
export async function enableNotify(
  loc: { lat: number; lon: number; label: string },
  nightTime = '2130',
): Promise<boolean> {
  try {
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return false
    const reg = await navigator.serviceWorker.ready
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
    // 같은 endpoint 재구독 대비: 삭제 후 저장
    await fetch(`${SB_URL}/rest/v1/weather_push_subs?endpoint=eq.${encodeURIComponent(j.endpoint)}`, {
      method: 'DELETE',
      headers,
    }).catch(() => {})
    const res = await fetch(`${SB_URL}/rest/v1/weather_push_subs`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({
        endpoint: j.endpoint,
        p256dh: j.keys.p256dh,
        auth: j.keys.auth,
        lat: loc.lat,
        lon: loc.lon,
        label: loc.label.slice(0, 60),
        night_time: nightTime,
      }),
    })
    return res.ok
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
