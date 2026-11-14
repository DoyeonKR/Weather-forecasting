// Open-Meteo 예보 우회 경로 — 앱이 Open-Meteo 에 직접 닿지 못할 때(응답 없음·IP 제한) 두 번째 시도로 쓴다.
// 고정된 예보 주소로만, 정해진 인자만 넘긴다 (아무 주소나 대신 부르는 통로가 되지 않게).
// GET ?latitude=..&longitude=..&current=..&hourly=..&daily=.. → Open-Meteo 응답 그대로
const UPSTREAM = 'https://api.open-meteo.com/v1/forecast'
const ALLOWED = ['latitude', 'longitude', 'timezone', 'past_days', 'forecast_days', 'current', 'hourly', 'daily', 'wind_speed_unit']

Deno.serve(async (req: Request) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  }
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  const q = new URL(req.url).searchParams
  const lat = Number(q.get('latitude'))
  const lon = Number(q.get('longitude'))
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return new Response('bad coords', { status: 400, headers: cors })
  }
  const up = new URL(UPSTREAM)
  for (const k of ALLOWED) {
    const v = q.get(k)
    if (v !== null && v.length <= 400) up.searchParams.set(k, v)
  }
  try {
    const res = await fetch(up, { signal: AbortSignal.timeout(8_000) })
    if (!res.ok) return new Response('upstream ' + res.status, { status: 502, headers: cors })
    return new Response(await res.text(), {
      headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
    })
  } catch (e) {
    return new Response('upstream ' + String(e).slice(0, 80), { status: 504, headers: cors })
  }
})
