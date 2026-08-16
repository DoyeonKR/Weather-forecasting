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
  return { label: '날씨', emoji: '🌡️' }
}

export function isSnowCode(code: number): boolean {
  return (code >= 71 && code <= 77) || code === 85 || code === 86
}

/** 오늘의 실용 멘트 — 어제 비교 + 우산/옷차림/자외선 */
export function funTips(opts: {
  today: DayStats
  yesterday: DayStats
  uvMax: number | null
}): string[] {
  const { today, yesterday, uvMax } = opts
  const tips: string[] = []
  const rainsToday = today.precipSum >= 0.5 || (today.precipProbMax ?? 0) >= 60
  if (isSnowCode(today.code))
    tips.push(
      '☃️ 오늘 눈 소식이 있어요. 길이 미끄러울 수 있으니 평소보다 일찍 나서고, 접지력 좋은 신발을 신는 게 좋아요. 운전하신다면 차간거리를 넉넉하게 잡으세요.',
    )
  else if (rainsToday)
    tips.push(
      `☂️ 오늘 강수확률이 ${today.precipProbMax ?? '?'}%나 돼요. 나갈 때 우산을 꼭 챙기시고, 바람까지 불 수 있으니 접이식보다는 튼튼한 장우산이 낫습니다. 소중한 신발이라면 오늘은 잠시 쉬게 해주세요.`,
    )
  else if (yesterday.precipSum >= 0.5)
    tips.push(
      '🌤️ 어제 내리던 비가 오늘은 그쳐요. 미뤄뒀던 빨래를 돌리기 딱 좋은 날이고, 눅눅해진 이불도 한번 털어서 널어보세요. 창문 열고 환기하기에도 좋습니다.',
    )
  const dMax = round1(today.tmax - yesterday.tmax)
  if (dMax <= -4)
    tips.push(
      `🧥 어제보다 낮 기온이 ${Math.abs(dMax)}°나 낮아요. 어제 입던 대로 나가면 분명 후회하니까 겉옷을 하나 꼭 걸치세요. 따뜻한 음료 한 잔 들고 나가는 것도 괜찮은 선택입니다.`,
    )
  else if (dMax >= 4)
    tips.push(
      `🥵 어제보다 ${dMax}°나 더 더워요. 어제 기억만 믿고 껴입었다간 고생하니 최대한 얇고 시원하게 입으세요. 야외 일정은 가능하면 한낮을 피하는 게 좋아요.`,
    )
  if (today.tmax >= 31)
    tips.push(
      '💧 한낮이 푹푹 찌는 날이에요. 목이 마르기 전에 물을 미리미리 마시고, 뙤약볕 아래 오래 있는 일정은 짧게 끊어 가세요. 실내와 기온차가 크니 냉방병도 조심하세요.',
    )
  if (today.tmin <= 5)
    tips.push(
      '🧣 아침 기온이 한 자릿수 초반까지 떨어져요. 목도리나 두꺼운 겉옷으로 단단히 챙겨 입고 나가세요. 아침 공기가 차니 따뜻한 아침 한 끼도 잊지 마시고요.',
    )
  else if (today.tmin <= 12)
    tips.push(
      '🧥 아침저녁으로 제법 쌀쌀해요. 한낮만 보고 얇게 나갔다간 퇴근길에 떨 수 있으니, 긴팔이나 가볍게 걸칠 겉옷을 챙기는 걸 추천해요.',
    )
  if (uvMax !== null) {
    if (uvMax >= 8)
      tips.push(
        `🧴 자외선 지수가 ${round1(uvMax)}로 매우 강해요. 선크림을 꼭 바르고, 한낮에는 모자나 양산까지 챙기면 좋습니다. 야외에 오래 있는 날이라면 두세 시간마다 덧발라 주세요.`,
      )
    else if (uvMax >= 6 && !rainsToday)
      tips.push(
        `🕶️ 자외선이 강한 편이에요. 잠깐 나가는 길이라도 선크림을 발라두면 피부가 고마워할 거예요. 선글라스가 있다면 오늘 쓰기 좋은 날입니다.`,
      )
  }
  return tips.slice(0, 3)
}

/** 현재 날씨 → 배경 테마 클래스 */
export function themeClass(code: number, isDay: boolean): string {
  if (code >= 95) return 'bg-thunder'
  if (isSnowCode(code)) return 'bg-snow'
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'bg-rain'
  if (code === 45 || code === 48) return 'bg-fog'
  if (code === 3) return 'bg-cloudy'
  if (code === 2) return isDay ? 'bg-partly-day' : 'bg-clear-night'
  return isDay ? 'bg-clear-day' : 'bg-clear-night'
}
