// 기상청 초단기실황(관측값) 프록시 — 공공데이터포털 키는 서버에만 보관
// GET ?lat=..&lon=.. → { t1h, rn1, pty, wsd, reh, base }
// 주의: DATAGO_KMA_KEY 는 이미 URL 인코딩된 형태라 재인코딩 없이 붙인다
const KEY = Deno.env.get('DATAGO_KMA_KEY')!

// 기상청 DFS 격자 변환 (LCC lat1=30 lat2=60 olon=126 olat=38, 5km)
function dfsGrid(lat: number, lon: number): { nx: number; ny: number } {
  const RE = 6371.00877, GRID = 5.0, SLAT1 = 30, SLAT2 = 60, OLON = 126, OLAT = 38, XO = 43, YO = 136
  const DEGRAD = Math.PI / 180
  const re = RE / GRID
  const slat1 = SLAT1 * DEGRAD, slat2 = SLAT2 * DEGRAD
  const olon = OLON * DEGRAD, olat = OLAT * DEGRAD
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5)
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn)
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5)
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5)
  ro = (re * sf) / Math.pow(ro, sn)
  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5)
  ra = (re * sf) / Math.pow(ra, sn)
  let theta = lon * DEGRAD - olon
  if (theta > Math.PI) theta -= 2 * Math.PI
  if (theta < -Math.PI) theta += 2 * Math.PI
  theta *= sn
  return {
    nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
  }
}

/** 초단기실황 base_date/time — 매시 40분경 발표, 45분 전이면 이전 시각 사용 */
function baseTime(): { bd: string; bt: string } {
  const kst = new Date(Date.now() + 9 * 3600_000)
  if (kst.getUTCMinutes() < 45) kst.setUTCHours(kst.getUTCHours() - 1)
  const p = (n: number) => String(n).padStart(2, '0')
  return {
    bd: `${kst.getUTCFullYear()}${p(kst.getUTCMonth() + 1)}${p(kst.getUTCDate())}`,
    bt: `${p(kst.getUTCHours())}00`,
  }
}

Deno.serve(async (req: Request) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  }
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const u = new URL(req.url)
  const lat = Number(u.searchParams.get('lat'))
  const lon = Number(u.searchParams.get('lon'))
  if (!isFinite(lat) || !isFinite(lon) || lat < 32 || lat > 41 || lon < 123 || lon > 133) {
    return new Response('bad coords', { status: 400, headers: cors })
  }
  const { nx, ny } = dfsGrid(lat, lon)
  const { bd, bt } = baseTime()
  const api =
    'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst' +
    `?serviceKey=${KEY}&pageNo=1&numOfRows=20&dataType=JSON` +
    `&base_date=${bd}&base_time=${bt}&nx=${nx}&ny=${ny}`

  const res = await fetch(api)
  if (!res.ok) return new Response('upstream ' + res.status, { status: 502, headers: cors })
  const data = await res.json()
  const items = data?.response?.body?.items?.item
  if (!Array.isArray(items)) {
    return new Response(JSON.stringify({ error: data?.result?.message ?? 'no data' }), {
      status: 502,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
  const get = (cat: string) => {
    const it = items.find((i: { category: string }) => i.category === cat)
    return it ? Number(it.obsrValue) : null
  }
  const body = {
    t1h: get('T1H'), // 기온 °C
    rn1: get('RN1'), // 1시간 강수량 mm
    pty: get('PTY'), // 강수형태 0없음 1비 2비/눈 3눈 5빗방울 6빗방울눈날림 7눈날림
    wsd: get('WSD'), // 풍속 m/s
    reh: get('REH'), // 습도 %
    base: `${bd}${bt}`,
    nx,
    ny,
  }
  return new Response(JSON.stringify(body), {
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
  })
})
