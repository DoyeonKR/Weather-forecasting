// 위치 획득 + 역지오코딩 (BigDataCloud — 키 불필요, 클라이언트 무료)

export interface Located {
  lat: number
  lon: number
  /** 동네 이름 (예: "서울특별시 마포구"). 실패 시 좌표 문자열 */
  label: string
  /** geolocation 거부/실패로 기본 위치를 쓴 경우 */
  isFallback: boolean
}

const FALLBACK = { lat: 37.5665, lon: 126.978, label: '서울 (기본 위치)' }

export function getPosition(): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 10 * 60 * 1000 },
    )
  })
}

export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=ko`
    const res = await fetch(url)
    if (!res.ok) return null
    const d = await res.json()
    const parts = [d.principalSubdivision, d.city || d.locality].filter(
      (s: unknown): s is string => typeof s === 'string' && s.length > 0,
    )
    // 중복 제거 (예: city 와 subdivision 이 같은 경우)
    const uniq = parts.filter((p, i) => parts.indexOf(p) === i)
    return uniq.length ? uniq.join(' ') : null
  } catch {
    return null
  }
}

export async function locate(): Promise<Located> {
  const pos = await getPosition()
  if (!pos) return { ...FALLBACK, isFallback: true }
  const label = await reverseGeocode(pos.lat, pos.lon)
  return {
    lat: pos.lat,
    lon: pos.lon,
    label: label ?? `${pos.lat.toFixed(2)}, ${pos.lon.toFixed(2)}`,
    isFallback: false,
  }
}
