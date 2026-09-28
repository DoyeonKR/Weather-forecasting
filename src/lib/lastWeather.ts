// 마지막으로 받은 날씨를 기기에 남겨 두고, 다시 열 때 스피너 대신 바로 보여준다.
// 화면은 곧바로 새로 받아 덮어쓰므로 여기 값은 "잠깐 보여줄 초안"일 뿐이다.
import type { Located } from './geo'
import type { KmaNow } from './kmaNow'
import type { WeatherData } from './weather'
import type { AirNow } from './air'

const KEY = 'eojeboda.lastWeather.v1'
/** 이보다 오래된 날씨는 보여주지 않는다 (시간대별 '지금'이 너무 어긋난다) */
const MAX_AGE = 3 * 60 * 60 * 1000
/** 지역 몇 곳까지 남길지 (한 곳에 10KB 남짓) */
const MAX_ENTRIES = 6

export interface LastWeather {
  loc: Located
  wx: WeatherData
  kmaNow: KmaNow | null
  /** 미세먼지 (따로 받아서 늦게 채워진다) */
  air?: AirNow | null
}

type Store = Record<string, LastWeather>

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    const v = raw ? JSON.parse(raw) : null
    return v && typeof v === 'object' ? (v as Store) : {}
  } catch {
    return {}
  }
}

function valid(e: LastWeather | undefined): e is LastWeather {
  return (
    !!e &&
    typeof e.loc?.lat === 'number' &&
    typeof e.loc?.label === 'string' &&
    typeof e.wx?.nowTemp === 'number' &&
    typeof e.wx?.fetchedAt === 'number' &&
    Array.isArray(e.wx?.hourly?.temp) &&
    Array.isArray(e.wx?.week)
  )
}

export function loadLast(id: string): LastWeather | null {
  const e = read()[id]
  if (!valid(e)) return null
  const age = Date.now() - e.wx.fetchedAt
  return age >= 0 && age < MAX_AGE ? e : null
}

export function saveLast(id: string, entry: LastWeather) {
  try {
    const store = read()
    store[id] = entry
    const keep = Object.entries(store)
      .filter(([, v]) => valid(v))
      .sort((a, b) => b[1].wx.fetchedAt - a[1].wx.fetchedAt)
      .slice(0, MAX_ENTRIES)
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(keep)))
  } catch {
    // 저장 공간이 없거나 막혀 있으면 캐시 없이 동작한다
  }
}
