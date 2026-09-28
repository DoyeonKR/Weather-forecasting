// 미세먼지·초미세먼지 — Open-Meteo 대기질 API (CAMS 예측 모델, 키 불필요)
// past_days=1 로 어제 같은 시각 값을 같이 받아 "어제보다" 로 말한다.
// ⚠ 측정소 실측(에어코리아)이 아니라 모델 값이다. 화면에 출처와 함께 밝힌다.

/** 환경부 예보 등급: 0 좋음 · 1 보통 · 2 나쁨 · 3 매우 나쁨 */
export type AirGrade = 0 | 1 | 2 | 3

export const GRADE_LABEL = ['좋음', '보통', '나쁨', '매우 나쁨'] as const

/** PM10 ㎍/㎥ — 30 / 80 / 150 */
export function gradePm10(v: number): AirGrade {
  if (v <= 30) return 0
  if (v <= 80) return 1
  if (v <= 150) return 2
  return 3
}

/** PM2.5 ㎍/㎥ — 15 / 35 / 75 */
export function gradePm25(v: number): AirGrade {
  if (v <= 15) return 0
  if (v <= 35) return 1
  if (v <= 75) return 2
  return 3
}

export interface AirNow {
  pm10: number
  pm25: number
  /** 둘 중 나쁜 쪽 */
  grade: AirGrade
  /** 어제 같은 시각 */
  pm10Yest: number | null
  pm25Yest: number | null
  gradeYest: AirGrade | null
  /** 앞으로 12시간 안에 지금보다 나빠지는 첫 시각 (없으면 null) */
  worse: { hour: number; grade: AirGrade } | null
}

/** 한 시각의 종합 등급 */
export function gradeOf(pm10: number, pm25: number): AirGrade {
  return Math.max(gradePm10(pm10), gradePm25(pm25)) as AirGrade
}

/**
 * 시간별 배열에서 지금·어제·앞으로를 뽑는다 (순수 함수 — 테스트 대상).
 * 배열은 어제 0시부터 시작한다(past_days=1). nowIdx = 24 + 현재 시.
 */
export function summarizeAir(
  pm10: (number | null)[],
  pm25: (number | null)[],
  nowIdx: number,
  hourOf: (i: number) => number,
): AirNow | null {
  const a = pm10[nowIdx]
  const b = pm25[nowIdx]
  if (typeof a !== 'number' || typeof b !== 'number') return null
  const grade = gradeOf(a, b)
  const ya = pm10[nowIdx - 24]
  const yb = pm25[nowIdx - 24]
  const hasYest = typeof ya === 'number' && typeof yb === 'number'
  let worse: AirNow['worse'] = null
  for (let i = nowIdx + 1; i <= nowIdx + 12 && i < pm10.length; i++) {
    const x = pm10[i]
    const y = pm25[i]
    if (typeof x !== 'number' || typeof y !== 'number') continue
    const g = gradeOf(x, y)
    if (g > grade && g >= 2) {
      worse = { hour: hourOf(i), grade: g }
      break
    }
  }
  return {
    pm10: Math.round(a),
    pm25: Math.round(b),
    grade,
    pm10Yest: hasYest ? Math.round(ya as number) : null,
    pm25Yest: hasYest ? Math.round(yb as number) : null,
    gradeYest: hasYest ? gradeOf(ya as number, yb as number) : null,
    worse,
  }
}

export async function fetchAir(lat: number, lon: number): Promise<AirNow | null> {
  try {
    const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality')
    url.searchParams.set('latitude', String(lat))
    url.searchParams.set('longitude', String(lon))
    url.searchParams.set('timezone', 'auto')
    url.searchParams.set('past_days', '1')
    url.searchParams.set('forecast_days', '2')
    url.searchParams.set('hourly', 'pm10,pm2_5')
    url.searchParams.set('current', 'pm10,pm2_5')
    const res = await fetch(url)
    if (!res.ok) return null
    const d = await res.json()
    const times: string[] = d?.hourly?.time ?? []
    const nowHour = new Date(d?.current?.time ?? '').getHours()
    if (!times.length || Number.isNaN(nowHour)) return null
    return summarizeAir(d.hourly.pm10 ?? [], d.hourly.pm2_5 ?? [], 24 + nowHour, (i) =>
      new Date(times[i]).getHours(),
    )
  } catch {
    return null
  }
}
