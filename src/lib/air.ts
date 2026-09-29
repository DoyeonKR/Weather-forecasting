// 미세먼지·초미세먼지 — Open-Meteo 대기질 API (CAMS 예측 모델, 키 불필요)
// past_days=1 로 어제 같은 시각 값을 같이 받아 "어제보다" 로 말한다.
// 국내는 에어코리아 측정소 실측을 먼저 쓰고(서버 프록시 air-korea), 안 되면 모델 값으로.
// 모델 값일 때는 화면에 출처를 함께 밝힌다.

import { isBackedOff, markFailed, markOk } from './backoff'

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
  /** 앞으로 12시간 안에 지금보다 나빠지는 첫 시각 (없으면 null). nextDay: 내일이면 true */
  worse: { hour: number; grade: AirGrade; nextDay?: boolean } | null
  /** 값의 출처 — 에어코리아 측정소 실측이면 측정소 이름 */
  source?: { kind: 'airkorea'; station: string } | { kind: 'cams' }
}

interface AirKorea {
  station: string
  pm10: number
  pm25: number
  pm10Yest: number | null
  pm25Yest: number | null
}

const AK_PROXY = 'https://tqegatiuembcvphxmujl.supabase.co/functions/v1/air-korea'

/** 가까운 측정소 실측 (국내만). 서비스 미승인·측정소 없음이면 null → 모델 값으로 */
async function fetchAirKorea(lat: number, lon: number): Promise<AirKorea | null> {
  if (!(lat > 32.5 && lat < 40.5 && lon > 123 && lon < 132.5)) return null
  if (isBackedOff('air-korea')) return null
  try {
    const res = await fetch(`${AK_PROXY}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`)
    // 502(서비스 미승인·업스트림 장애)는 잠시 쉰다. 404(가까운 측정소 없음)는 이 지점만의 사정이라 쉬지 않는다.
    if (!res.ok) {
      if (res.status >= 500) markFailed('air-korea')
      return null
    }
    const d = await res.json()
    if (typeof d?.pm10 === 'number' && typeof d?.pm25 === 'number') {
      markOk('air-korea')
      return d as AirKorea
    }
    return null
  } catch {
    markFailed('air-korea')
    return null
  }
}

/**
 * 실측(지금·어제)과 모델(앞으로)을 합친다 (순수 함수 — 테스트 대상).
 * 실측이 있으면 지금·어제는 실측으로, "나빠지는 시각"은 모델에서 실측 등급보다 나쁜 것만.
 */
export function mergeAir(model: AirNow | null, ak: AirKorea | null): AirNow | null {
  if (!ak) return model ? { ...model, source: { kind: 'cams' } } : null
  const grade = gradeOf(ak.pm10, ak.pm25)
  const hasYest = ak.pm10Yest !== null && ak.pm25Yest !== null
  const worse = model?.worse && model.worse.grade > grade ? model.worse : null
  return {
    pm10: Math.round(ak.pm10),
    pm25: Math.round(ak.pm25),
    grade,
    pm10Yest: hasYest ? Math.round(ak.pm10Yest as number) : null,
    pm25Yest: hasYest ? Math.round(ak.pm25Yest as number) : null,
    gradeYest: hasYest ? gradeOf(ak.pm10Yest as number, ak.pm25Yest as number) : null,
    worse,
    source: { kind: 'airkorea', station: ak.station },
  }
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
      // 배열은 어제 0시부터라 48번째부터가 내일이다 ("2시쯤"이 오늘 새벽인지 내일 새벽인지 헷갈리지 않게)
      worse = { hour: hourOf(i), grade: g, nextDay: i >= 48 }
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
  const [model, ak] = await Promise.all([fetchAirModel(lat, lon), fetchAirKorea(lat, lon)])
  return mergeAir(model, ak)
}

async function fetchAirModel(lat: number, lon: number): Promise<AirNow | null> {
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
