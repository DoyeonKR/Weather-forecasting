// 무능한 날씨예측기 푸시 발송기
// mode=morning: 오늘 브리핑(어제 비교 + 미세먼지), mode=night: 내일 대비 알림
// mode=rain: 비 시작 알림 (켠 사람만, 07~22시, 기상청 초단기예보로 1시간 안에 비가 시작될 때)
// pg_cron 이 호출. key 파라미터로 무단 호출 차단.
import webpush from 'npm:web-push@3.6.7'

const VAPID_PUBLIC = Deno.env.get('WEATHER_VAPID_PUBLIC')!
const VAPID_PRIVATE = Deno.env.get('WEATHER_VAPID_PRIVATE')!
const CRON_KEY = Deno.env.get('WEATHER_CRON_KEY')!
const SB_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// 공공데이터포털 키 (이미 URL 인코딩된 형태). kma-ncst 와 같은 비밀값.
const KMA_KEY = Deno.env.get('DATAGO_KMA_KEY') ?? ''

webpush.setVapidDetails('mailto:kdy7854@naver.com', VAPID_PUBLIC, VAPID_PRIVATE)

interface Sub {
  id: number
  endpoint: string
  p256dh: string
  auth: string
  lat: number
  lon: number
  label: string | null
  night_time: string
  morning_time: string
  last_night_sent: string | null
  last_morning_sent: string | null
  rain_alert?: boolean
  last_rain_alert?: string | null
}

/** KST 기준 오늘 날짜 (하루 한 번 판정 기준) */
function kstDay(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
}

/** 주어진 시각(KST 기준 분 오프셋)의 30분 슬롯 문자열 (예: 2130) */
function slotAt(minutesAgo: number): string {
  const kst = new Date(Date.now() + 9 * 3600_000 - minutesAgo * 60_000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(kst.getUTCHours())}${kst.getUTCMinutes() < 30 ? '00' : '30'}`
}

/**
 * 지금 발송 대상이 되는 슬롯들.
 * 슬롯 하나만 정확히 맞추면 크론이 30분 경계를 넘겨 지연됐을 때
 * 그 슬롯 사용자는 통째로 건너뛰고 다음 슬롯 사용자는 두 번 받는다.
 * 최근 세 슬롯을 훑고, 실제 중복은 날짜 기록으로 막는다.
 */
function targetSlots(): string[] {
  const seen = new Set<string>()
  for (const m of [0, 30, 60]) seen.add(slotAt(m))
  return [...seen]
}

async function fetchDaily(lat: number, lon: number) {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set('timezone', 'Asia/Seoul')
  url.searchParams.set('past_days', '1')
  url.searchParams.set('forecast_days', '2')
  url.searchParams.set(
    'daily',
    'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code,uv_index_max',
  )
  const res = await fetch(url)
  if (!res.ok) throw new Error(`open-meteo ${res.status}`)
  const d = (await res.json()).daily
  const pick = (i: number) => ({
    tmax: d.temperature_2m_max[i] as number,
    tmin: d.temperature_2m_min[i] as number,
    prob: (d.precipitation_probability_max[i] ?? 0) as number,
    precip: d.precipitation_sum[i] as number,
    code: d.weather_code[i] as number,
    uv: (d.uv_index_max[i] ?? 0) as number,
  })
  return { yesterday: pick(0), today: pick(1), tomorrow: pick(2) }
}

const r1 = (n: number) => Math.round(n * 10) / 10
const isSnow = (c: number) => (c >= 71 && c <= 77) || c === 85 || c === 86

/** 오늘 낮 동안(9~21시) 미세먼지 최악 등급 — 0 좋음 ~ 3 매우 나쁨. 실패하면 null */
async function fetchAirWorst(lat: number, lon: number): Promise<number | null> {
  try {
    const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality')
    url.searchParams.set('latitude', String(lat))
    url.searchParams.set('longitude', String(lon))
    url.searchParams.set('timezone', 'Asia/Seoul')
    url.searchParams.set('forecast_days', '1')
    url.searchParams.set('hourly', 'pm10,pm2_5')
    const res = await fetch(url)
    if (!res.ok) return null
    const h = (await res.json()).hourly
    const g10 = (v: number) => (v <= 30 ? 0 : v <= 80 ? 1 : v <= 150 ? 2 : 3)
    const g25 = (v: number) => (v <= 15 ? 0 : v <= 35 ? 1 : v <= 75 ? 2 : 3)
    let worst = -1
    for (let i = 9; i <= 21; i++) {
      const a = h.pm10?.[i]
      const b = h.pm2_5?.[i]
      if (typeof a !== 'number' || typeof b !== 'number') continue
      worst = Math.max(worst, g10(a), g25(b))
    }
    return worst < 0 ? null : worst
  } catch {
    return null
  }
}

function morningMsg(
  place: string,
  w: Awaited<ReturnType<typeof fetchDaily>>,
  air: number | null,
): { title: string; body: string } {
  const d = r1(w.today.tmax - w.yesterday.tmax)
  const cmp =
    Math.abs(d) < 1 ? '어제와 비슷해요' : d > 0 ? `어제보다 ${d}° 높아요` : `어제보다 ${Math.abs(d)}° 낮아요`
  const parts = [`오늘 ${r1(w.today.tmin)}~${r1(w.today.tmax)}°, 낮 기온이 ${cmp}.`]
  if (isSnow(w.today.code)) parts.push('눈 소식이 있어요, 길 조심!')
  else if (w.today.prob >= 60) parts.push(`강수확률 ${w.today.prob}%, 우산 챙기세요!`)
  if (air !== null && air >= 3) parts.push('미세먼지 매우 나쁨, 마스크 필수!')
  else if (air !== null && air >= 2) parts.push('미세먼지 나쁨, 마스크 챙기세요.')
  if (w.today.uv >= 8) parts.push('자외선 매우 강함, 선크림 필수!')
  return { title: `☀️ ${place} 오늘 날씨 브리핑`, body: parts.join(' ') }
}

// ── 비 시작 알림 (mode=rain) ─────────────────────────────

/** 기상청 DFS 격자 변환 (kma-ncst 와 같은 식) */
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

const inKorea = (lat: number, lon: number) => lat > 32.5 && lat < 40.5 && lon > 123 && lon < 132.5
const pad2 = (n: number) => String(n).padStart(2, '0')

/** 발표 시각: 실황은 매시 정각(40분쯤 나옴), 초단기예보는 매시 30분(45분쯤 나옴) */
function base(minuteAvail: number, minuteTag: string): { bd: string; bt: string } {
  const kst = new Date(Date.now() + 9 * 3600_000)
  if (kst.getUTCMinutes() < minuteAvail) kst.setUTCHours(kst.getUTCHours() - 1)
  return {
    bd: `${kst.getUTCFullYear()}${pad2(kst.getUTCMonth() + 1)}${pad2(kst.getUTCDate())}`,
    bt: `${pad2(kst.getUTCHours())}${minuteTag}`,
  }
}

async function kma(op: string, nx: number, ny: number, bd: string, bt: string, rows: number) {
  const api =
    `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/${op}` +
    `?serviceKey=${KMA_KEY}&pageNo=1&numOfRows=${rows}&dataType=JSON` +
    `&base_date=${bd}&base_time=${bt}&nx=${nx}&ny=${ny}`
  const res = await fetch(api)
  if (!res.ok) throw new Error(`kma ${op} ${res.status}`)
  const items = (await res.json())?.response?.body?.items?.item
  if (!Array.isArray(items)) throw new Error(`kma ${op} no items`)
  return items as { category: string; obsrValue?: string; fcstValue?: string; fcstDate?: string; fcstTime?: string }[]
}

/**
 * 지금은 안 오는데 가까운 예보 두 칸(약 10분 뒤·70분 뒤) 안에 비·눈이 잡히면 그 시각과 종류.
 * 이미 오고 있으면 알릴 필요가 없다.
 */
async function rainSoon(nx: number, ny: number): Promise<{ hour: number; kind: string } | null> {
  return (await rainCheck(nx, ny)).soon
}

async function rainCheck(nx: number, ny: number) {
  const n = base(45, '00')
  const ncst = await kma('getUltraSrtNcst', nx, ny, n.bd, n.bt, 20)
  const pty = Number(ncst.find((i) => i.category === 'PTY')?.obsrValue ?? 0)
  const rn1 = Number(ncst.find((i) => i.category === 'RN1')?.obsrValue ?? 0)
  const now = { pty, rn1, base: `${n.bd}${n.bt}` }
  if (pty > 0 || rn1 > 0) return { soon: null, now, slots: [] as string[] }
  const f = base(45, '30')
  const fc = await kma('getUltraSrtFcst', nx, ny, f.bd, f.bt, 60)
  const slots = fc
    .filter((i) => i.category === 'PTY')
    .sort((a, b) => `${a.fcstDate}${a.fcstTime}`.localeCompare(`${b.fcstDate}${b.fcstTime}`))
    .slice(0, 2)
  const seen = slots.map((x) => `${x.fcstTime}:${x.fcstValue}`)
  for (const x of slots) {
    const v = Number(x.fcstValue ?? 0)
    if (v > 0) {
      const kind = v === 3 || v === 7 ? '눈' : v === 2 || v === 6 ? '비나 눈' : '비'
      return { soon: { hour: Number((x.fcstTime ?? '0000').slice(0, 2)), kind }, now, slots: seen }
    }
  }
  return { soon: null, now, slots: seen }
}

async function runRain(): Promise<Response> {
  const kstHour = new Date(Date.now() + 9 * 3600_000).getUTCHours()
  // 밤에는 깨우지 않는다 (크론도 07~21시에만 돌지만 한 번 더 막는다)
  if (kstHour < 7 || kstHour > 21) {
    return new Response(JSON.stringify({ mode: 'rain', skipped: 'quiet-hours' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (!KMA_KEY) {
    return new Response(JSON.stringify({ error: 'no-kma-key' }), { status: 500 })
  }
  // 6시간 안에 이미 보낸 사람은 뺀다 (비가 그쳤다 오기를 반복해도 하루에 몇 번이면 충분)
  const since = new Date(Date.now() - 6 * 3600_000).toISOString()
  const q =
    `${SB_URL}/rest/v1/weather_push_subs?select=*&rain_alert=eq.true` +
    `&or=(last_rain_alert.is.null,last_rain_alert.lt.${encodeURIComponent(since)})`
  const subsRes = await fetch(q, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } })
  if (!subsRes.ok) {
    console.error('[weather-push] 비 알림 구독 조회 실패', subsRes.status)
    return new Response(JSON.stringify({ error: 'subs-fetch-failed' }), { status: 502 })
  }
  const subs = (await subsRes.json()) as Sub[]
  let sent = 0
  let skipped = 0
  let failed = 0
  let removed = 0
  const cache = new Map<string, Promise<{ hour: number; kind: string } | null>>()
  for (const s of subs) {
    if (!inKorea(s.lat, s.lon)) {
      skipped++
      continue
    }
    try {
      const { nx, ny } = dfsGrid(s.lat, s.lon)
      const key = `${nx},${ny}`
      if (!cache.has(key)) cache.set(key, rainSoon(nx, ny))
      const soon = await cache.get(key)!
      if (!soon) {
        skipped++
        continue
      }
      const place = s.label || '우리 동네'
      const msg = {
        title: `🌂 ${place} 곧 ${soon.kind} 소식`,
        body: `${soon.hour}시쯤부터 ${soon.kind === '비' ? '비가' : `${soon.kind}이`} 올 것 같아요. 나갈 일이 있으면 우산 챙기세요. (기상청 초단기예보)`,
      }
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(msg),
        // 한 시간 뒤에 도착하면 이미 비가 온 뒤라 소용없다
        { TTL: 45 * 60 },
      )
      sent++
      await fetch(`${SB_URL}/rest/v1/weather_push_subs?id=eq.${s.id}`, {
        method: 'PATCH',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ last_rain_alert: new Date().toISOString() }),
      }).catch((e) => console.error('[weather-push] 비 알림 기록 실패', s.id, String(e)))
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) {
        const del = await fetch(`${SB_URL}/rest/v1/weather_push_subs?id=eq.${s.id}`, {
          method: 'DELETE',
          headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
        }).catch(() => null)
        if (del && del.ok) removed++
      } else {
        failed++
        console.error('[weather-push] 비 알림 실패', s.id, code ?? '', String(e).slice(0, 200))
      }
    }
  }
  return new Response(JSON.stringify({ mode: 'rain', total: subs.length, sent, skipped, removed, failed }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

function nightMsg(place: string, w: Awaited<ReturnType<typeof fetchDaily>>): { title: string; body: string } | null {
  // 내일 아침 출근 전 챙길 것 — 오늘과 크게 다를 때만 발송
  const parts: string[] = []
  const dMax = r1(w.tomorrow.tmax - w.today.tmax)
  const dMin = r1(w.tomorrow.tmin - w.today.tmin)
  if (isSnow(w.tomorrow.code))
    parts.push('내일 눈 소식! 미끄러우니 10분 일찍 나서고, 접지력 좋은 신발 준비해두세요.')
  else if (w.tomorrow.prob >= 60)
    parts.push(`내일 비 올 확률 ${w.tomorrow.prob}%. 현관에 우산 미리 꺼내두세요.`)
  if (dMin <= -5)
    parts.push(`내일 아침이 오늘보다 ${Math.abs(dMin)}° 추워요. 두꺼운 겉옷 준비!`)
  else if (dMax <= -5)
    parts.push(`내일 낮이 오늘보다 ${Math.abs(dMax)}° 낮아요. 겉옷 하나 챙겨두세요.`)
  if (dMax >= 5)
    parts.push(`내일은 오늘보다 ${dMax}° 더워요. 얇은 옷 꺼내두면 아침이 편해요.`)
  if (parts.length === 0) return null // 특이사항 없으면 조용히
  return { title: `🌙 내일 출근 준비 (${place})`, body: parts.join(' ') }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  if (url.searchParams.get('key') !== CRON_KEY) {
    return new Response('forbidden', { status: 403 })
  }
  // probe=위도,경도: 보내지 않고 판단만 돌려본다 (운영 점검용, 크론 키 필요)
  const probe = url.searchParams.get('probe')
  if (probe) {
    const [plat, plon] = probe.split(',').map(Number)
    try {
      const { nx, ny } = dfsGrid(plat, plon)
      return Response.json({ nx, ny, ...(await rainCheck(nx, ny)) })
    } catch (e) {
      return Response.json({ error: String(e).slice(0, 200) }, { status: 502 })
    }
  }
  if (url.searchParams.get('mode') === 'rain') return await runRain()
  const mode = url.searchParams.get('mode') === 'night' ? 'night' : 'morning'

  // 구독자가 고른 30분 슬롯에만 발송 (지연 대비로 최근 세 슬롯)
  const slotCol = mode === 'night' ? 'night_time' : 'morning_time'
  const sentCol = mode === 'night' ? 'last_night_sent' : 'last_morning_sent'
  const today = kstDay()
  const slotFilter = `&${slotCol}=in.(${targetSlots().join(',')})`
  const subsRes = await fetch(`${SB_URL}/rest/v1/weather_push_subs?select=*${slotFilter}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  if (!subsRes.ok) {
    // 예전에는 상태를 안 보고 바로 순회해서, 오류 응답이 오면 TypeError 로 그 회차 전원이 미발송됐다
    const detail = await subsRes.text().catch(() => '')
    console.error('[weather-push] 구독 조회 실패', subsRes.status, detail.slice(0, 300))
    return new Response(JSON.stringify({ error: 'subs-fetch-failed', status: subsRes.status }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const parsed = await subsRes.json()
  if (!Array.isArray(parsed)) {
    console.error('[weather-push] 구독 응답이 배열이 아님', JSON.stringify(parsed).slice(0, 300))
    return new Response(JSON.stringify({ error: 'subs-bad-shape' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  // 오늘 이미 보낸 사람은 건너뛴다. 슬롯 윈도우를 넓힌 만큼 여기서 중복을 막는다
  const subs: Sub[] = parsed.filter((s: Sub) => s[sentCol] !== today)

  let sent = 0
  let removed = 0
  let skipped = 0
  let failed = 0
  const cache = new Map<string, Awaited<ReturnType<typeof fetchDaily>>>()
  const airCache = new Map<string, number | null>()

  for (const s of subs) {
    try {
      const key = `${s.lat.toFixed(2)},${s.lon.toFixed(2)}`
      let w = cache.get(key)
      if (!w) {
        w = await fetchDaily(s.lat, s.lon)
        cache.set(key, w)
      }
      const place = s.label || '우리 동네'
      let air: number | null = null
      if (mode === 'morning') {
        if (!airCache.has(key)) airCache.set(key, await fetchAirWorst(s.lat, s.lon))
        air = airCache.get(key) ?? null
      }
      const msg = mode === 'morning' ? morningMsg(place, w, air) : nightMsg(place, w)
      if (!msg) {
        skipped++
        continue
      }
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(msg),
        // 날씨 브리핑은 지나면 쓸모가 없다. 기본값(4주)이면 며칠 뒤 켠 폰에 지난 날짜가 뜬다
        { TTL: 3 * 3600 },
      )
      sent++
      // 보냈다는 사실을 남겨야 다음 슬롯 실행이 같은 사람에게 또 보내지 않는다
      await fetch(`${SB_URL}/rest/v1/weather_push_subs?id=eq.${s.id}`, {
        method: 'PATCH',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ [sentCol]: today }),
      }).catch((e) => console.error('[weather-push] 발송 기록 실패', s.id, String(e)))
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) {
        // 만료된 구독 정리
        const del = await fetch(`${SB_URL}/rest/v1/weather_push_subs?id=eq.${s.id}`, {
          method: 'DELETE',
          headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
        }).catch(() => null)
        // 응답을 안 보면 지우지 못했는데 지웠다고 보고하게 된다
        if (del && del.ok) removed++
        else console.error('[weather-push] 만료 구독 삭제 실패', s.id, del ? del.status : 'network')
      } else {
        // 예전에는 전부 조용히 삼켜서, 장애와 '보낼 내용이 없음' 을 구분할 수 없었다
        failed++
        console.error('[weather-push] 발송 실패', s.id, code ?? '', String(e).slice(0, 200))
      }
    }
  }

  return new Response(JSON.stringify({ mode, slots: targetSlots(), total: subs.length, sent, skipped, removed, failed }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
