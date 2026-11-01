// 메인 카드의 요약 8칸 — 아래 섹션을 한 칸씩 대표한다. 누르면 그 섹션으로 내려간다.
// 칸은 좁으니 값은 다섯 글자 안팎으로. 순수 함수(테스트 가능).
import { isSnowCode, round1, type DayStats } from './compare'
import { localNow } from './brief'
import { weekImpact, type ImpactTone } from './impact'
import type { Glance } from './glance'
import type { WeatherData } from './weather'

export type SummaryTarget = 'hourly' | 'prep' | 'air' | 'compare' | 'tomorrow' | 'week' | 'sun' | 'radar'

export interface SummaryTile {
  target: SummaryTarget
  label: string
  value: string
  tone: ImpactTone
  /** 내려갈 섹션 이름 (스크린 리더용) */
  section: string
}

const pick = (g: Glance, key: 'umbrella' | 'outfit' | 'air') => g.tiles.find((t) => t.key === key)

/** 지금 vs 어제 같은 시각 */
function compareTile(delta: number): Pick<SummaryTile, 'value' | 'tone'> {
  const d = round1(delta)
  if (Math.abs(d) < 0.5) return { value: '비슷해요', tone: 'ok' }
  return { value: `${Math.round(Math.abs(d))}° ${d > 0 ? '따뜻해요' : '추워요'}`, tone: d > 0 ? 'warm' : 'cold' }
}

/** 내일: 낮 최고. 비·눈이면 파랑 */
function tomorrowTone(t: DayStats): ImpactTone {
  return (t.precipProbMax ?? 0) >= 60 || t.precipSum >= 1 || isSnowCode(t.code) ? 'rain' : 'ok'
}

/** 다음 해 뜨는/지는 시각 (24시간제, 칸이 좁다) */
function sunTile(wx: Pick<WeatherData, 'sun' | 'utcOffsetSec'>, nowMs: number, deviceOffsetSec: number) {
  const sun = wx.sun
  if (!sun) return null
  const now = localNow(nowMs, wx.utcOffsetSec ?? deviceOffsetSec)
  const hm = (iso: string) => iso.slice(11, 16)
  if (now < sun.rise) return { label: '일출', value: hm(sun.rise) }
  if (now < sun.set) return { label: '일몰', value: hm(sun.set) }
  if (sun.riseTomorrow) return { label: '내일 일출', value: hm(sun.riseTomorrow) }
  return { label: '일몰', value: hm(sun.set) }
}

export function buildSummary(opts: {
  glance: Glance
  forTomorrow: boolean
  wx: Pick<WeatherData, 'nowTemp' | 'yesterdaySameHour' | 'tomorrow' | 'week' | 'sun' | 'utcOffsetSec'>
  /** 기상청 실황이 지금 비라고 하는지 (모르면 null) */
  raining: boolean | null
  nowMs: number
  deviceOffsetSec: number
}): SummaryTile[] {
  const { glance, forTomorrow, wx, raining, nowMs, deviceOffsetSec } = opts
  const prefix = forTomorrow ? '내일 ' : ''
  const umbrella = pick(glance, 'umbrella')
  const outfit = pick(glance, 'outfit')
  const air = pick(glance, 'air')
  const week = weekImpact(wx.week)
  const sun = sunTile(wx, nowMs, deviceOffsetSec)
  return [
    { target: 'hourly', section: '시간대별 기온과 강수', label: `${prefix}우산`, value: umbrella?.value ?? '-', tone: umbrella?.tone ?? 'ok' },
    { target: 'prep', section: '준비물', label: `${prefix}옷차림`, value: outfit?.value ?? '-', tone: outfit?.tone ?? 'ok' },
    { target: 'air', section: '미세먼지', label: '미세먼지', value: air?.value ?? '-', tone: air?.tone ?? 'ok' },
    { target: 'compare', section: '어제와 비교', label: '어제보다', ...compareTile(wx.nowTemp - wx.yesterdaySameHour) },
    { target: 'tomorrow', section: '내일 날씨', label: '내일 낮', value: `${Math.round(wx.tomorrow.tmax)}°`, tone: tomorrowTone(wx.tomorrow) },
    {
      target: 'week',
      section: '이번 주 날씨',
      label: '이번 주',
      value: week ? (week.tone === 'rain' ? week.value.replace('요일', '') : '비 없음') : '-',
      tone: week?.tone ?? 'ok',
    },
    { target: 'sun', section: '해와 자외선', label: sun?.label ?? '해', value: sun?.value ?? '-', tone: 'ok' },
    { target: 'radar', section: '비구름 레이더', label: '비구름', value: raining ? '비 와요' : '지도 보기', tone: raining ? 'rain' : 'ok' },
  ]
}
