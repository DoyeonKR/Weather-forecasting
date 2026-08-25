// 웹푸시 구독 관리 — 매일 아침·밤 날씨 알림
// 저장과 해제는 테이블을 직접 건드리지 않고 RPC 두 개로만 한다.
// (테이블을 열어두면 endpoint 를 아는 쪽이 남의 알림 지역을 덮어쓰거나 통째로 지울 수 있다.
//  스키마와 함수 정의는 supabase/sql/weather_push_subs.sql 참고)
import { SB_ANON, SB_URL } from './track'

const VAPID_PUBLIC =
  'BPoiXRatsIBxTbpFwTPoZ87skWs4-qKJsX3VVbZn1OS-8QigkrTI7FfZeN5Uq-SDWJaykFUdPXey0GfBdDrMU5g'

/** 서비스워커가 구독을 재발급할 때 다시 저장하려면 지역·시간이 필요하다 */
const PREFS_CACHE = 'eojeboda-push'
const PREFS_URL = 'https://eojeboda.local/push-prefs'

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export type NotifyState = 'on' | 'off' | 'blocked' | 'unsupported' | 'needs-install'

/** 알림 켜기 결과. 실패 사유가 다르면 안내 문구도 달라야 한다 */
export type EnableResult = 'ok' | 'denied' | 'no-sw' | 'save-failed' | 'save-unknown'

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

/** 아이폰·아이패드 판별. 아이패드 사파리는 userAgent 가 Macintosh 로 나온다 */
function isIos(): boolean {
  try {
    return (
      /iP(hone|od|ad)/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    )
  } catch {
    return false
  }
}

export async function getNotifyState(): Promise<NotifyState> {
  // iOS 는 홈 화면에 추가한 웹앱 안에서만 알림을 지원한다 (영구 미지원처럼 안내하지 않는다)
  const needsInstall = isIos() && !isStandalone()
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window))
    return needsInstall ? 'needs-install' : 'unsupported'
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) {
      if (needsInstall) return 'needs-install'
      return import.meta.env.PROD ? 'off' : 'unsupported'
    }
    const sub = await reg.pushManager.getSubscription()
    // 이미 켜져 있으면 어떤 환경이든 끌 수는 있어야 한다
    if (sub) return 'on'
    if (needsInstall) return 'needs-install'
    if (Notification.permission === 'denied') return 'blocked'
    return 'off'
  } catch {
    return needsInstall ? 'needs-install' : 'unsupported'
  }
}

/**
 * serviceWorker.ready 는 워커가 없으면 영원히 대기하므로 시간 제한을 둔다.
 * 설정 패널에서 사용자를 기다리게 하는 시간이라 짧게 잡는다.
 */
async function readyWithTimeout(ms = 4000): Promise<ServiceWorkerRegistration | null> {
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), ms)),
    ])
  } catch {
    return null
  }
}

/**
 * 구독 생성. 예전에 다른 VAPID 키로 구독한 흔적이 남아 있으면 subscribe 가
 * InvalidStateError 를 던지므로, 그때만 기존 구독을 정리하고 한 번 더 시도한다.
 */
async function subscribeWithRetry(reg: ServiceWorkerRegistration): Promise<PushSubscription> {
  const opts: PushSubscriptionOptionsInit = {
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC).buffer as ArrayBuffer,
  }
  try {
    return await reg.pushManager.subscribe(opts)
  } catch (err) {
    if ((err as Error)?.name !== 'InvalidStateError') throw err
    const stale = await reg.pushManager.getSubscription()
    if (stale) await stale.unsubscribe().catch(() => {})
    return await reg.pushManager.subscribe(opts)
  }
}

/** 서비스워커가 나중에 구독을 다시 만들 때 쓸 지역·시간을 남겨둔다 */
async function savePrefs(prefs: Record<string, unknown>): Promise<void> {
  try {
    const c = await caches.open(PREFS_CACHE)
    await c.put(PREFS_URL, new Response(JSON.stringify(prefs)))
  } catch {
    // 캐시를 못 써도 알림 자체는 동작한다
  }
}

/** 서비스워커가 남겨둔 마지막 구독 정보 */
async function readPrefs(): Promise<{ p_endpoint?: string } | null> {
  try {
    const c = await caches.open(PREFS_CACHE)
    const hit = await c.match(PREFS_URL)
    return hit ? await hit.json() : null
  } catch {
    return null
  }
}

async function removeOnServer(endpoint: string): Promise<boolean> {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/rpc/weather_push_remove`, {
      method: 'POST',
      headers: {
        apikey: SB_ANON,
        Authorization: `Bearer ${SB_ANON}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_endpoint: endpoint }),
    })
    return res.ok
  } catch {
    return false
  }
}

async function clearPrefs(): Promise<void> {
  try {
    const c = await caches.open(PREFS_CACHE)
    await c.delete(PREFS_URL)
  } catch {
    // 무시
  }
}

/** 알림 켜기 — 권한 요청 후 구독을 서버에 저장. 슬롯 형식 'HHmm' (예 '0730', '2130') */
export async function enableNotify(
  loc: { lat: number; lon: number; label: string },
  nightTime = '2130',
  morningTime = '0730',
): Promise<EnableResult> {
  let created: PushSubscription | null = null
  try {
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return 'denied'
    const reg = await readyWithTimeout()
    if (!reg) return 'no-sw'
    // 저장에 실패했을 때 무엇을 되돌릴지 판단하는 기준.
    // "구독이 있었나" 가 아니라 "이번에 endpoint 가 새로 생겼나" 로 본다.
    // subscribeWithRetry 가 낡은 구독을 정리하고 다시 만든 경우도 여기서 잡힌다.
    const before = await reg.pushManager.getSubscription()
    const prevEndpoint = before ? before.endpoint : null
    const sub = await subscribeWithRetry(reg)
    if (sub.endpoint !== prevEndpoint) created = sub
    const j = sub.toJSON()
    if (!j.endpoint || !j.keys) {
      if (created) await created.unsubscribe().catch(() => {})
      return 'save-failed'
    }
    const body = {
      p_endpoint: j.endpoint,
      p_p256dh: j.keys.p256dh,
      p_auth: j.keys.auth,
      p_lat: loc.lat,
      p_lon: loc.lon,
      p_label: loc.label.slice(0, 60),
      p_night_time: nightTime,
      p_morning_time: morningTime,
    }
    // 함수 안에서 endpoint 기준으로 업서트한다. 예전처럼 삭제 후 삽입하면
    // 그 사이에 실패했을 때 구독이 통째로 사라진다.
    let res: Response
    try {
      res = await fetch(`${SB_URL}/rest/v1/rpc/weather_push_save`, {
        method: 'POST',
        headers: {
          apikey: SB_ANON,
          Authorization: `Bearer ${SB_ANON}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
    } catch {
      // 요청이 서버에 닿았는지 알 수 없다. 화면을 되돌리면 서버와 반대로 어긋날 수 있다.
      if (created) await created.unsubscribe().catch(() => {})
      return 'save-unknown'
    }
    if (!res.ok) {
      if (import.meta.env.DEV) {
        const detail = await res.text().catch(() => '')
        console.warn('[push] 구독 저장 실패', res.status, detail)
      }
      // 서버에 저장하지 못했는데 브라우저 구독만 남으면 상태가 어긋난다.
      // 이번에 새로 만든 경우에만 되돌린다 (시간 변경 등 기존 구독은 유지).
      if (created) await created.unsubscribe().catch(() => {})
      return 'save-failed'
    }
    await savePrefs(body)
    return 'ok'
  } catch {
    if (created) await created.unsubscribe().catch(() => {})
    return 'save-failed'
  }
}

/** 알림 끄기 — 서버 구독 삭제 후 브라우저 구독 해제. 실패하면 false */
export async function disableNotify(): Promise<boolean> {
  try {
    // 켜기와 같은 방식으로 기다린다. getRegistration 만 쓰면 앱을 켜자마자 끌 때
    // 워커가 아직 없어서 아무것도 안 하고 성공한 척 끝난다.
    const reg = await readyWithTimeout()
    if (!reg) return false
    const sub = await reg.pushManager.getSubscription()
    if (!sub) {
      // 브라우저 구독만 사라지고 서버 행은 남아 있을 수 있다. 그대로 두면 내일 아침에도 온다.
      const prefs = await readPrefs()
      const stale = prefs?.p_endpoint
      if (!stale) return true
      if (!(await removeOnServer(stale))) return false
      await clearPrefs()
      return true
    }
    // 서버 행이 남았는데 브라우저 구독만 지우면 내일 아침에도 알림이 온다
    if (!(await removeOnServer(sub.endpoint))) return false
    await sub.unsubscribe()
    await clearPrefs()
    return true
  } catch {
    return false
  }
}
