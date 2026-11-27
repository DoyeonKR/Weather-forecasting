// 시간대별 카드의 "비" 줄 — 칸마다 예상 강수량, 비가 아직 먼 곳에 있으면 "다음 비" 안내.
// 칸은 3시간 간격이라 그 칸 시각부터 3시간 동안 내릴 양을 더한다 (예전에는 그 시각 한 시간치만 써서 적게 보였다).

/** 칸별 강수량(mm): idx[k] 시각부터 step 시간 동안의 합 */
export function columnPrecip(precip: (number | null | undefined)[], idx: number[], step: number): number[] {
  return idx.map((i) => {
    let sum = 0
    for (let j = i; j < i + step && j < precip.length; j++) {
      const v = precip[j]
      if (typeof v === 'number' && v > 0) sum += v
    }
    return Math.round(sum * 10) / 10
  })
}

/** 이 양부터 "비"로 친다 (0.1mm 미만은 표시도 0.0mm 라 잡음) */
export const RAIN_MIN_MM = 0.1

/** 다음 비 묶음: 처음 비가 오는 칸과, 거기서부터 비가 이어지는 동안의 합. 없으면 null */
export function nextRain(pr: number[]): { k: number; total: number } | null {
  const k = pr.findIndex((p) => p >= RAIN_MIN_MM)
  if (k < 0) return null
  let total = 0
  for (let j = k; j < pr.length && pr[j] >= RAIN_MIN_MM; j++) total += pr[j]
  return { k, total: Math.round(total * 10) / 10 }
}

/** 강수량 표기 — 1mm 미만은 소수 한 자리 */
export function mm(v: number): string {
  return v < 1 ? `${v.toFixed(1)}mm` : `${Math.round(v)}mm`
}

/**
 * "비" 줄 앞쪽 안내 — 무엇을 말할지 (우선순위 순).
 *  1. now    : 기상청 실황이 지금 비라고 한다 → "지금 비" (예보 양이 0이어도 — 모델이 소나기를 놓친다, 2026-11-27 제보)
 *  2. chance : 앞쪽 칸 강수확률이 50%↑ 인데 예보 양은 0.1mm 미만 → "비 올 수 있어요 · 최대 61%"
 *              (예전에는 이때 며칠 뒤 "다음 비"만 보여 지금은 비가 안 오는 것처럼 읽혔다)
 *  3. next   : 비가 멀리 있으면 "다음 비 → 언제·얼마나"
 *  없으면 null. 가까운 칸에 실제 강수량이 있으면(막대가 보이면) 안내하지 않는다.
 */
export type LaneNote =
  | { kind: 'now'; mm: number | null }
  | { kind: 'chance'; prob: number }
  | { kind: 'next'; k: number; total: number }

export const CHANCE_PROB = 50

export function laneNote(
  pr: number[],
  prob: (number | null)[],
  observed: { raining: boolean; rn1: number | null } | null,
  firstN: number,
  nextMinCols: number,
): LaneNote | null {
  if (observed?.raining) return { kind: 'now', mm: observed.rn1 !== null && observed.rn1 > 0 ? observed.rn1 : null }
  const next = nextRain(pr)
  if (next && next.k < nextMinCols) return null // 곧 오는 비는 막대·숫자가 직접 보인다
  let best = -1
  for (let k = 0; k < Math.min(firstN, pr.length); k++) {
    const p = prob[k]
    if (pr[k] < RAIN_MIN_MM && typeof p === 'number' && p >= CHANCE_PROB) best = Math.max(best, p)
  }
  if (best >= 0) return { kind: 'chance', prob: best }
  return next ? { kind: 'next', k: next.k, total: next.total } : null
}
