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
  category?: string
  type?: string
  address?: Record<string, string>
}

/**
 * 주소 구성요소로 짧은 이름을 만든다 (순수 함수 — 테스트 대상).
 * 예전에는 display_name 앞 세 토막을 뒤집어 붙였는데, 결과가 역·도로·상점이면
 * "백현동 판교역로146번길 판교" 처럼 도로명이 이름이 됐다.
 *  · 국내: 시·도(시가 없을 때만) / 시·군 / 구 / 동·마을 → "성남시 분당구 판교"
 *  · 해외: 나라 + 주(도) + 도시 → "일본 도쿄도", "미국 텍사스 Paris"
 */
export function placeLabel(ad: Record<string, string> | undefined, displayName: string): string {
  if (!ad) return shortLabel(displayName)
  const cityLike = ad.city || ad.town || ad.county || ad.municipality
  const small = ad.suburb || ad.quarter || ad.village || ad.hamlet || ad.neighbourhood
  const parts: string[] = []
  const push = (v?: string) => {
    if (v && parts[parts.length - 1] !== v && !parts.includes(v)) parts.push(v)
  }
  if (ad.country_code === 'kr') {
    // 읍·면(town)은 군(county) 아래에 있다 — "서천군 판교면"
    const top = ad.city || ad.county || ad.municipality
    if (!top && !ad.town) push(ad.state)
    push(top)
    push(ad.borough)
    push(ad.town)
    push(small)
  } else {
    push(ad.country)
    push(ad.state)
    push(cityLike)
    // 큰 도시 안의 구역만 골랐다면 그 구역까지
    if (!cityLike) push(small)
  }
  return parts.length ? parts.join(' ') : shortLabel(displayName)
}

/** 행정구역·지명을 가게·도로·역보다 앞에 (안정 정렬) */
function rankResults(list: NominatimResult[]): NominatimResult[] {
  const rank = (r: NominatimResult) => (r.category === 'place' || r.category === 'boundary' ? 0 : 1)
  return list
    .map((r, i) => ({ r, i }))
    .sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i)
    .map((x) => x.r)
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

export class SearchFailed extends Error {}

export async function searchPlaces(query: string): Promise<Place[]> {
  // Nominatim(OSM) — 한국 지명 정확도가 높음. 저빈도 사용(수동 검색)이라 정책 내 사용
  const ask = async (addressLayerOnly: boolean): Promise<NominatimResult[]> => {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('q', query)
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('accept-language', 'ko')
    url.searchParams.set('addressdetails', '1')
    url.searchParams.set('limit', '10')
    // 주소 계층만: "판교"에 판교역·판교초등학교·상점이 앞서 나오는 것을 줄인다
    if (addressLayerOnly) url.searchParams.set('layer', 'address')
    try {
      const res = await fetch(url)
      if (!res.ok) throw new SearchFailed(String(res.status))
      const body = await res.json()
      if (!Array.isArray(body)) throw new SearchFailed('bad shape')
      return body.filter(
        (r): r is NominatimResult => r && typeof r.display_name === 'string' && r.lat != null && r.lon != null,
      )
    } catch (e) {
      if (e instanceof SearchFailed) throw e
      throw new SearchFailed('network')
    }
  }
  let results = await ask(true)
  // 주소 계층에 없는 이름(예: 관광지)은 제한 없이 한 번 더 (정책상 1초 1회 이하 — 수동 검색이라 문제 없다)
  if (results.length === 0) results = await ask(false)
  const seenId = new Set<string>()
  const seenName = new Set<string>()
  return rankResults(results)
    .map((r) => {
      const lat = Number(r.lat)
      const lon = Number(r.lon)
      return { id: placeId(lat, lon), name: placeLabel(r.address, r.display_name), lat, lon }
    })
    .filter((p) => {
      if (seenId.has(p.id) || seenName.has(p.name) || !p.name) return false
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return false
      if (Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180) return false
      seenId.add(p.id)
      seenName.add(p.name)
      return true
    })
    .slice(0, 6)
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
