// 메인 아래 요약 카드 — 카드마다 "큰 값 하나 + 짧은 한 줄"만. 자세한 내용은 눌러서 시트로 본다.
// 순수 함수(테스트 가능).
import { codeLabel, isSnowCode, round1, type DayStats } from './compare'
import { clockKo, localNow } from './brief'
import type { WeatherData } from './weather'

export type ImpactTone = 'ok' | 'info' | 'rain' | 'warn' | 'alert' | 'warm' | 'cold'

export interface Impact {
  value: string
  sub: string
  tone: ImpactTone
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** 앞으로 12시간: 비가 오면 언제부터, 아니면 가장 따뜻한 시각 */
export function hourlyImpact(wx: Pick<WeatherData, 'hourly' | 'nowHourLocal'>): Impact | null {
  const { temp, precip, code, prob } = wx.hourly
  const start = 24 + wx.nowHourLocal + 1
  const end = Math.min(start + 12, temp.length)
  if (start >= end) return null
  for (let i = start; i < end; i++) {
    const p = prob?.[i] ?? null
    if ((p ?? 0) >= 50 || (precip[i] ?? 0) >= 0.5) {
      const h = i % 24
      const snow = isSnowCode(code[i])
      return {
        value: `${h}시부터 ${snow ? '눈' : '비'}`,
        sub: p !== null ? `강수확률 ${p}%` : `${round1(precip[i])}mm`,
        tone: 'rain',
      }
    }
  }
  let hi = start
  let lo = start
  for (let i = start; i < end; i++) {
    if (temp[i] > temp[hi]) hi = i
    if (temp[i] < temp[lo]) lo = i
  }
  return {
    value: `${Math.round(temp[lo])}° ~ ${Math.round(temp[hi])}°`,
    sub: `12시간 안에 비 없음 · ${hi % 24}시 가장 따뜻`,
    tone: 'ok',
  }
}

/** 오늘 vs 어제 낮 최고 */
export function compareImpact(today: DayStats, yesterday: DayStats): Impact {
  const d = round1(today.tmax - yesterday.tmax)
  if (Math.abs(d) < 0.5) return { value: '비슷해요', sub: `낮 최고 ${Math.round(today.tmax)}° · 어제와 같아요`, tone: 'ok' }
  return {
    value: `${d > 0 ? '▲' : '▼'}${Math.abs(d)}°`,
    sub: `낮 최고가 어제보다 ${d > 0 ? '높아요' : '낮아요'}`,
    tone: d > 0 ? 'warm' : 'cold',
  }
}

/** 내일 낮 최고와 오늘 대비, 주의할 게 있으면 그걸 먼저 */
export function tomorrowImpact(tomorrow: DayStats, today: DayStats, alerts: string[]): Impact {
  const d = round1(tomorrow.tmax - today.tmax)
  const label = codeLabel(tomorrow.code).label
  if (alerts.length > 0) return { value: `${Math.round(tomorrow.tmax)}° ${label}`, sub: alerts[0], tone: 'warn' }
  return {
    value: `${Math.round(tomorrow.tmax)}° ${label}`,
    sub: Math.abs(d) < 0.5 ? '오늘과 비슷해요' : `오늘보다 ${Math.abs(d)}° ${d > 0 ? '높아요' : '낮아요'}`,
    tone: Math.abs(d) < 0.5 ? 'ok' : d > 0 ? 'warm' : 'cold',
  }
}

/** 이번 주: 다음 비(눈) 오는 날, 없으면 주간 기온 폭 */
export function weekImpact(week: WeatherData['week']): Impact | null {
  if (week.length < 2) return null
  for (let i = 1; i < week.length; i++) {
    const s = week[i].stats
    if ((s.precipProbMax ?? 0) >= 50 || s.precipSum >= 1) {
      const day = i === 1 ? '내일' : `${WEEKDAYS[new Date(`${week[i].date}T00:00:00`).getDay()]}요일`
      return {
        value: `${day} ${isSnowCode(s.code) ? '눈' : '비'}`,
        sub: s.precipProbMax !== null ? `강수확률 ${s.precipProbMax}%` : `${round1(s.precipSum)}mm`,
        tone: 'rain',
      }
    }
  }
  const lo = Math.min(...week.map((d) => d.stats.tmin))
  const hi = Math.max(...week.map((d) => d.stats.tmax))
  return { value: '비 소식 없음', sub: `이번 주 ${Math.round(lo)}° ~ ${Math.round(hi)}°`, tone: 'ok' }
}

/** 다음 해 뜨고 지는 시각 */
export function sunImpact(
  wx: Pick<WeatherData, 'sun' | 'utcOffsetSec' | 'uvMaxToday'>,
  nowMs: number,
  deviceOffsetSec: number,
): Impact | null {
  const sun = wx.sun
  if (!sun) return null
  const now = localNow(nowMs, wx.utcOffsetSec ?? deviceOffsetSec)
  const uv = wx.uvMaxToday
  const uvText = uv !== null && uv !== undefined ? ` · 자외선 ${Math.round(uv)}` : ''
  if (now < sun.rise) return { value: clockKo(sun.rise), sub: `일출${uvText}`, tone: 'ok' }
  if (now < sun.set) return { value: clockKo(sun.set), sub: `일몰${uvText}`, tone: (uv ?? 0) >= 6 ? 'warn' : 'ok' }
  if (sun.riseTomorrow) return { value: clockKo(sun.riseTomorrow), sub: '내일 일출', tone: 'ok' }
  return { value: clockKo(sun.set), sub: '오늘 일몰', tone: 'ok' }
}
