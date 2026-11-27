// 날씨 알림(푸시)을 어느 동네 기준으로 받을지 — "기본 지역"(설정)을 따른다.
// 예전에는 알림을 켤 때 화면에 떠 있던 지역을 저장해서, 위치 권한 전이면 "서울 (기본 위치)",
// 검색해 둘러보던 중이면 그 지역으로 굳어 버렸다(2026-11-27 제보). 지금은 이 함수 하나로 정한다.
import type { Place } from './places'

export type NotifyPlace = { lat: number; lon: number; label: string }

/** 위치를 아무것도 모를 때 서버에 보낼 값 (geo.ts 의 기본 위치와 같다) */
export const FALLBACK_NOTIFY_PLACE: NotifyPlace = { lat: 37.5665, lon: 126.978, label: '서울 (기본 위치)' }

/**
 * 알림 기준 지역.
 *  · 기본 지역이 즐겨찾기 → 그 즐겨찾기
 *  · 기본 지역이 현재 위치 → 마지막으로 받은 실제 현재 위치 (권한 없어 받은 적이 없으면 아래로)
 *  · 현재 위치를 모르면 → 첫 즐겨찾기 (앱도 이때 첫 즐겨찾기를 보여준다)
 *  · 아무것도 없으면 → null (서울 기본 위치로 보내되 "서울 기준"이라고 알린다)
 */
export function notifyPlace(homeId: string, favorites: Place[], currentFix: NotifyPlace | null): NotifyPlace | null {
  const home = favorites.find((f) => f.id === homeId)
  if (home) return { lat: home.lat, lon: home.lon, label: home.name }
  if (currentFix) return currentFix
  const first = favorites[0]
  return first ? { lat: first.lat, lon: first.lon, label: first.name } : null
}

/**
 * 서버에 저장된 지역과 다른가. 0.01° (약 1km) 안쪽은 GPS 흔들림으로 보고 같은 곳으로 친다
 * (서버도 소수 둘째 자리로 묶어 날씨를 받는다). 동네 이름이 바뀌어도 다시 저장한다.
 */
export function placeChanged(
  saved: { p_lat?: unknown; p_lon?: unknown; p_label?: unknown } | null,
  next: NotifyPlace,
): boolean {
  if (!saved || typeof saved.p_lat !== 'number' || typeof saved.p_lon !== 'number') return true
  if (Math.abs(saved.p_lat - next.lat) >= 0.01 || Math.abs(saved.p_lon - next.lon) >= 0.01) return true
  return (typeof saved.p_label === 'string' ? saved.p_label : '') !== next.label.slice(0, 60)
}

/** 화면에 보일 이름 — "서울 (기본 위치)" 는 "서울"로 */
export function notifyPlaceName(p: NotifyPlace | null): string {
  return (p ?? FALLBACK_NOTIFY_PLACE).label.replace(' (기본 위치)', '')
}
