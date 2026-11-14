// Open-Meteo API — 키 불필요, CORS 허용, past_days=1 로 어제 실측 포함
import { FetchFail, fetchJsonTimeout, type FailReason } from './http'
import type { DayStats } from './compare'

export interface WeatherData {
  /** 현재 기온 */
  nowTemp: number
  /** 현재 체감 */
  nowApparent: number
  /** 현재 습도 % */
  nowHumidity: number
  /** 현재 풍속·돌풍(km/h). 이전 저장 데이터에는 없다. */
  nowWind?: number | null
  nowGust?: number | null
  /** 해당 지역 현지 기준 현재 시(0-23) */
  nowHourLocal: number
  /** 현재 날씨 코드 */
  nowCode: number
  /** 현재 낮 여부 */
  nowIsDay: boolean
  /** 어제 같은 시각 기온 */
  yesterdaySameHour: number
  /** 오늘 자외선 지수 최대 */
  uvMaxToday: number | null
  /** 내일 자외선 지수 최대 (밤의 "내일의 준비"용. 옛 캐시에는 없다) */
  uvMaxTomorrow?: number | null
  yesterday: DayStats
  today: DayStats
  tomorrow: DayStats
  /** 오늘부터 7일 (date: YYYY-MM-DD) */
  week: { date: string; stats: DayStats }[]
  /**
   * 시간별 (어제 0시 ~ 예보 끝, 로컬). prob: 시간별 강수확률 %.
   * ⚠ prob·sun 은 나중에 추가된 값이라 예전에 저장된 캐시에는 없다 — 항상 없을 수 있다고 보고 쓴다.
   */
  hourly: { time: string[]; temp: number[]; precip: number[]; code: number[]; prob?: (number | null)[] }
  /** 오늘 일출·일몰 (해당 지역 현지 시각, 'YYYY-MM-DDTHH:MM') */
  sun?: {
    rise: string
    set: string
    /** 내일 일출·일몰 (daily[2]). 나중에 추가된 값이라 옛 캐시에는 없다 */
    riseTomorrow?: string
    setTomorrow?: string
  }
  /** 이 지역의 UTC 오프셋(초). "지금 현지 시각"을 계산할 때 쓴다. 옛 캐시에는 없다 */
  utcOffsetSec?: number
  fetchedAt: number
}

interface OpenMeteoResponse {
  utc_offset_seconds?: number
  current: {
    time: string
    temperature_2m: number
    apparent_temperature: number
    relative_humidity_2m: number
    weather_code: number
    is_day: number
    wind_speed_10m?: number | null
    wind_gusts_10m?: number | null
  }
  hourly: {
    time: string[]
    temperature_2m: number[]
    precipitation: number[]
    weather_code: number[]
    precipitation_probability?: (number | null)[]
  }
  daily: {
    time: string[] // YYYY-MM-DD
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_sum: number[]
    precipitation_probability_max: (number | null)[]
    weather_code: number[]
    uv_index_max: (number | null)[]
    sunrise?: string[]
    sunset?: string[]
    wind_speed_10m_max: (number | null)[]
    wind_gusts_10m_max: (number | null)[]
  }
}

function dayStats(d: OpenMeteoResponse['daily'], i: number): DayStats {
  return {
    tmax: d.temperature_2m_max[i],
    tmin: d.temperature_2m_min[i],
    precipSum: d.precipitation_sum[i],
    precipProbMax: d.precipitation_probability_max[i],
    code: d.weather_code[i],
    windMax: d.wind_speed_10m_max[i],
    gustMax: d.wind_gusts_10m_max[i],
  }
}

/** Open-Meteo 를 우리 서버(Supabase)를 거쳐 받는 길. 고정된 예보 주소로만 넘긴다 (supabase/functions/weather-forecast) */
const FORECAST_PROXY = 'https://tqegatiuembcvphxmujl.supabase.co/functions/v1/weather-forecast'
/** 바로 가는 길이 이만큼 조용하면 우회 길도 같이 연다 */
const HEDGE_MS = 3_500
/** 두 길을 합쳐 이보다 오래 기다리지 않는다 */
const OVERALL_MS = 15_000

/** 날씨를 어느 길로 받았는지 — 한 길이 막혔다가 다른 길로 받은 경우를 기록하려고 */
export interface ForecastNote {
  via: 'direct' | 'proxy'
  /** 먼저 실패한 길의 이유 (없으면 null) */
  firstFail: FailReason | null
  status: number | null
}

/**
 * 예보 JSON 받기. Open-Meteo 에 바로 가는 길이 네트워크에 따라 수십 초씩 멈추는 일이 있었다(2026-11).
 * 바로 가는 길을 먼저 열고, 3.5초 동안 소식이 없거나 실패하면 우리 서버를 거치는 길도 연다.
 * 먼저 온 쪽을 쓰고 나머지는 끊는다. 둘 다 안 되면 15초 안에 실패로 끝난다.
 */
export function fetchForecast(url: URL, note?: (n: ForecastNote) => void): Promise<OpenMeteoResponse> {
  return new Promise((resolve, reject) => {
    const outer = new AbortController()
    const fails: FetchFail[] = []
    let settled = false
    let pending = 0
    let proxyOn = false
    const end = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(hedge)
      clearTimeout(overall)
      outer.abort()
      fn()
    }
    const run = (target: string, via: ForecastNote['via']) => {
      pending++
      fetchJsonTimeout<OpenMeteoResponse>(target, OVERALL_MS, outer.signal).then(
        (d) => {
          if (!d?.current || !d?.hourly || !d?.daily) throw new FetchFail('http', 0)
          end(() => {
            note?.({ via, firstFail: fails[0]?.reason ?? null, status: fails[0]?.status ?? null })
            resolve(d)
          })
        },
      ).catch((e) => {
        pending--
        if (settled) return
        fails.push(e instanceof FetchFail ? e : new FetchFail('network'))
        if (!proxyOn) openProxy()
        else if (pending === 0) end(() => reject(fails[0]))
      })
    }
    const openProxy = () => {
      if (proxyOn || settled) return
      proxyOn = true
      run(`${FORECAST_PROXY}${url.search}`, 'proxy')
    }
    const hedge = setTimeout(openProxy, HEDGE_MS)
    const overall = setTimeout(() => end(() => reject(fails[0] ?? new FetchFail('timeout'))), OVERALL_MS)
    run(url.toString(), 'direct')
  })
}

export async function fetchWeather(lat: number, lon: number, note?: (n: ForecastNote) => void): Promise<WeatherData> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('past_days', '1')
  url.searchParams.set('forecast_days', '8')
  url.searchParams.set(
    'current',
    'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m,wind_gusts_10m',
  )
  url.searchParams.set('hourly', 'temperature_2m,precipitation,weather_code,precipitation_probability')
  url.searchParams.set('wind_speed_unit', 'kmh')
  url.searchParams.set(
    'daily',
    'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code,uv_index_max,wind_speed_10m_max,wind_gusts_10m_max,sunrise,sunset',
  )
  // 응답이 안 오면 첫 화면이 "확인하고 있어요"에서 끝나지 않는다 → 두 길로, 15초 안에 끝낸다 (2026-11 실제 발생)
  const data = await fetchForecast(url, note)

  // hourly 는 어제 00시부터 시작 → 인덱스 0~23이 어제, 24~47이 오늘
  const nowHour = new Date(data.current.time).getHours()
  const yesterdaySameHour = data.hourly.temperature_2m[nowHour]

  return {
    nowTemp: data.current.temperature_2m,
    nowApparent: data.current.apparent_temperature,
    nowHumidity: data.current.relative_humidity_2m,
    nowWind: data.current.wind_speed_10m ?? null,
    nowGust: data.current.wind_gusts_10m ?? null,
    nowHourLocal: nowHour,
    nowCode: data.current.weather_code,
    nowIsDay: data.current.is_day === 1,
    yesterdaySameHour,
    uvMaxToday: data.daily.uv_index_max[1] ?? null,
    uvMaxTomorrow: data.daily.uv_index_max[2] ?? null,
    yesterday: dayStats(data.daily, 0),
    today: dayStats(data.daily, 1),
    tomorrow: dayStats(data.daily, 2),
    week: data.daily.time
      .map((date, i) => ({ date, stats: dayStats(data.daily, i) }))
      .slice(1, 8),
    hourly: {
      time: data.hourly.time,
      temp: data.hourly.temperature_2m,
      precip: data.hourly.precipitation,
      code: data.hourly.weather_code,
      prob: data.hourly.precipitation_probability,
    },
    // daily[0] 이 어제라 오늘은 1번
    sun:
      data.daily.sunrise?.[1] && data.daily.sunset?.[1]
        ? {
            rise: data.daily.sunrise[1],
            set: data.daily.sunset[1],
            // daily[2] 가 내일 — 극지방 등에서는 비어 올 수 있어 그대로 없음으로 둔다
            riseTomorrow: data.daily.sunrise[2] || undefined,
            setTomorrow: data.daily.sunset?.[2] || undefined,
          }
        : undefined,
    utcOffsetSec: typeof data.utc_offset_seconds === 'number' ? data.utc_offset_seconds : undefined,
    fetchedAt: Date.now(),
  }
}
