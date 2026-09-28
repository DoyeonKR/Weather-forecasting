// 메인 화면 섹션 순서 — 사용자 커스터마이즈 (localStorage)
export type SectionKey = 'hero' | 'prep' | 'compare' | 'tomorrow' | 'week' | 'radar' | 'places'

export const SECTION_LABEL: Record<SectionKey, string> = {
  hero: '메인 (현재 날씨)',
  prep: '오늘의 준비',
  compare: '어제와 비교하면',
  tomorrow: '내일은 오늘보다',
  week: '이번 주 날씨',
  radar: '비구름 레이더',
  places: '지역 비교',
}

export const DEFAULT_ORDER: SectionKey[] = ['hero', 'prep', 'compare', 'tomorrow', 'week', 'radar', 'places']

const KEY = 'eojeboda:sections'

/** 저장된 순서를 읽는다 (순수 함수 부분 — 테스트 대상) */
export function normalizeOrder(list: unknown): SectionKey[] {
  if (!Array.isArray(list)) return [...DEFAULT_ORDER]
  // 중복 키가 있으면 같은 카드가 두 번 그려지고 정렬 indexOf 가 어긋난다
  const valid = [...new Set(list)].filter((k): k is SectionKey => (DEFAULT_ORDER as string[]).includes(k as string))
  // 새로 생긴 섹션은 끝이 아니라 기본 순서에서 바로 앞 카드 뒤에 넣는다.
  // (오늘의 준비가 원래 메인 카드 안에 있었으니, 메인 바로 아래가 자연스럽다)
  DEFAULT_ORDER.forEach((k, i) => {
    if (valid.includes(k)) return
    const prev = DEFAULT_ORDER.slice(0, i).reverse().find((p) => valid.includes(p))
    valid.splice(prev ? valid.indexOf(prev) + 1 : 0, 0, k)
  })
  return valid
}

export function loadOrder(): SectionKey[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? normalizeOrder(JSON.parse(raw)) : [...DEFAULT_ORDER]
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
