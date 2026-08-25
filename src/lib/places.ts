// 위치 즐겨찾기 — localStorage 저장 + Open-Meteo 지오코딩 검색(키 불필요)

export interface Place {
  id: string
  name: string
  lat: number
  lon: number
}

const KEY = 'eojeboda:favorites'

export function loadFavorites(): Place[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    if (!Array.isArray(list)) return []
    return list.filter(
      (p): p is Place =>
        p &&
        typeof p.id === 'string' &&
        typeof p.name === 'string' &&
        // NaN 도 typeof 는 number 라 유한값·범위까지 확인한다
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lon) &&
        Math.abs(p.lat) <= 90 &&
        Math.abs(p.lon) <= 180,
    )
  } catch {
    return []
  }
}

export function saveFavorites(list: Place[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // 저장 실패(시크릿 모드 등)는 무시 — 세션 내에서는 동작
  }
}

export function placeId(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`
}

interface NominatimResult {
  display_name: string
  lat: string
  lon: string
}

/** "판교, 판교역로…, 분당구, 성남시, 경기도, 13529, 대한민국" → "성남시 분당구 판교" */
function shortLabel(displayName: string): string {
  const parts = displayName
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s !== '대한민국' && !/^\d/.test(s))
  const picked: string[] = []
  for (const p of parts) {
    if (!picked.includes(p)) picked.push(p)
    if (picked.length === 3) break
  }
  return picked.reverse().join(' ')
}

export async function searchPlaces(query: string): Promise<Place[]> {
  // Nominatim(OSM) — 한국 지명 정확도가 높음. 저빈도 사용(수동 검색)이라 정책 내 사용
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('accept-language', 'ko')
  url.searchParams.set('limit', '6')
  const res = await fetch(url)
  if (!res.ok) return []
  const results: NominatimResult[] = await res.json()
  const seen = new Set<string>()
  return results
    .map((r) => {
      const lat = Number(r.lat)
      const lon = Number(r.lon)
      return { id: placeId(lat, lon), name: shortLabel(r.display_name), lat, lon }
    })
    .filter((p) => {
      if (seen.has(p.id) || !p.name) return false
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return false
      if (Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180) return false
      seen.add(p.id)
      return true
    })
}

const HOME_KEY = 'eojeboda:home'

/** 처음 열 때 보여줄 기본 지역 ('current' 또는 장소 id) */
export function loadHome(): string {
  try {
    return localStorage.getItem(HOME_KEY) ?? 'current'
  } catch {
    return 'current'
  }
}

export function saveHome(id: string): void {
  try {
    localStorage.setItem(HOME_KEY, id)
  } catch {
    // 무시
  }
}
