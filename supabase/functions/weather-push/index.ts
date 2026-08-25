// 무능한 날씨예측기 푸시 발송기
// mode=morning: 오늘 브리핑(어제 비교), mode=night: 내일 대비 알림
// pg_cron 이 매일 호출. key 파라미터로 무단 호출 차단.
import webpush from 'npm:web-push@3.6.7'

const VAPID_PUBLIC = Deno.env.get('WEATHER_VAPID_PUBLIC')!
const VAPID_PRIVATE = Deno.env.get('WEATHER_VAPID_PRIVATE')!
const CRON_KEY = Deno.env.get('WEATHER_CRON_KEY')!
const SB_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

function morningMsg(place: string, w: Awaited<ReturnType<typeof fetchDaily>>): { title: string; body: string } {
  const d = r1(w.today.tmax - w.yesterday.tmax)
  const cmp =
    Math.abs(d) < 1 ? '어제와 비슷해요' : d > 0 ? `어제보다 ${d}° 높아요` : `어제보다 ${Math.abs(d)}° 낮아요`
  const parts = [`오늘 ${r1(w.today.tmin)}~${r1(w.today.tmax)}°, 낮 기온이 ${cmp}.`]
  if (isSnow(w.today.code)) parts.push('눈 소식이 있어요, 길 조심!')
  else if (w.today.prob >= 60) parts.push(`강수확률 ${w.today.prob}%, 우산 챙기세요!`)
  if (w.today.uv >= 8) parts.push('자외선 매우 강함, 선크림 필수!')
  return { title: `☀️ ${place} 오늘 날씨 브리핑`, body: parts.join(' ') }
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

  for (const s of subs) {
    try {
      const key = `${s.lat.toFixed(2)},${s.lon.toFixed(2)}`
      let w = cache.get(key)
      if (!w) {
        w = await fetchDaily(s.lat, s.lon)
        cache.set(key, w)
      }
      const place = s.label || '우리 동네'
      const msg = mode === 'morning' ? morningMsg(place, w) : nightMsg(place, w)
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
