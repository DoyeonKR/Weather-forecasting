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
