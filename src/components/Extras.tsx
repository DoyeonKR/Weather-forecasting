// 메인·비교 카드에 붙는 작은 조각들 — 미세먼지 줄, 체감 질문, 출퇴근 비교, 평년 비교, 특보 배너
import { useEffect, useState } from 'react'
import { PersonSimpleWalk, SunHorizon, Warning } from '@phosphor-icons/react'
import { uvLabel } from '../lib/uv'
import { GRADE_LABEL, gradePm10, gradePm25, type AirNow } from '../lib/air'
import { codeLabel } from '../lib/compare'
import { commuteSlots, type CommutePrefs } from '../lib/commute'
import { feelLabel, rememberClothes, yesterdayClothes, type FeelVote } from '../lib/feel'
import type { Normal } from '../lib/normals'
import type { WarnHit } from '../lib/warn'
import type { WeatherData } from '../lib/weather'
import { weatherIcon, weatherTone } from '../lib/weatherIcon'

/** 차이 한 마디: ▲3° / ▼2° / 비슷 */
function Diff({ d, unit = '°' }: { d: number; unit?: string }) {
  const r = Math.round(d)
  if (r === 0) return <b className="range-diff same">비슷</b>
  return <b className={`range-diff ${r > 0 ? 'warm' : 'cold'}`}>{r > 0 ? `▲${r}${unit}` : `▼${-r}${unit}`}</b>
}

// ── 일출·일몰·자외선 ─────────────────────────────────
/** 'YYYY-MM-DDTHH:MM' → 'HH:MM' (해당 지역 현지 시각이라 기기 시간대와 무관하게 그대로 자른다) */
const hm = (iso: string) => iso.slice(11, 16)

/** 예전에 저장된 캐시에는 sun 이 없을 수 있다 → 없으면 있는 것만 보여주고, 다 없으면 통째로 숨긴다 */
export function SunRow({ sun, uv }: { sun?: { rise: string; set: string }; uv: number | null }) {
  if (!sun && uv === null) return null
  return (
    <div className="sun-row">
      {sun && (
        <>
          <span>
            <SunHorizon size={16} weight="duotone" className="wi-sun" aria-hidden /> 일출 <b>{hm(sun.rise)}</b>
          </span>
          <span>
            <SunHorizon size={16} weight="duotone" className="wi-rain" aria-hidden /> 일몰 <b>{hm(sun.set)}</b>
          </span>
        </>
      )}
      {uv !== null && (
        <span>
          자외선 <b>{Math.round(uv)}</b> <small>({uvLabel(Math.round(uv))}, 오늘 최고)</small>
        </span>
      )}
    </div>
  )
}

// ── 미세먼지 ─────────────────────────────────────────
export function AirRow({ air }: { air: AirNow }) {
  // 어제 같은 시각과 비교: 등급이 바뀌었으면 등급으로, 아니면 초미세먼지 5㎍ 이상 차이로
  let cmp: 'better' | 'worse' | 'same' | null = null
  if (air.gradeYest !== null && air.pm25Yest !== null) {
    if (air.grade !== air.gradeYest) cmp = air.grade < air.gradeYest ? 'better' : 'worse'
    else if (Math.abs(air.pm25 - air.pm25Yest) >= 5) cmp = air.pm25 < air.pm25Yest ? 'better' : 'worse'
    else cmp = 'same'
  }
  return (
    <div className="air-row">
      <span className={`air-dot g${air.grade}`} aria-hidden />
      <span>
        미세먼지 <b className={`air-g g${gradePm10(air.pm10)}`}>{GRADE_LABEL[gradePm10(air.pm10)]}</b>{' '}
        <small>{air.pm10}</small>
      </span>
      <span>
        초미세 <b className={`air-g g${gradePm25(air.pm25)}`}>{GRADE_LABEL[gradePm25(air.pm25)]}</b>{' '}
        <small>{air.pm25}</small>
      </span>
      {cmp && (
        <span className={`air-cmp ${cmp}`}>
          어제 이맘때보다 {cmp === 'better' ? '맑아요' : cmp === 'worse' ? '탁해요' : '비슷해요'}
        </span>
      )}
      <small className="air-src">
        {air.source?.kind === 'airkorea' ? `${air.source.station} 측정소` : '예측 모델'}
      </small>
      {air.worse && (
        <span className="air-cmp worse">
          {air.worse.nextDay ? '내일 ' : ''}
          {air.worse.hour}시쯤 {GRADE_LABEL[air.worse.grade]} 예상
        </span>
      )}
    </div>
  )
}

// ── 어제 어땠어요? ───────────────────────────────────
/** 받침이 있으면 '이었어요.', 없으면 '였어요.' */
function eottae(word: string) {
  const c = word.charCodeAt(word.length - 1) - 0xac00
  return c >= 0 && c < 11172 && c % 28 === 0 ? '였어요.' : '이었어요.'
}
export function FeelAsk({
  answered,
  offset,
  onVote,
  todayClothes,
}: {
  answered: boolean
  offset: number
  onVote: (v: FeelVote) => void
  /** 오늘 보여준 옷차림 멘트 제목 — 내일 질문에 쓰려고 남긴다 */
  todayClothes: string | null
}) {
  const [justVoted, setJustVoted] = useState(false)
  const [yesterday] = useState(yesterdayClothes)
  useEffect(() => {
    if (todayClothes) rememberClothes(todayClothes)
  }, [todayClothes])
  if (answered && !justVoted) return null
  if (justVoted) {
    return (
      <p className="feel-done" role="status">
        고마워요! 옷차림에 반영했어요 · {feelLabel(offset) ?? '지금 기준이 딱 맞는 편'}
      </p>
    )
  }
  const vote = (v: FeelVote) => {
    setJustVoted(true)
    onVote(v)
  }
  return (
    <div className="feel-ask">
      <span className="feel-q">
        {yesterday ? `어제 추천은 '${yesterday}'${eottae(yesterday)} 그렇게 입었다면 어땠어요?` : '어제 날씨, 입은 옷에 비해 어땠어요?'}
      </span>
      <div className="feel-btns">
        <button type="button" onClick={() => vote('cold')}>
          추웠어요
        </button>
        <button type="button" onClick={() => vote('ok')}>
          딱 좋았어요
        </button>
        <button type="button" onClick={() => vote('hot')}>
          더웠어요
        </button>
      </div>
    </div>
  )
}

// ── 출퇴근길 ─────────────────────────────────────────
export function CommuteCompare({ wx, prefs }: { wx: WeatherData; prefs: CommutePrefs }) {
  if (!prefs.on) return null
  const slots = commuteSlots(wx, prefs)
  if (slots.length === 0) return null
  return (
    <div className="cmp-sec">
      <h3 className="cmp-title">
        <PersonSimpleWalk size={16} weight="duotone" className="wind-icon" aria-hidden /> 출퇴근길
      </h3>
      <ul className="commute-list">
        {slots.map((s) => {
          const label = codeLabel(s.code).label
          const Icon = weatherIcon(label, s.hour >= 6 && s.hour < 19)
          return (
            <li key={`${s.day}${s.kind}`}>
              <span className="commute-when">
                {s.day} {s.kind} <small>{s.hour}시</small>
              </span>
              <Icon size={22} weight="duotone" className={`wi-${weatherTone(label)}`} aria-hidden />
              <strong className="commute-temp">{Math.round(s.temp)}°</strong>
              <span className="commute-diff">
                하루 전보다 <Diff d={s.temp - s.prev} />
              </span>
              {s.precip > 0 && <span className="commute-rain">{s.precip < 1 ? s.precip.toFixed(1) : Math.round(s.precip)}mm</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ── 평년(최근 10년) ─────────────────────────────────
export function NormalLine({ normal, today }: { normal: Normal; today: { tmax: number; tmin: number } }) {
  return (
    <p className="range-summary normal-line">
      최근 {normal.years}년 이맘때 평균(낮 {normal.tmax.toFixed(1)}° · 아침 {normal.tmin.toFixed(1)}°)보다 낮{' '}
      <Diff d={today.tmax - normal.tmax} /> · 아침 <Diff d={today.tmin - normal.tmin} />
    </p>
  )
}

// ── 기상특보 ─────────────────────────────────────────
export function WarnBanner({ hits }: { hits: WarnHit[] }) {
  if (hits.length === 0) return null
  const severe = hits.some((h) => h.kind.endsWith('경보'))
  return (
    <div className={`warn-banner ${severe ? 'severe' : ''}`} role="status">
      <Warning size={18} weight="fill" aria-hidden />
      <span>
        <b>{hits.map((h) => h.kind).join(' · ')}</b> 발효 중
        <small> ({hits[0].area})</small>
      </span>
      <a href="https://www.weather.go.kr/w/special-report/overall.do" target="_blank" rel="noreferrer">
        기상청
      </a>
    </div>
  )
}
