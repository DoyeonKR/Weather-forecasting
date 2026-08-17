// 순수 비교 로직 — API 의존 없음(테스트 가능)

/** 하루 요약 통계 */
export interface DayStats {
  tmax: number
  tmin: number
  precipSum: number
  precipProbMax: number | null
  code: number
  /** 최대 풍속 km/h */
  windMax?: number | null
  /** 최대 순간풍속(돌풍) km/h */
  gustMax?: number | null
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
  // 강수형태 세부 구분(이슬비 등)은 수치모델 신뢰도가 낮아 단정하지 않는다
  if (code >= 51 && code <= 57) return { label: '약한 비', emoji: '🌦️' }
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

/** 오늘의 실용 멘트 — 강수·기온·바람·자외선을 세분화된 구간으로 판단, 최대 3개 */
export function funTips(opts: {
  today: DayStats
  yesterday: DayStats
  uvMax: number | null
}): string[] {
  const { today, yesterday, uvMax } = opts
  const tips: string[] = []
  const prob = today.precipProbMax ?? 0
  const rain = today.precipSum
  const wind = today.windMax ?? 0
  const gust = today.gustMax ?? 0
  const rainsToday = rain >= 0.5 || prob >= 60

  // ── 1순위: 위험 기상 (눈·호우·강풍)
  if (isSnowCode(today.code)) {
    if (today.tmax <= 0)
      tips.push(
        '☃️ 종일 영하에 눈까지 와요. 쌓인 눈이 그대로 얼어붙는 날이니 미끄럼 방지 되는 신발에, 주머니 손 넣고 걷기 금지! 운전은 되도록 대중교통으로 바꾸세요.',
      )
    else
      tips.push(
        '🌨️ 오늘 눈 소식이 있어요. 길이 미끄러울 수 있으니 평소보다 일찍 나서고, 접지력 좋은 신발을 신는 게 좋아요. 운전하신다면 차간거리를 넉넉하게.',
      )
  } else if (rain >= 50)
    tips.push(
      `🌧️ 오늘 비가 아주 많이 와요(예상 ${round1(rain)}mm). 장우산에 방수 신발까지 갖추고, 하천 산책로나 지하차도 근처는 피하세요. 이동 일정은 여유 있게 잡는 게 안전합니다.`,
    )
  else if (gust >= 60 || wind >= 40)
    tips.push(
      `💨 바람이 매우 강한 날이에요(순간 최대 ${Math.round(gust || wind)}km/h). 우산은 뒤집히기 십상이니 비가 온다면 우비가 낫고, 간판이나 떨어지는 물건도 조심하세요.`,
    )

  // ── 2순위: 비 (확률·양 구간별)
  if (!isSnowCode(today.code)) {
    if (rain >= 20 && rain < 50)
      tips.push(
        `☔ 오늘 ${round1(rain)}mm쯤 꽤 오는 비예요. 튼튼한 장우산에 젖어도 되는 신발을 추천해요. 바짓단은 오늘만 살짝 접어주세요.`,
      )
    else if (prob >= 80 && rain < 20)
      tips.push(
        `☂️ 비가 거의 확실해요(확률 ${prob}%). 현관에서 우산 챙겼는지 한 번만 더 확인하세요. 양은 많지 않아도 맞고 다니기엔 충분히 젖습니다.`,
      )
    else if (prob >= 60 && rain < 20)
      tips.push(
        `☂️ 강수확률 ${prob}%, 우산을 챙기는 쪽이 이기는 날이에요. 짐이 많다면 가벼운 접이식이라도 가방에 넣어두세요.`,
      )
    else if (prob >= 40)
      tips.push(
        `🌂 강수확률 ${prob}%로 애매한 하늘이에요. 접이식 우산 하나 가방에 넣어두면 마음이 편합니다. 안 오면 다행이고요.`,
      )
    else if (prob >= 20 && today.tmax >= 27)
      tips.push(
        '🌦️ 한낮 소나기 가능성이 살짝 있어요. 세차는 내일로 미루는 게 정신 건강에 좋을지도 몰라요.',
      )
    else if (yesterday.precipSum >= 0.5 && prob < 20)
      tips.push(
        '🌤️ 어제 내리던 비가 오늘은 그쳐요. 미뤄뒀던 빨래를 돌리기 딱 좋은 날이고, 눅눅해진 이불도 한번 털어 널어보세요.',
      )
  }

  // ── 3순위: 어제 대비 급변
  const dMax = round1(today.tmax - yesterday.tmax)
  if (dMax <= -7)
    tips.push(
      `🧊 어제보다 낮 기온이 ${Math.abs(dMax)}°나 뚝 떨어져요. 어제 옷차림은 완전히 잊고 한 단계 두껍게 입으세요. 감기 걸리기 딱 좋은 날씨입니다.`,
    )
  else if (dMax <= -4)
    tips.push(
      `🧥 어제보다 낮이 ${Math.abs(dMax)}° 서늘해요. 어제 입던 대로 나가면 후회하니 겉옷 하나 꼭 걸치세요. 따뜻한 음료 한 잔도 좋은 선택.`,
    )
  else if (dMax >= 7)
    tips.push(
      `🥵 어제보다 ${dMax}°나 확 더워져요. 어제 기억은 버리고 한여름 모드로 입으세요. 차 안에 뒀던 물병도 오늘은 뜨거워집니다.`,
    )
  else if (dMax >= 4)
    tips.push(
      `🌡️ 어제보다 ${dMax}° 더 더워요. 한 겹 덜 입는 게 정답이고, 야외 일정은 한낮을 피하면 한결 낫습니다.`,
    )

  // ── 4순위: 절대 기온 옷차림 (낮 최고 기준, 촘촘한 구간)
  const t = today.tmax
  if (t >= 35)
    tips.push(
      `🥵 낮 최고 ${round1(t)}°, 위험한 더위예요. 한낮 야외활동은 최대한 피하고 물을 수시로 마시세요. 어르신과 아이는 특히 조심해야 하는 날입니다.`,
    )
  else if (t >= 33)
    tips.push(
      `🔥 낮 최고 ${round1(t)}° 폭염이에요. 통풍 잘 되는 옷에 양산이 의외로 큰 도움이 됩니다. 실내외 온도차가 크니 냉방병도 슬쩍 조심.`,
    )
  else if (t >= 31)
    tips.push(
      `💧 한낮이 ${round1(t)}°까지 올라 푹푹 쪄요. 목마르기 전에 물을 미리 마시고, 뙤약볕 일정은 짧게 끊어 가세요.`,
    )
  else if (t >= 28)
    tips.push(
      `☀️ 낮엔 ${round1(t)}°까지 올라 반팔이 맞아요. 다만 실내 냉방이 셀 수 있으니 얇은 겉옷 하나면 완벽합니다.`,
    )
  else if (t >= 25)
    tips.push(`😌 낮 최고 ${round1(t)}°, 반팔이나 아주 얇은 긴팔이 딱 좋은 날이에요. 활동하기 좋습니다.`)
  else if (t >= 21)
    tips.push(
      `🍃 낮 ${round1(t)}°로 쾌적한 날씨예요. 가벼운 긴팔 하나로 충분하고, 산책이나 야외 일정 잡기 좋은 날입니다.`,
    )
  else if (t >= 17)
    tips.push(
      `🍂 낮에도 ${round1(t)}°라 선선해요. 긴팔에 가벼운 겉옷 조합을 추천해요. 해 지면 제법 쌀쌀해집니다.`,
    )
  else if (t >= 12)
    tips.push(
      `🧥 낮 최고가 ${round1(t)}°에 그쳐요. 니트나 자켓 정도는 입어야 하는 날씨입니다. 얇게 나가면 종일 웅크리게 돼요.`,
    )
  else if (t >= 5)
    tips.push(
      `🧤 종일 추워요(낮 최고 ${round1(t)}°). 코트나 패딩을 꺼낼 때가 됐습니다. 목만 따뜻해도 체감이 확 달라져요.`,
    )
  else if (t >= 0)
    tips.push(
      `⛄ 낮에도 ${round1(t)}°밖에 안 돼요. 두꺼운 패딩에 목도리, 장갑까지 풀장착을 추천합니다. 따뜻한 음료 텀블러도 챙기세요.`,
    )
  else
    tips.push(
      `🥶 낮 최고가 영하 ${Math.abs(round1(t))}°인 혹한이에요. 핫팩을 챙기고 피부 노출을 최소화하세요. 수도 동파도 조심할 날입니다.`,
    )

  // ── 5순위: 일교차·중간 바람
  if (today.tmax - today.tmin >= 12 && today.tmax >= 20)
    tips.push(
      `🌅 아침 ${round1(today.tmin)}°, 낮 ${round1(today.tmax)}°로 일교차가 커요. 입고 벗기 쉬운 레이어드로 나가면 하루 종일 편합니다.`,
    )
  if (wind >= 25 && wind < 40 && gust < 60)
    tips.push(
      `🍃 바람이 제법 부는 날이에요(최대 ${Math.round(wind)}km/h). 얇은 옷은 바람에 뚫리니 바람막이가 든든하고, 체감온도는 숫자보다 낮게 느껴집니다.`,
    )

  // ── 6순위: 자외선
  if (uvMax !== null) {
    if (uvMax >= 8)
      tips.push(
        `🧴 자외선 지수 ${round1(uvMax)}, 매우 강해요. 선크림 필수에 한낮엔 모자나 양산까지. 야외에 오래 있다면 두세 시간마다 덧발라 주세요.`,
      )
    else if (uvMax >= 6 && !rainsToday)
      tips.push(
        '🕶️ 자외선이 강한 편이에요. 잠깐 나가는 길이라도 선크림을 발라두면 피부가 고마워합니다. 선글라스 쓰기 좋은 날.',
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
