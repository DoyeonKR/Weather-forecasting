// 첫 화면 "한눈에" 판정 — 날씨 앱을 여는 세 가지 질문(우산? 옷? 마스크?)에 바로 답한다.
// 순수 함수(테스트 가능). 옷차림 온도 구간은 실용 팁(funTips 의 clothingTip)과 같게 맞춘다.
import { isSnowCode, round1, type DayStats } from './compare'

/** ok: 신경 안 써도 됨(회색) · info: 참고 · rain: 비 · warn: 주의 · alert: 위험 */
export type GlanceTone = 'ok' | 'info' | 'rain' | 'warn' | 'alert'

export interface GlanceTile {
  key: 'umbrella' | 'outfit' | 'air'
  label: string
  value: string
  sub: string
  tone: GlanceTone
}

export interface Glance {
  headline: string
  tiles: GlanceTile[]
}

/** 옷 이름만 (clothingTip 과 같은 구간) */
function wear(tc: number): string {
  if (tc >= 28) return '반팔'
  if (tc >= 25) return '반팔·얇은 긴팔'
  if (tc >= 21) return '가벼운 긴팔'
  if (tc >= 17) return '긴팔 + 겉옷'
  if (tc >= 12) return '니트·자켓'
  if (tc >= 5) return '코트·패딩'
  if (tc >= 0) return '두꺼운 패딩'
  return '패딩 + 핫팩'
}

const AIR_VALUE = ['좋음', '보통', '나쁨', '매우 나쁨'] as const

export function buildGlance(opts: {
  /** 판정할 날 — 낮에는 오늘 남은 시간, 밤(내일의 준비)에는 내일 */
  day: DayStats
  forTomorrow?: boolean
  /** 대기질 종합 등급 0~3, 모르면 null */
  airGrade: number | null
  feelOffset?: number
}): Glance {
  const { day, forTomorrow = false, airGrade } = opts
  const when = forTomorrow ? '내일' : '오늘'
  const feel = Math.max(-4, Math.min(4, opts.feelOffset ?? 0))
  const prob = day.precipProbMax
  const sum = day.precipSum ?? 0
  const snow = isSnowCode(day.code) || [56, 57, 66, 67].includes(day.code)
  const rainy = (prob ?? 0) >= 60 || sum >= 1
  const maybe = !rainy && ((prob ?? 0) >= 30 || sum >= 0.3)

  // 우산
  const probText = prob === null ? `강수 ${round1(sum)}mm` : `강수 ${prob}%`
  const umbrella: GlanceTile = snow
    ? { key: 'umbrella', label: '우산', value: '눈 대비', sub: '미끄럼 조심', tone: 'warn' }
    : rainy
      ? { key: 'umbrella', label: '우산', value: '꼭 챙기기', sub: probText, tone: 'rain' }
      : maybe
        ? { key: 'umbrella', label: '우산', value: '작은 우산', sub: probText, tone: 'info' }
        : { key: 'umbrella', label: '우산', value: '필요 없음', sub: probText, tone: 'ok' }

  // 옷차림 — 낮 최고 기준, 내 체감 보정은 옷 단계에만 (funTips 와 같은 규칙)
  const t = day.tmax
  const tc = t >= 5 && t < 31 ? t + feel : t
  const hot = t >= 33
  const cold = t < 0
  const clothes = wear(tc)
  const outfit: GlanceTile = {
    key: 'outfit',
    label: '옷차림',
    value: clothes,
    sub: `${Math.round(day.tmin)}° ~ ${Math.round(day.tmax)}°`,
    tone: hot || cold ? 'alert' : 'info',
  }

  // 미세먼지 — 내일 예보는 아직 없어서 밤에도 지금 등급을 보여준다
  const g = airGrade === null || airGrade === undefined ? null : Math.max(0, Math.min(3, Math.round(airGrade)))
  const air: GlanceTile =
    g === null
      ? { key: 'air', label: '미세먼지', value: '정보 없음', sub: '', tone: 'ok' }
      : {
          key: 'air',
          label: '미세먼지',
          value: AIR_VALUE[g],
          sub: g >= 2 ? '마스크 챙기기' : '',
          tone: g === 3 ? 'alert' : g === 2 ? 'warn' : 'ok',
        }

  // 한 줄 결론 — 가장 급한 것 하나만
  let headline: string
  if (snow) headline = `${when} 눈 소식, 미끄럼 조심하세요`
  else if (rainy) headline = `${when} 비 소식, 우산 꼭 챙기세요`
  else if (hot) headline = `${when}은 폭염, 한낮 외출을 줄이세요`
  else if (cold) headline = `${when}은 영하권, ${clothes} 단단히`
  else if (g !== null && g >= 2) headline = `공기가 나빠요, 마스크 챙기세요`
  else if (maybe) headline = `${when}은 ${clothes}에 작은 우산 하나`
  else headline = `${when}은 ${clothes} 차림이면 돼요`

  return { headline, tiles: [umbrella, outfit, air] }
}
