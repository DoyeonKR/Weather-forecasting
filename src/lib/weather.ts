// Open-Meteo API — 키 불필요, CORS 허용, past_days=1 로 어제 실측 포함
import type { DayStats } from './compare'

export interface WeatherData {
  /** 현재 기온 */
  nowTemp: number
  /** 현재 체감 */
  nowApparent: number
  /** 현재 날씨 코드 */
  nowCode: number
  /** 현재 낮 여부 */
  nowIsDay: boolean
  /** 어제 같은 시각 기온 */
  yesterdaySameHour: number
  /** 오늘 자외선 지수 최대 */
  uvMaxToday: number | null
  yesterday: DayStats
  today: DayStats
  tomorrow: DayStats
  /** 오늘부터 7일 (date: YYYY-MM-DD) */
  week: { date: string; stats: DayStats }[]
  /** 시간별 (어제 0시 ~ 내일 23시, 로컬) */
  hourly: { time: string[]; temp: number[]; precip: number[] }
  fetchedAt: number
}

interface OpenMeteoResponse {
  current: {
    time: string
    temperature_2m: number
    apparent_temperature: number
    weather_code: number
    is_day: number
  }
  hourly: {
    time: string[]
    temperature_2m: number[]
    precipitation: number[]
  }
  daily: {
    time: string[] // YYYY-MM-DD
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_sum: number[]
    precipitation_probability_max: (number | null)[]
    weather_code: number[]
    uv_index_max: (number | null)[]
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

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('past_days', '1')
  url.searchParams.set('forecast_days', '8')
  url.searchParams.set('current', 'temperature_2m,apparent_temperature,weather_code,is_day')
  url.searchParams.set('hourly', 'temperature_2m,precipitation')
  url.searchParams.set(
    'daily',
    'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code,uv_index_max,wind_speed_10m_max,wind_gusts_10m_max',
  )
  const res = await fetch(url)
  if (!res.ok) throw new Error(`날씨 API 오류 (${res.status})`)
  const data: OpenMeteoResponse = await res.json()

  // hourly 는 어제 00시부터 시작 → 인덱스 0~23이 어제, 24~47이 오늘
  const nowHour = new Date(data.current.time).getHours()
  const yesterdaySameHour = data.hourly.temperature_2m[nowHour]

  return {
    nowTemp: data.current.temperature_2m,
    nowApparent: data.current.apparent_temperature,
    nowCode: data.current.weather_code,
    nowIsDay: data.current.is_day === 1,
    yesterdaySameHour,
    uvMaxToday: data.daily.uv_index_max[1] ?? null,
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
    },
    fetchedAt: Date.now(),
  }
}
