// 평년 비교 — 최근 10년 같은 시기(앞뒤 3일) 낮 최고·아침 최저 평균.
// 기상청 30년 평년값이 아니라 Open-Meteo 과거 재분석(ERA5) 10년치로 직접 구한 값이다.
// 화면에도 "최근 10년 이맘때"라고 적는다.

export interface Normal {
  tmax: number
  tmin: number
  years: number
}

const KEY = 'eojeboda.normals.v1'
/** 과거 값은 바뀌지 않으니 오래 둔다 (연도가 바뀌면 새로 받는다) */
const TTL = 90 * 24 * 3600 * 1000
const WINDOW = 3

interface Cached {
  at: number
  from: number
  /** 'MM-DD' → [최고 평균, 최저 평균, 표본 연수] */
  table: Record<string, [number, number, number]>
}

const mmdd = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** 일별 과거 값 → 달력 날짜별(앞뒤 3일) 평균표 (순수 함수 — 테스트 대상) */
export function buildTable(
  dates: string[],
  tmax: (number | null)[],
  tmin: (number | null)[],
): Cached['table'] {
  const byDay = new Map<string, { mx: number[]; mn: number[]; years: Set<string> }>()
  dates.forEach((ds, i) => {
    const hi = tmax[i]
    const lo = tmin[i]
    if (typeof hi !== 'number' || typeof lo !== 'number') return
    const base = new Date(`${ds}T12:00:00Z`)
    for (let off = -WINDOW; off <= WINDOW; off++) {
      const d = new Date(base.getTime() + off * 86_400_000)
      const k = `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      let e = byDay.get(k)
      if (!e) byDay.set(k, (e = { mx: [], mn: [], years: new Set() }))
      e.mx.push(hi)
      e.mn.push(lo)
      e.years.add(ds.slice(0, 4))
    }
  })
  const avg = (a: number[]) => Math.round((a.reduce((s, v) => s + v, 0) / a.length) * 10) / 10
  const table: Cached['table'] = {}
  for (const [k, e] of byDay) table[k] = [avg(e.mx), avg(e.mn), e.years.size]
  return table
}

function cacheKey(lat: number, lon: number) {
  return `${KEY}:${lat.toFixed(1)},${lon.toFixed(1)}`
}

export async function fetchNormal(lat: number, lon: number, on = new Date()): Promise<Normal | null> {
  const to = on.getFullYear() - 1
  const from = to - 9
  const key = cacheKey(lat, lon)
  let cached: Cached | null = null
  try {
    cached = JSON.parse(localStorage.getItem(key) ?? 'null')
  } catch {
    cached = null
  }
  if (!cached || Date.now() - cached.at > TTL || cached.from !== from) {
    try {
      const url = new URL('https://archive-api.open-meteo.com/v1/archive')
      url.searchParams.set('latitude', lat.toFixed(2))
      url.searchParams.set('longitude', lon.toFixed(2))
      url.searchParams.set('start_date', `${from}-01-01`)
      url.searchParams.set('end_date', `${to}-12-31`)
      url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min')
      url.searchParams.set('timezone', 'auto')
      const res = await fetch(url)
      if (!res.ok) return null
      const d = await res.json()
      const table = buildTable(d?.daily?.time ?? [], d?.daily?.temperature_2m_max ?? [], d?.daily?.temperature_2m_min ?? [])
      cached = { at: Date.now(), from, table }
      try {
        localStorage.setItem(key, JSON.stringify(cached))
      } catch {
        // 저장 못 해도 이번엔 쓴다
      }
    } catch {
      return null
    }
  }
  const row = cached.table[mmdd(on)]
  if (!row || row[2] < 5) return null
  return { tmax: row[0], tmin: row[1], years: row[2] }
}
