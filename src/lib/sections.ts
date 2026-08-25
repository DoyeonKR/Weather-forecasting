// 메인 화면 섹션 순서 — 사용자 커스터마이즈 (localStorage)
export type SectionKey = 'hero' | 'compare' | 'hourly' | 'tomorrow' | 'week' | 'radar' | 'places'

export const SECTION_LABEL: Record<SectionKey, string> = {
  hero: '메인 (현재 날씨)',
  compare: '어제와 비교하면',
  hourly: '시간대별 기온·강수',
  tomorrow: '내일은 오늘보다',
  week: '이번 주 날씨',
  radar: '비구름 레이더',
  places: '지역 비교',
}

export const DEFAULT_ORDER: SectionKey[] = ['hero', 'compare', 'hourly', 'tomorrow', 'week', 'radar', 'places']

const KEY = 'eojeboda:sections'

export function loadOrder(): SectionKey[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return [...DEFAULT_ORDER]
    const list = JSON.parse(raw) as string[]
    // 중복 키가 있으면 같은 카드가 두 번 그려지고 정렬 indexOf 가 어긋난다
    const valid = [...new Set(list)].filter((k): k is SectionKey => (DEFAULT_ORDER as string[]).includes(k))
    // 새로 생긴 섹션은 기본 위치 근처(끝)에 추가
    for (const k of DEFAULT_ORDER) if (!valid.includes(k)) valid.push(k)
    return valid
  } catch {
    return [...DEFAULT_ORDER]
  }
}

export function saveOrder(order: SectionKey[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(order))
  } catch {
    // 무시
  }
}

/** 배열에서 id 를 dir 만큼 이동한 새 배열 */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const next = [...list]
  const [it] = next.splice(from, 1)
  next.splice(to, 0, it)
  return next
}
