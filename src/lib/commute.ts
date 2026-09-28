// 출퇴근 시각 — 설정에서 고른 두 시각을 "하루 전 같은 시각"과 비교한다.
import type { WeatherData } from './weather'

export interface CommutePrefs {
  on: boolean
  /** 0~23 */
  am: number
  pm: number
}

const KEY = 'eojeboda.commute.v1'
export const DEFAULT_COMMUTE: CommutePrefs = { on: true, am: 8, pm: 18 }

export function loadCommute(): CommutePrefs {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    const ok = (h: unknown) => typeof h === 'number' && Number.isInteger(h) && h >= 0 && h <= 23
    if (v && typeof v.on === 'boolean' && ok(v.am) && ok(v.pm)) return v
  } catch {
    // 무시
  }
  return { ...DEFAULT_COMMUTE }
}

export function saveCommute(p: CommutePrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    // 무시
  }
}

export interface CommuteSlot {
  kind: '출근' | '퇴근'
  /** '오늘' 또는 '내일' */
  day: '오늘' | '내일'
  hour: number
  temp: number
  /** 하루 전 같은 시각 */
  prev: number
  precip: number
  code: number
}

/**
 * 다가오는 출근·퇴근 시각 (순수 함수 — 테스트 대상).
 * 이미 지난 시각이면 내일 것을 보여준다. 시간별 배열은 어제 0시부터(인덱스 0~23 어제).
 */
export function commuteSlots(wx: Pick<WeatherData, 'hourly' | 'nowHourLocal' | 'nowCode'>, p: CommutePrefs): CommuteSlot[] {
  const out: CommuteSlot[] = []
  const pairs: [CommuteSlot['kind'], number][] = [
    ['출근', p.am],
    ['퇴근', p.pm],
  ]
  for (const [kind, hour] of pairs) {
    const today = hour > wx.nowHourLocal
    const i = (today ? 24 : 48) + hour
    const t = wx.hourly.temp[i]
    const prev = wx.hourly.temp[i - 24]
    if (typeof t !== 'number' || typeof prev !== 'number') continue
    out.push({
      kind,
      day: today ? '오늘' : '내일',
      hour,
      temp: t,
      prev,
      precip: wx.hourly.precip[i] ?? 0,
      code: wx.hourly.code?.[i] ?? wx.nowCode,
    })
  }
  // 시간순 (내일 출근이 오늘 퇴근보다 뒤)
  return out.sort((a, b) => (a.day === b.day ? a.hour - b.hour : a.day === '오늘' ? -1 : 1))
}
