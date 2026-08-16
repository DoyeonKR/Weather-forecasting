// 순수 비교 로직 — API 의존 없음(테스트 가능)

/** 하루 요약 통계 */
export interface DayStats {
  tmax: number
  tmin: number
  precipSum: number
  precipProbMax: number | null
  code: number
}

/** 소수 1자리 반올림 */
export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** 온도 차이를 문장으로. delta = 기준일 - 비교일 (양수면 기준일이 더 높음) */
export function deltaText(delta: number): string {
  const d = round1(delta)
  if (Math.abs(d) < 0.5) return '비슷해요'
  return d > 0 ? `${d}° 높아요` : `${Math.abs(d)}° 낮아요`
}

/** 지금 기온 vs 어제 같은 시각 헤드라인 */
export function nowHeadline(nowTemp: number, yesterdaySameHour: number): {
  delta: number
  text: string
} {
  const delta = round1(nowTemp - yesterdaySameHour)
  if (Math.abs(delta) < 0.5) return { delta, text: '어제 이 시간과 비슷해요' }
  return {
    delta,
    text: delta > 0 ? `어제 이 시간보다 ${delta}° 높아요` : `어제 이 시간보다 ${Math.abs(delta)}° 낮아요`,
  }
}

/** 강수 비교 한 줄 요약 (오늘 vs 어제) */
export function precipSummary(today: DayStats, yesterday: DayStats): string | null {
  const rainedYesterday = yesterday.precipSum >= 0.5
  const rainsToday = today.precipSum >= 0.5 || (today.precipProbMax ?? 0) >= 60
  if (rainsToday && !rainedYesterday) return '어제는 안 왔던 비가 올 수 있어요'
  if (!rainsToday && rainedYesterday) return '어제 내리던 비는 그쳐요'
  if (rainsToday && rainedYesterday) return '어제에 이어 오늘도 비 소식이 있어요'
  return null
}

/** 내일 vs 오늘 주의 사항(자기 전 알림의 근거 로직) */
export function tomorrowAlerts(tomorrow: DayStats, today: DayStats): string[] {
  const alerts: string[] = []
  const dMax = round1(tomorrow.tmax - today.tmax)
  const dMin = round1(tomorrow.tmin - today.tmin)
  if (dMax <= -5) alerts.push(`내일 낮 기온이 오늘보다 ${Math.abs(dMax)}° 낮아요`)
  if (dMax >= 5) alerts.push(`내일 낮 기온이 오늘보다 ${dMax}° 높아요`)
  if (dMin <= -5) alerts.push(`내일 아침이 오늘보다 ${Math.abs(dMin)}° 추워요`)
  if ((tomorrow.precipProbMax ?? 0) >= 60 && (today.precipProbMax ?? 0) < 60) {
    alerts.push(`내일 비 올 확률 ${tomorrow.precipProbMax}%`)
  }
  if (isSnowCode(tomorrow.code)) alerts.push('내일 눈 소식이 있어요')
  return alerts
}

/** WMO weather code → 한국어 라벨 + 이모지 */
export function codeLabel(code: number): { label: string; emoji: string } {
  if (code === 0) return { label: '맑음', emoji: '☀️' }
  if (code === 1) return { label: '대체로 맑음', emoji: '🌤️' }
  if (code === 2) return { label: '구름 조금', emoji: '⛅' }
  if (code === 3) return { label: '흐림', emoji: '☁️' }
  if (code === 45 || code === 48) return { label: '안개', emoji: '🌫️' }
  if (code >= 51 && code <= 57) return { label: '이슬비', emoji: '🌦️' }
  if (code >= 61 && code <= 67) return { label: '비', emoji: '🌧️' }
  if (code >= 71 && code <= 77) return { label: '눈', emoji: '🌨️' }
  if (code >= 80 && code <= 82) return { label: '소나기', emoji: '🌧️' }
  if (code === 85 || code === 86) return { label: '소낙눈', emoji: '🌨️' }
  if (code >= 95) return { label: '뇌우', emoji: '⛈️' }
  return { label: '—', emoji: '🌡️' }
}

export function isSnowCode(code: number): boolean {
  return (code >= 71 && code <= 77) || code === 85 || code === 86
}
