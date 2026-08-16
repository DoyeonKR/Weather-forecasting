// 자체 방문 집계 — Supabase 테이블에 익명 방문 1건 기록 (세션당 1회)
// anon 키는 공개용이며, RLS 로 기록(insert)만 허용되고 조회는 차단됨.

export const SB_URL = 'https://tqegatiuembcvphxmujl.supabase.co'
export const SB_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxZWdhdGl1ZW1iY3ZwaHhtdWpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4ODgwMjMsImV4cCI6MjA5ODQ2NDAyM30.gEWhDmgJ5BVaobNobOP8LPZDeU_uIfYD4wE_ea1Rgmc'

function visitorId(): string {
  try {
    const KEY = 'eojeboda:vid'
    let id = localStorage.getItem(KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    return 'no-storage'
  }
}

/** 앱 로드 시 1회 호출. 같은 브라우저 세션에서는 중복 기록하지 않음 */
export function trackVisit(): void {
  try {
    if (!import.meta.env.PROD) return // 개발 중에는 기록 안 함
    if (sessionStorage.getItem('eojeboda:tracked')) return
    sessionStorage.setItem('eojeboda:tracked', '1')
    const isPwa =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
    fetch(`${SB_URL}/rest/v1/weather_page_views`, {
      method: 'POST',
      headers: {
        apikey: SB_ANON,
        Authorization: `Bearer ${SB_ANON}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        session_id: visitorId(),
        path: location.pathname,
        referrer: document.referrer.slice(0, 200) || null,
        is_pwa: isPwa,
        ua: navigator.userAgent.slice(0, 200),
      }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // 집계 실패는 앱 동작에 영향 없음
  }
}

/** 오늘(KST) 순 방문자 수. 실패 시 null */
export async function fetchTodayVisitors(): Promise<number | null> {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/rpc/weather_today_visitors`, {
      method: 'POST',
      headers: {
        apikey: SB_ANON,
        Authorization: `Bearer ${SB_ANON}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    })
    if (!res.ok) return null
    const n = await res.json()
    return typeof n === 'number' ? n : null
  } catch {
    return null
  }
}
