// 메인·비교 카드에 붙는 작은 조각들 — 미세먼지 줄, 체감 질문, 출퇴근 비교, 평년 비교, 특보 배너
import { useEffect, useState } from 'react'
import { DeviceMobile, PersonSimpleWalk, SunHorizon, Warning, X } from '@phosphor-icons/react'
import { detectInApp, openInBrowser } from '../lib/inapp'
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

// ── 앱 안 브라우저 안내 ───────────────────────────────
const INAPP_KEY = 'eojeboda.inapp.dismissed'
const INAPP_QUIET_MS = 3 * 24 * 3600 * 1000

function inAppDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(INAPP_KEY))
    return Number.isFinite(at) && at > 0 && Date.now() - at < INAPP_QUIET_MS
  } catch {
    return false
  }
}

/**
 * 카카오톡·네이버 등의 앱 안 브라우저에서는 알림·홈 화면 설치·위치가 잘 안 된다.
 * 공유 링크로 처음 들어온 사람이 대부분 여기라서, 한 줄로 알리고 기본 브라우저로 넘기는 길을 준다.
 * 닫으면 3일 동안 조용히 있는다.
 */
export function InAppBanner() {
  const [info] = useState(() => detectInApp())
  const [hidden, setHidden] = useState(inAppDismissed)
  const [manual, setManual] = useState(false)
  if (!info || hidden) return null
  const close = () => {
    try {
      localStorage.setItem(INAPP_KEY, String(Date.now()))
    } catch {
      // 저장이 막혀도 이번 화면에서는 닫힌다
    }
    setHidden(true)
  }
  return (
    <div className="inapp-note" role="region" aria-label="브라우저 안내">
      <DeviceMobile size={20} weight="duotone" aria-hidden />
      <div className="inapp-text">
        <b>{info.name} 안에서 보고 계세요</b>
        <small>
          {manual
            ? '화면 오른쪽 위·아래의 ⋯ 메뉴에서 「Safari로 열기」를 눌러주세요'
            : '알림·내 위치는 기본 브라우저에서 더 잘 돼요'}
        </small>
      </div>
      {!manual && (
        <button
          type="button"
          className="inapp-open"
          onClick={() => {
            // 열 방법이 없는 환경(아이폰의 네이버·인스타그램 등)은 메뉴 안내로
            if (!openInBrowser(info)) setManual(true)
          }}
        >
          브라우저로 열기
        </button>
      )}
      <button type="button" className="inapp-x" aria-label="안내 닫기" onClick={close}>
        <X size={16} weight="bold" aria-hidden />
      </button>
    </div>
  )
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

// ── 미세먼지 카드 ─────────────────────────────────────
/** 등급별 행동 안내 — 숫자보다 "그래서 뭘 하면 되는지"를 먼저 */
const AIR_ADVICE = [
  '공기가 깨끗해요. 창문 열고 환기하기 좋은 날이에요.',
  '평소처럼 지내도 괜찮아요. 호흡기가 예민하다면 오래 걷는 운동만 조금 줄이세요.',
  '외출할 땐 마스크(KF80 이상)를 챙기고, 환기는 짧게만 하세요.',
  '바깥 활동은 줄이고 KF94 마스크를 쓰세요. 창문은 닫아 두는 게 좋아요.',
] as const

/** 환경부 등급 경계 — 막대는 등급마다 같은 폭으로 나눠, 값이 어느 칸에 있는지 한눈에 */
const PM10_CUTS = [0, 30, 80, 150, 200]
const PM25_CUTS = [0, 15, 35, 75, 100]

function gaugePos(v: number, cuts: number[]): number {
  for (let g = 0; g < 4; g++) {
    if (v <= cuts[g + 1] || g === 3) {
      const t = Math.min(1, Math.max(0, (v - cuts[g]) / (cuts[g + 1] - cuts[g])))
      return (g + t) * 25
    }
  }
  return 100
}

function AirGauge({ name, unit, value, cuts, grade }: { name: string; unit: string; value: number; cuts: number[]; grade: number }) {
  const pos = gaugePos(value, cuts)
  return (
    <div className="air-gauge" role="img" aria-label={`${name} ${value}${unit}, ${GRADE_LABEL[grade]}`}>
      <div className="air-gauge-head" aria-hidden>
        <span>{name}</span>
        <b className={`air-g g${grade}`}>
          {GRADE_LABEL[grade]} <span className="air-num">{value}</span>
          <small>{unit}</small>
        </b>
      </div>
      <div className="air-gauge-bar" aria-hidden>
        <i className="g0" />
        <i className="g1" />
        <i className="g2" />
        <i className="g3" />
        <span className="air-gauge-mark" style={{ left: `${Math.min(pos, 99)}%` }} />
      </div>
      <div className="air-gauge-cuts" aria-hidden>
        {cuts.slice(1, 4).map((c, k) => (
          <span key={c} style={{ left: `${(k + 1) * 25}%` }}>
            {c}
          </span>
        ))}
      </div>
    </div>
  )
}

export function AirCard({ air }: { air: AirNow }) {
  // 어제 같은 시각과 비교: 등급이 바뀌었으면 등급으로, 아니면 초미세먼지 5㎍ 이상 차이로
  let cmp: 'better' | 'worse' | 'same' | null = null
  if (air.gradeYest !== null && air.pm25Yest !== null) {
    if (air.grade !== air.gradeYest) cmp = air.grade < air.gradeYest ? 'better' : 'worse'
    else if (Math.abs(air.pm25 - air.pm25Yest) >= 5) cmp = air.pm25 < air.pm25Yest ? 'better' : 'worse'
    else cmp = 'same'
  }
  const g10 = gradePm10(air.pm10)
  const g25 = gradePm25(air.pm25)
  return (
    <section className="card air-card">
      <div className="air-card-head">
        <h2 className="section-title">미세먼지</h2>
        <small className="air-src">
          {air.source?.kind === 'airkorea' ? `${air.source.station} 측정소 · 실측` : '예측 모델 값'}
        </small>
      </div>

      {/* 결론 한 줄: 종합 등급 + 할 일 */}
      <div className={`air-verdict g${air.grade}`}>
        <span className="air-verdict-grade">{GRADE_LABEL[air.grade]}</span>
        <p>{AIR_ADVICE[air.grade]}</p>
      </div>

      <AirGauge name="미세먼지 PM10" unit="㎍/㎥" value={air.pm10} cuts={PM10_CUTS} grade={g10} />
      <AirGauge name="초미세먼지 PM2.5" unit="㎍/㎥" value={air.pm25} cuts={PM25_CUTS} grade={g25} />

      {(cmp || air.worse) && (
        <div className="air-notes">
          {cmp && (
            <span className={`air-cmp ${cmp}`}>
              {cmp === 'same' ? '어제 이맘때와 비슷해요' : `어제 이맘때보다 ${cmp === 'better' ? '맑아요' : '탁해요'}`}
              {air.pm25Yest !== null && <small> (초미세 어제 {air.pm25Yest} → 지금 {air.pm25})</small>}
            </span>
          )}
          {air.worse && (
            <span className="air-cmp worse">
              {air.worse.nextDay ? '내일 ' : ''}
              {air.worse.hour}시쯤 {GRADE_LABEL[air.worse.grade]} 예상
            </span>
          )}
        </div>
      )}

      {air.outlook && air.outlook.length > 0 && (
        <div className="air-outlook">
          <span className="air-outlook-title">앞으로 12시간</span>
          <ol>
            {air.outlook.map((o) => (
              <li key={`${o.nextDay}-${o.hour}`} className={`g${o.grade}`}>
                <span>{o.hour}시</span>
                <i aria-hidden />
                <b>{GRADE_LABEL[o.grade]}</b>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
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
