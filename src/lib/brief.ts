// 상단 날씨 브리핑 띠의 카드 문구 — 순수 함수(테스트 대상).
// 시간·온도는 받은 데이터에서만 만든다. 값이 없으면 그 카드는 건너뛴다(지어내지 않는다).
// 시각은 모두 "선택한 지역의 현지 시각"이다: Open-Meteo 의 일출·일몰은 현지 시각 문자열
// ('YYYY-MM-DDTHH:MM')이고, 지금 현지 시각은 utc_offset_seconds 로 만든다.
import type { WeatherData } from './weather'

export type BriefImage = 'sunrise' | 'sunset' | 'warmer' | 'cooler'

export interface BriefCard {
  id: string
  image: BriefImage
  /** 짧은 한 줄 (모바일 320px 에서도 한 줄) */
  title: string
  /** 비교 기준·숫자를 밝히는 보조 한 줄 */
  sub: string
}

type Input = Pick<
  WeatherData,
  'nowTemp' | 'yesterdaySameHour' | 'today' | 'tomorrow' | 'sun' | 'utcOffsetSec' | 'week'
>

const SAME = 0.5

/** 지금 이 지역의 현지 시각 'YYYY-MM-DDTHH:MM' */
export function localNow(nowMs: number, offsetSec: number): string {
  return new Date(nowMs + offsetSec * 1000).toISOString().slice(0, 16)
}

/** 'YYYY-MM-DDTHH:MM' 두 개 사이의 분 (같은 시간대 문자열끼리) */
function minutesBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}:00Z`) - Date.parse(`${a}:00Z`)) / 60000)
}

/** '2026-10-26T17:41' → '오후 5:41' */
export function clockKo(iso: string): string {
  const h = Number(iso.slice(11, 13))
  const m = iso.slice(14, 16)
  const ampm = h < 12 ? '오전' : '오후'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${ampm} ${h12}:${m}`
}

/** 남은·지난 시간 '2시간 10분' / '35분' (5분 단위) */
function span(min: number): string {
  const m = Math.max(5, Math.round(Math.abs(min) / 5) * 5)
  if (m < 60) return `${m}분`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h}시간 ${r}분` : `${h}시간`
}

const deg = (d: number) => `${Math.abs(Math.round(d * 10) / 10).toFixed(1)}°`
const fmt = (t: number) => `${Math.round(t)}°`

export function buildBriefs(wx: Input, nowMs: number, deviceOffsetSec: number): BriefCard[] {
  const cards: BriefCard[] = []
  // 옛 캐시에는 오프셋이 없다 → 기기 시간대로 대신한다(국내 사용자는 같다)
  const offset = typeof wx.utcOffsetSec === 'number' ? wx.utcOffsetSec : deviceOffsetSec
  const now = localNow(nowMs, offset)
  const today = now.slice(0, 10)
  // 자정을 넘긴 오래된 캐시면 "오늘·내일"이 하루씩 어긋난다 → 날짜에 기대는 카드는 뺀다
  const dataToday = wx.week?.[0]?.date ?? wx.sun?.rise.slice(0, 10)
  const sameDay = dataToday === today

  // 1) 지금 vs 어제 같은 시각
  if (Number.isFinite(wx.nowTemp) && Number.isFinite(wx.yesterdaySameHour)) {
    const d = wx.nowTemp - wx.yesterdaySameHour
    const sub = `지금 ${wx.nowTemp.toFixed(1)}° · 어제 이맘때 ${wx.yesterdaySameHour.toFixed(1)}°`
    cards.push(
      Math.abs(d) < SAME
        ? { id: 'now', image: 'warmer', title: '어제 이맘때와 비슷해요', sub }
        : {
            id: 'now',
            image: d > 0 ? 'warmer' : 'cooler',
            title: `어제보다 ${deg(d)} ${d > 0 ? '따뜻해요' : '쌀쌀해요'}`,
            sub,
          },
    )
  }

  // 2) 내일 낮 vs 오늘 낮 (낮 최고끼리, 아침은 차이가 클 때만 덧붙인다)
  if (sameDay && Number.isFinite(wx.tomorrow?.tmax) && Number.isFinite(wx.today?.tmax)) {
    const d = wx.tomorrow.tmax - wx.today.tmax
    const dMin = wx.tomorrow.tmin - wx.today.tmin
    // 기호(▲▼→) 대신 말로. 아침 차이가 크면 그게 더 쓸모 있는 정보라 그걸 말한다 (320px 한 줄)
    const sub =
      Number.isFinite(dMin) && Math.abs(dMin) >= 3
        ? `아침은 ${deg(dMin)} 더 ${dMin > 0 ? '포근해요' : '추워요'}`
        : `낮 최고 ${fmt(wx.tomorrow.tmax)} · 아침 최저 ${fmt(wx.tomorrow.tmin)}`
    cards.push(
      Math.abs(d) < SAME
        ? { id: 'tomorrow', image: 'warmer', title: '내일 낮은 오늘과 비슷해요', sub }
        : {
            id: 'tomorrow',
            image: d > 0 ? 'warmer' : 'cooler',
            title: `내일 낮은 ${deg(d)} ${d > 0 ? '따뜻해요' : '쌀쌀해요'}`,
            sub,
          },
    )
  }

  // 3) 일몰 — 아직이면 남은 시간, 지났으면 과거형 + 내일 일몰
  const sun = wx.sun
  if (sameDay && sun?.set) {
    const left = minutesBetween(now, sun.set)
    if (left > 0) {
      cards.push({ id: 'sunset', image: 'sunset', title: `오늘 해는 ${clockKo(sun.set)}에 져요`, sub: `일몰까지 ${span(left)} 남았어요` })
    } else {
      cards.push({
        id: 'sunset',
        image: 'sunset',
        title: `오늘 해는 ${clockKo(sun.set)}에 졌어요`,
        sub: sun.setTomorrow ? `내일은 ${clockKo(sun.setTomorrow)}에 져요` : `해 진 지 ${span(left)} 지났어요`,
      })
    }
  }

  // 4) 일출 — 오늘 해가 아직 안 떴으면 오늘, 아니면 내일
  if (sameDay && sun?.rise) {
    const untilToday = minutesBetween(now, sun.rise)
    if (untilToday > 0) {
      cards.push({ id: 'sunrise', image: 'sunrise', title: `오늘 해는 ${clockKo(sun.rise)}에 떠요`, sub: `일출까지 ${span(untilToday)} 남았어요` })
    } else if (sun.riseTomorrow) {
      cards.push({
        id: 'sunrise',
        image: 'sunrise',
        title: `내일 해는 ${clockKo(sun.riseTomorrow)}에 떠요`,
        sub: `지금부터 ${span(minutesBetween(now, sun.riseTomorrow))} 뒤`,
      })
    }
  }

  return cards
}
