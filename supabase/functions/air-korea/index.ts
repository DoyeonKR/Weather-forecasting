// 에어코리아 실측 미세먼지 프록시 — 공공데이터포털 키는 서버에만 보관
// GET ?lat=..&lon=.. → { station, km, dataTime, pm10, pm25, pm10Yest, pm25Yest }
// 필요한 서비스(공공데이터포털 활용신청): 한국환경공단_에어코리아_측정소정보, _대기오염정보
// 주의: DATAGO_KMA_KEY 는 이미 URL 인코딩된 형태라 재인코딩 없이 붙인다 (같은 계정 키)
const KEY = Deno.env.get('DATAGO_KMA_KEY')!
const BASE = 'https://apis.data.go.kr/B552584'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
}

interface Station {
  name: string
  lat: number
  lon: number
}

// 측정소 목록은 거의 안 바뀐다. 인스턴스가 살아 있는 동안 하루 캐시.
let stations: { at: number; list: Station[] } | null = null

async function api(path: string): Promise<{ items: Record<string, unknown>[] } | { error: string }> {
  const res = await fetch(`${BASE}/${path}${path.includes('?') ? '&' : '?'}serviceKey=${KEY}&returnType=json`)
  const text = await res.text()
  try {
    const d = JSON.parse(text)
    const header = d?.response?.header
    if (header && header.resultCode !== '00') return { error: header.resultMsg ?? `code ${header.resultCode}` }
    const items = d?.response?.body?.items
    if (Array.isArray(items)) return { items }
    const auth = d?.OpenAPI_ServiceResponse?.cmmMsgHeader
    return { error: auth?.returnAuthMsg ?? auth?.errMsg ?? 'no items' }
  } catch {
    return { error: text.match(/<returnAuthMsg>([^<]+)</)?.[1] ?? text.match(/<errMsg>([^<]+)</)?.[1] ?? 'non-json' }
  }
}

async function loadStations(): Promise<Station[] | { error: string }> {
  if (stations && Date.now() - stations.at < 24 * 3600_000) return stations.list
  const r = await api('MsrstnInfoInqireSvc/getMsrstnList?numOfRows=1000&pageNo=1')
  if ('error' in r) return r
  const list: Station[] = []
  for (const it of r.items) {
    const a = Number(it.dmX)
    const b = Number(it.dmY)
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue
    // dmX/dmY 이름과 달리 어느 쪽이 위도인지 문서와 실제가 엇갈린다. 범위로 가른다.
    const [lat, lon] = a < b ? [a, b] : [b, a]
    list.push({ name: String(it.stationName), lat, lon })
  }
  if (list.length === 0) return { error: 'no stations' }
  stations = { at: Date.now(), list }
  return list
}

function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

/** '2026-09-29 10:00' → ms. 에어코리아는 자정을 '24:00' 으로 적는다 */
function kstMs(t: string): number {
  const m = t.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})$/)
  if (!m) return NaN
  const base = Date.parse(`${m[1]}T00:00:00+09:00`)
  return base + (Number(m[2]) * 60 + Number(m[3])) * 60_000
}

const num = (v: unknown) => {
  const n = Number(v)
  return typeof v === 'string' && v.trim() !== '' && v !== '-' && Number.isFinite(n) ? n : null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  const json = (body: unknown, status = 200, cache = 0) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json', ...(cache ? { 'Cache-Control': `public, max-age=${cache}` } : {}) },
    })
  const u = new URL(req.url)
  const lat = Number(u.searchParams.get('lat'))
  const lon = Number(u.searchParams.get('lon'))
  if (!isFinite(lat) || !isFinite(lon) || lat < 32 || lat > 41 || lon < 123 || lon > 133) {
    return json({ error: 'bad coords' }, 400)
  }
  const list = await loadStations()
  if ('error' in list) return json({ error: list.error }, 502)
  let best = list[0]
  let bestKm = km({ lat, lon }, best)
  for (const s of list) {
    const d = km({ lat, lon }, s)
    if (d < bestKm) {
      best = s
      bestKm = d
    }
  }
  // 가장 가까운 측정소가 너무 멀면 동네 값이라고 하기 어렵다
  if (bestKm > 30) return json({ error: 'no nearby station', km: Math.round(bestKm) }, 404)

  const r = await api(
    `ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty?numOfRows=30&pageNo=1&dataTerm=MONTH&ver=1.0&stationName=${encodeURIComponent(best.name)}`,
  )
  if ('error' in r) return json({ error: r.error }, 502)
  // 최신이 앞. 점검·통신장애로 빈 시간이 있어 값이 있는 첫 줄을 "지금"으로 본다.
  const rows = r.items
    .map((it) => ({ t: String(it.dataTime ?? ''), pm10: num(it.pm10Value), pm25: num(it.pm25Value) }))
    .filter((x) => x.t)
  const now = rows.find((x) => x.pm10 !== null && x.pm25 !== null)
  if (!now) return json({ error: 'no data', station: best.name }, 404)
  // "2026-09-29 10:00" → 24시간 전 같은 시각
  const nowMs = kstMs(now.t)
  const yest = rows.find((x) => kstMs(x.t) === nowMs - 24 * 3600_000)
  return json(
    {
      station: best.name,
      km: Math.round(bestKm * 10) / 10,
      dataTime: now.t,
      pm10: now.pm10,
      pm25: now.pm25,
      pm10Yest: yest?.pm10 ?? null,
      pm25Yest: yest?.pm25 ?? null,
    },
    200,
    600,
  )
})
