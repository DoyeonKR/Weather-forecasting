// 테스트 알림 — 설정에서 "테스트 알림 보내기"를 누르면 그 기기 구독에만 한 통 보낸다.
// POST { endpoint } → 200 sent / 404 구독 없음 / 429 1분 안에 이미 보냄
// 구독 행이 있는 endpoint 에만 보내므로, 남의 기기로는 보낼 수 없다(endpoint 는 그 기기만 안다).
import webpush from 'npm:web-push@3.6.7'

const VAPID_PUBLIC = Deno.env.get('WEATHER_VAPID_PUBLIC')!
const VAPID_PRIVATE = Deno.env.get('WEATHER_VAPID_PRIVATE')!
const SB_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

webpush.setVapidDetails('mailto:kdy7854@naver.com', VAPID_PUBLIC, VAPID_PRIVATE)

const ALLOWED = ['https://doyeonkr.github.io', 'http://localhost:5173', 'http://localhost:4173']

function cors(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED.includes(origin) ? origin : ALLOWED[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, apikey, authorization',
    Vary: 'Origin',
  }
}

Deno.serve(async (req: Request) => {
  const h = cors(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response(null, { headers: h })
  if (req.method !== 'POST') return new Response('method', { status: 405, headers: h })
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...h, 'Content-Type': 'application/json' } })

  let endpoint = ''
  try {
    endpoint = String((await req.json())?.endpoint ?? '')
  } catch {
    return json({ error: 'bad-json' }, 400)
  }
  if (endpoint.length < 20 || endpoint.length > 700 || !endpoint.startsWith('https://')) {
    return json({ error: 'bad-endpoint' }, 400)
  }

  const auth = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
  const q = `${SB_URL}/rest/v1/weather_push_subs?select=id,endpoint,p256dh,auth,label,morning_time,night_time,rain_alert,last_test_sent&endpoint=eq.${encodeURIComponent(endpoint)}`
  const res = await fetch(q, { headers: auth })
  if (!res.ok) return json({ error: 'lookup-failed' }, 502)
  const rows = await res.json()
  const s = Array.isArray(rows) ? rows[0] : null
  if (!s) return json({ error: 'not-subscribed' }, 404)
  if (s.last_test_sent && Date.now() - new Date(s.last_test_sent).getTime() < 60_000) {
    return json({ error: 'too-soon' }, 429)
  }

  const fmt = (v: string) => `${v.slice(0, 2)}:${v.slice(2)}`
  const msg = {
    title: '🔔 테스트 알림',
    body:
      `알림이 잘 도착해요. ${s.label || '우리 동네'} 기준으로 아침 ${fmt(s.morning_time)} 브리핑, ` +
      `밤 ${fmt(s.night_time)} 내일 준비 알림` +
      (s.rain_alert ? ', 비 시작 알림을 보내드려요.' : '을 보내드려요.'),
  }
  try {
    await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), {
      TTL: 300,
    })
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode
    return json({ error: 'send-failed', code: code ?? null }, code === 404 || code === 410 ? 410 : 502)
  }
  await fetch(`${SB_URL}/rest/v1/weather_push_subs?id=eq.${s.id}`, {
    method: 'PATCH',
    headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ last_test_sent: new Date().toISOString() }),
  }).catch(() => {})
  return json({ ok: true })
})
