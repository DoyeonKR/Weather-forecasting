// 내 체감 보정 — "어제 어땠어요?" 에 답한 기록으로 옷차림 기준을 사람마다 조금씩 옮긴다.
// 기기 안(localStorage)에만 둔다. 서버로 보내지 않는다.

export type FeelVote = 'cold' | 'ok' | 'hot'

const KEY = 'eojeboda.feel.v1'
/** 한 번 답할 때 옮기는 폭(°C) */
const STEP = 1.5
/** 예전 답의 무게 — 답이 쌓일수록 최근 답 쪽으로 천천히 따라간다 */
const DECAY = 0.75
const LIMIT = 4

interface FeelStore {
  offset: number
  /** 마지막으로 답한 날 (KST YYYY-MM-DD) */
  lastDay: string | null
  count: number
}

function kstDay(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
}

export function loadFeel(): FeelStore {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (v && typeof v.offset === 'number') {
      return { offset: v.offset, lastDay: typeof v.lastDay === 'string' ? v.lastDay : null, count: v.count ?? 0 }
    }
  } catch {
    // 무시
  }
  return { offset: 0, lastDay: null, count: 0 }
}

function save(s: FeelStore) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // 저장이 막혀도 이번 화면에는 반영된다
  }
}

/** 순수 계산 — 테스트 대상. 추웠다 → 음수 쪽(추위를 타는 편) */
export function nextOffset(prev: number, vote: FeelVote): number {
  const push = vote === 'cold' ? -STEP : vote === 'hot' ? STEP : 0
  const v = prev * DECAY + push
  return Math.round(Math.max(-LIMIT, Math.min(LIMIT, v)) * 10) / 10
}

export function voteFeel(vote: FeelVote): FeelStore {
  const cur = loadFeel()
  const next = { offset: nextOffset(cur.offset, vote), lastDay: kstDay(), count: cur.count + 1 }
  save(next)
  return next
}

export function resetFeel(): FeelStore {
  const next = { offset: 0, lastDay: kstDay(), count: 0 }
  save(next)
  return next
}

export function answeredToday(s: FeelStore): boolean {
  return s.lastDay === kstDay()
}

/** 화면용 한 줄 */
export function feelLabel(offset: number): string | null {
  if (Math.abs(offset) < 0.5) return null
  const deg = Math.abs(offset).toFixed(1)
  return offset < 0 ? `추위를 타는 편 (옷차림 ${deg}° 따뜻하게)` : `더위를 타는 편 (옷차림 ${deg}° 가볍게)`
}

// ── 어제 옷차림 추천 기억 ─────────────────────────────
// "어제 어땠어요?"만 물으면 무엇과 비교해 추웠는지 모른다. 어제 보여준 옷차림을 남겨 두고
// 질문에 넣어서, 답이 "우리 추천 대비"가 되게 한다.
const CLOTHES_KEY = 'eojeboda.clothes.v1'

function dayOffset(days: number): string {
  return new Date(Date.now() + 9 * 3600_000 + days * 86_400_000).toISOString().slice(0, 10)
}

export function rememberClothes(title: string) {
  try {
    const cur = JSON.parse(localStorage.getItem(CLOTHES_KEY) ?? '{}') as Record<string, string>
    const today = dayOffset(0)
    if (cur[today] === title) return
    // 오늘·어제 것만 남긴다
    const next: Record<string, string> = { [today]: title }
    const y = dayOffset(-1)
    if (cur[y]) next[y] = cur[y]
    localStorage.setItem(CLOTHES_KEY, JSON.stringify(next))
  } catch {
    // 무시
  }
}

export function yesterdayClothes(): string | null {
  try {
    const cur = JSON.parse(localStorage.getItem(CLOTHES_KEY) ?? '{}') as Record<string, string>
    return cur[dayOffset(-1)] ?? null
  } catch {
    return null
  }
}
