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

/** 실용 멘트 한 건: 큰 이모지 + 핵심 키워드 + 긴 설명 */
export interface Tip {
  emoji: string
  title: string
  body: string
}

/** 오늘의 실용 멘트 — 강수·기온·바람·자외선을 세분화된 구간으로 판단, 최대 3개 */
export function funTips(opts: {
  today: DayStats
  yesterday: DayStats
  uvMax: number | null
  /** 대기질 종합 등급 (0 좋음 ~ 3 매우 나쁨). 모르면 생략 */
  airGrade?: number | null
  /**
   * 내 체감 보정(°C). 음수면 추위를 타는 편 → 옷차림을 더 따뜻한 쪽으로 고른다.
   * 옷차림 단계에만 쓴다. 폭염·혹한 같은 위험 안내는 실제 기온으로만 판단한다.
   */
  feelOffset?: number
}): Tip[] {
  const { today, yesterday, uvMax } = opts
  const feel = Math.max(-4, Math.min(4, opts.feelOffset ?? 0))
  // rank 가 낮을수록 먼저 보여준다. 예전에는 넣는 순서대로 잘라서,
  // 강풍 팁 하나가 켜지면 혹한이나 폭염 안내가 3개 밖으로 밀려났다.
  const tips: (Tip & { rank: number })[] = []
  const add = (emoji: string, title: string, body: string, rank: number) =>
    tips.push({ emoji, title, body, rank })
  const prob = today.precipProbMax ?? 0
  const rain = today.precipSum
  const wind = today.windMax ?? 0
  const gust = today.gustMax ?? 0
  const rainsToday = rain >= 0.5 || prob >= 60
  const snow = isSnowCode(today.code)
  const strongWind = gust >= 60 || wind >= 40
  // 어는 비·어는 이슬비 (WMO 56, 57, 66, 67). 눈보다 미끄럽다
  const freezing = today.code === 56 || today.code === 57 || today.code === 66 || today.code === 67

  // ── 1순위: 위험 기상 (어는 비·눈·호우·강풍)
  if (freezing)
    add('🧊', '어는 비, 빙판 주의', '떨어지자마자 어는 비예요. 눈보다 훨씬 미끄럽고 눈에 잘 보이지도 않습니다. 계단과 횡단보도 앞을 특히 조심하고, 오늘은 대중교통을 권해요.', 0)
  else if (snow) {
    // 낮에 녹았다가 밤에 다시 어는 날이 가장 흔하다. 낮 최고만 보면 그 패턴을 놓친다
    if (today.tmax <= 1 || today.tmin <= -3)
      add('☃️', '빙판길 주의', '눈이 오는데 기온이 낮아 녹은 자리가 그대로 얼어붙어요. 미끄럼 방지 되는 신발에, 주머니 손 넣고 걷기 금지! 운전은 되도록 대중교통으로 바꾸세요.', 0)
    else
      add('🌨️', '눈길 조심', '오늘 눈 소식이 있어요. 길이 미끄러울 수 있으니 평소보다 일찍 나서고, 접지력 좋은 신발을 신는 게 좋아요. 운전하신다면 차간거리를 넉넉하게.', 0)
  } else if (rain >= 50)
    add('🌧️', '장우산 + 방수 신발', `오늘 비가 아주 많이 와요(예상 ${round1(rain)}mm). 장우산에 방수 신발까지 갖추고, 하천 산책로나 지하차도 근처는 피하세요. 이동 일정은 여유 있게 잡는 게 안전합니다.`, 0)
  else if (strongWind) {
    // 비가 안 오는데 우비를 권하면 이상하고, 비가 오면 아래 우산 팁과 정면으로 부딪힌다
    if (rainsToday)
      add('💨', '강풍, 우산 대신 우비', `바람이 매우 강한 날이에요(순간 최대 ${Math.round(gust || wind)}km/h). 비도 오는데 우산은 뒤집히기 십상이라 우비나 방수 겉옷이 낫습니다. 간판이나 떨어지는 물건도 조심하세요.`, 0)
    else
      add('💨', '강풍 주의', `바람이 매우 강한 날이에요(순간 최대 ${Math.round(gust || wind)}km/h). 모자나 가벼운 짐은 날아가기 쉽고, 간판이나 떨어지는 물건도 조심하세요. 자전거나 킥보드는 오늘만 쉬어가세요.`, 0)
  }

  // ── 2순위: 비 (확률·양 구간별, 호우와 강풍은 위에서 처리됨)
  if (!snow && !freezing && rain < 50 && !strongWind) {
    if (rain >= 20)
      add('☔', '튼튼한 장우산', `오늘 ${round1(rain)}mm쯤 꽤 오는 비예요. 튼튼한 장우산에 젖어도 되는 신발을 추천해요. 바짓단은 오늘만 살짝 접어주세요.`, 1)
    else if (prob >= 80)
      add('☂️', '우산 필수', `비가 거의 확실해요(확률 ${prob}%). 현관에서 우산 챙겼는지 한 번만 더 확인하세요. 양은 많지 않아도 맞고 다니기엔 충분히 젖습니다.`, 1)
    else if (prob >= 60)
      add('☂️', '우산 챙기기', `강수확률 ${prob}%, 우산을 챙기는 쪽이 이기는 날이에요. 짐이 많다면 가벼운 접이식이라도 가방에 넣어두세요.`, 1)
    else if (prob >= 40)
      add('🌂', '접이식 우산', `강수확률 ${prob}%로 애매한 하늘이에요. 접이식 우산 하나 가방에 넣어두면 마음이 편합니다. 안 오면 다행이고요.`, 1)
    else if (prob >= 20 && today.tmax >= 27)
      add('🌦️', '소나기 가능성', '한낮 소나기 가능성이 살짝 있어요. 세차는 내일로 미루는 게 정신 건강에 좋을지도 몰라요.', 2)
    else if (yesterday.precipSum >= 0.5 && prob < 20 && isSnowCode(yesterday.code))
      add('🌤️', '눈 그친 날', '어제 내리던 눈이 오늘은 그쳐요. 녹다 만 자리가 얼어 있을 수 있으니 그늘진 골목과 계단은 조심해서 걸으세요.', 2)
    else if (yesterday.precipSum >= 0.5 && prob < 20 && today.tmax >= 12)
      add('🌤️', '빨래 찬스', '어제 내리던 비가 오늘은 그쳐요. 미뤄뒀던 빨래를 돌리기 딱 좋은 날이고, 눅눅해진 이불도 한번 털어 널어보세요.', 2)
  }

  // ── 3순위: 어제 대비 급변
  // 여기서는 '변화'만 말한다. 절대 옷차림은 아래 4순위가 책임진다.
  // 둘 다 옷차림을 지시하면 낮 9도에 한여름 모드와 패딩이 나란히 뜬다.
  const dMax = round1(today.tmax - yesterday.tmax)
  if (dMax <= -7)
    add('🧊', '어제보다 훨씬 추움', `어제보다 낮 기온이 ${Math.abs(dMax)}°나 뚝 떨어져요. 몸이 어제에 맞춰져 있어서 체감은 숫자보다 더 서늘합니다. 어제와 같은 옷차림이면 확실히 부족해요.`, 2)
  else if (dMax <= -4)
    add('🧥', '어제보다 서늘', `어제보다 낮이 ${Math.abs(dMax)}° 서늘해요. 어제 입던 대로 나가면 조금 아쉬울 수 있으니 한 겹 더 얹어보세요. 따뜻한 음료 한 잔도 좋은 선택.`, 2)
  else if (dMax >= 7)
    add('🥵', '어제보다 훨씬 더움', `어제보다 ${dMax}°나 확 올라요. 어제 기준으로 입으면 덥게 느껴질 겁니다. 차 안에 뒀던 물병도 오늘은 뜨거워져요.`, 2)
  else if (dMax >= 4)
    add('🌡️', '어제보다 따뜻', `어제보다 ${dMax}° 더 따뜻해요. 어제보다 한 겹 정도는 가볍게 가도 괜찮고, 야외 일정은 한낮을 피하면 한결 낫습니다.`, 2)

  // ── 1~2순위: 미세먼지 (종합 등급)
  const air = opts.airGrade ?? null
  if (air !== null && air >= 3)
    add('😷', '미세먼지 매우 나쁨', '공기가 매우 나빠요. 바깥 활동은 줄이고, 나간다면 KF94 마스크를 챙기세요. 환기는 짧게, 창문은 닫아두는 편이 낫습니다.', 0)
  else if (air !== null && air >= 2)
    add('😷', '마스크 챙기기', '미세먼지가 나쁨이에요. 오래 걷거나 뛰는 야외 운동은 오늘은 쉬고, 외출할 땐 마스크를 챙기세요.', 1)

  // ── 4순위: 절대 기온 옷차림 (낮 최고 기준)
  const t = today.tmax
  // 체감 보정은 쾌적~쌀쌀 구간(5~31°)의 옷차림에만. 그 밖은 위험 안내라 실제 값으로 본다.
  const tc = t >= 5 && t < 31 ? t + feel : t
  const clothes = clothingTip(tc, t, rainsToday)
  if (clothes) {
    const plain = clothingTip(t, t, rainsToday)
    const note =
      plain && plain.title !== clothes.title
        ? feel < 0
          ? ' (추위를 타는 편이라 한 단계 따뜻하게 골랐어요)'
          : ' (더위를 타는 편이라 한 단계 가볍게 골랐어요)'
        : ''
    add(clothes.emoji, clothes.title, clothes.body + note, clothes.rank)
  }

  // ── 5순위: 일교차·중간 바람
  if (today.tmax - today.tmin >= 12 && today.tmax >= 20)
    add('🌅', '일교차 큼, 레이어드', `아침 ${round1(today.tmin)}°, 낮 ${round1(today.tmax)}°로 일교차가 커요. 입고 벗기 쉬운 레이어드로 나가면 하루 종일 편합니다.`, 3)
  if (wind >= 25 && wind < 40 && gust < 60)
    add('🍃', '바람막이 추천', `바람이 제법 부는 날이에요(최대 ${Math.round(wind)}km/h). 얇은 옷은 바람에 뚫리니 바람막이가 든든하고, 체감온도는 숫자보다 낮게 느껴집니다.`, 3)

  // ── 6순위: 자외선
  if (uvMax !== null) {
    if (uvMax >= 8)
      add('🧴', '선크림 필수', `자외선 지수 ${round1(uvMax)}, 매우 강해요. 선크림 필수에 한낮엔 모자나 양산까지. 야외에 오래 있다면 두세 시간마다 덧발라 주세요.`, 4)
    else if (uvMax >= 6 && !rainsToday)
      add('🕶️', '선크림 추천', '자외선이 강한 편이에요. 잠깐 나가는 길이라도 선크림을 발라두면 피부가 고마워합니다. 선글라스 쓰기 좋은 날.', 4)
  }

  // rank 오름차순으로 안정 정렬한 뒤 자른다. 예전처럼 그냥 자르면
  // 위험 기상 하나가 켜졌을 때 혹한·폭염 안내가 밖으로 밀려난다.
  return tips
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 3)
    .map(({ emoji, title, body }) => ({ emoji, title, body }))
}

/**
 * 옷차림 단계 — 단계는 tc(보정한 온도)로 고르고, 문장 속 숫자는 실제 낮 최고 t 로 쓴다.
 * (보정한 숫자를 보여주면 "낮 최고 18°" 인데 예보는 21° 인 이상한 화면이 된다)
 */
function clothingTip(
  tc: number,
  t: number,
  rainsToday: boolean,
): { emoji: string; title: string; body: string; rank: number } | null {
  const c = (emoji: string, title: string, body: string, rank: number) => ({ emoji, title, body, rank })
  if (tc >= 35)
    return c('🥵', '위험한 더위', `낮 최고 ${round1(t)}°, 위험한 더위예요. 한낮 야외활동은 최대한 피하고 물을 수시로 마시세요. 어르신과 아이는 특히 조심해야 하는 날입니다.`, 0)
  if (tc >= 33)
    return c('🔥', '폭염, 양산 추천', `낮 최고 ${round1(t)}° 폭염이에요. 통풍 잘 되는 옷에 양산이 의외로 큰 도움이 됩니다. 실내외 온도차가 크니 냉방병도 슬쩍 조심.`, 0)
  if (tc >= 31)
    return c('💧', '물 자주 마시기', `한낮이 ${round1(t)}°까지 올라 푹푹 쪄요. 목마르기 전에 물을 미리 마시고, 뙤약볕 일정은 짧게 끊어 가세요.`, 2)
  if (tc >= 28)
    return c('☀️', '반팔 + 얇은 겉옷', `낮엔 ${round1(t)}°까지 올라 반팔이 맞아요. 다만 실내 냉방이 셀 수 있으니 얇은 겉옷 하나면 완벽합니다.`, 2)
  if (tc >= 25)
    return c('😌', '반팔 날씨', rainsToday ? `낮 최고 ${round1(t)}°, 비만 아니면 반팔이 딱 좋은 온도예요. 젖어도 금방 마르는 옷이 편합니다.` : `낮 최고 ${round1(t)}°, 반팔이나 아주 얇은 긴팔이 딱 좋은 날이에요. 활동하기 좋습니다.`, 2)
  if (tc >= 21)
    return c('🍃', '가벼운 긴팔', `낮 ${round1(t)}°로 쾌적한 날씨예요. 가벼운 긴팔 하나로 충분하고, 산책이나 야외 일정 잡기 좋은 날입니다.`, 2)
  if (tc >= 17)
    return c('🍂', '긴팔 + 겉옷', `낮에도 ${round1(t)}°라 선선해요. 긴팔에 가벼운 겉옷 조합을 추천해요. 해 지면 제법 쌀쌀해집니다.`, 2)
  if (tc >= 12)
    return c('🧥', '니트·자켓', `낮 최고가 ${round1(t)}°에 그쳐요. 니트나 자켓 정도는 입어야 하는 날씨입니다. 얇게 나가면 종일 웅크리게 돼요.`, 2)
  if (tc >= 5)
    return c('🧤', '코트·패딩', `종일 추워요(낮 최고 ${round1(t)}°). 코트나 패딩을 꺼낼 때가 됐습니다. 목만 따뜻해도 체감이 확 달라져요.`, 2)
  if (tc >= 0)
    return c('⛄', '패딩 풀장착', `낮에도 ${round1(t)}°밖에 안 돼요. 두꺼운 패딩에 목도리, 장갑까지 풀장착을 추천합니다. 따뜻한 음료 텀블러도 챙기세요.`, 0)
  return c('🥶', '혹한, 핫팩', `낮 최고가 영하 ${Math.abs(round1(t))}°인 혹한이에요. 핫팩을 챙기고 피부 노출을 최소화하세요. 수도 동파도 조심할 날입니다.`, 0)
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

/** 오늘 vs 어제 한 줄 요약 (기온·강수·바람) */
export function compareSummary(today: DayStats, yesterday: DayStats): string {
  const dMax = today.tmax - yesterday.tmax
  const temp = dMax >= 2 ? '더 덥고' : dMax <= -2 ? '더 선선하고' : '기온은 비슷하고'
  const t = today.precipSum
  const y = yesterday.precipSum
  let rain: string
  if (t < 0.5 && y < 0.5) rain = (today.precipProbMax ?? 0) >= 60 ? '비 소식은 있고' : '비 소식은 없고'
  else if (t > y + 1) rain = '비는 더 오고'
  else if (t < y - 1) rain = '비는 덜 오고'
  else rain = '비는 비슷하고'
  const tw = today.windMax ?? 0
  const yw = yesterday.windMax ?? 0
  const wind = tw > yw + 8 ? '바람은 더 불어요' : tw < yw - 8 ? '바람은 더 잔잔해요' : '바람은 비슷해요'
  return `오늘은 어제보다 ${temp}, ${rain}, ${wind}.`
}
