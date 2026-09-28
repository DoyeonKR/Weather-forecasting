// 오늘 vs 어제 그래픽 비교 — 텍스트 대신 시각 요소로
import type { DayStats } from '../lib/compare'
import { round1 } from '../lib/compare'

/** 지금 vs 어제 같은 시각: 큰 화살표 + 숫자 (캡슐 강조) */
export function DeltaHero({ nowTemp, yesterdaySameHour }: { nowTemp: number; yesterdaySameHour: number }) {
  const d = round1(nowTemp - yesterdaySameHour)
  const same = Math.abs(d) < 0.5
  const mood = same ? 'same' : d > 0 ? 'warm' : 'cold'
  return (
    <div className={`delta-hero ${mood}`}>
      <div className="delta-hero-main">
        {same ? (
          <span className="delta-hero-num same">≈</span>
        ) : (
          <>
            <span className={`delta-hero-arrow ${mood}`}>{d > 0 ? '▲' : '▼'}</span>
            <span className={`delta-hero-num ${mood}`}>{Math.abs(d)}°</span>
          </>
        )}
      </div>
      <span className="delta-hero-cap">어제 이 시간 {round1(yesterdaySameHour)}°</span>
    </div>
  )
}

/** 차이 한 마디: ▲3° / ▼2° / 비슷 */
function diffChip(d: number) {
  const r = Math.round(d)
  if (r === 0) return <b className="range-diff same">비슷</b>
  return <b className={`range-diff ${r > 0 ? 'warm' : 'cold'}`}>{r > 0 ? `▲${r}°` : `▼${-r}°`}</b>
}

/**
 * 온도 범위 바: 같은 눈금 위에 오늘(색)과 어제(회색) 캡슐.
 * 막대가 "무엇"인지 안 보인다는 지적 — 위에 최저/최고 머리글, 아래에 눈금 숫자,
 * 맨 아래에 아침·낮이 어제보다 몇 도 달라졌는지를 글로 붙인다.
 */
export function TempRangeBars({ today, yesterday }: { today: DayStats; yesterday: DayStats }) {
  const lo = Math.floor(Math.min(today.tmin, yesterday.tmin)) - 1
  const hi = Math.ceil(Math.max(today.tmax, yesterday.tmax)) + 1
  const span = hi - lo
  const W = 100
  const x = (t: number) => ((t - lo) / span) * W
  // 눈금: 범위가 넓으면 5도, 좁으면 2도 간격
  const step = span > 14 ? 5 : 2
  const ticks: number[] = []
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(t)

  const rows = [
    { name: '오늘', s: today, cls: 'today' },
    { name: '어제', s: yesterday, cls: 'yesterday' },
  ]

  return (
    <div className="range-wrap">
      <div className="range-row range-head" aria-hidden>
        <span />
        <span className="range-min">최저</span>
        <span className="range-head-mid">하루 기온 범위</span>
        <span className="range-max">최고</span>
      </div>
      {rows.map((r) => (
        <div className="range-row" key={r.name}>
          <span className="range-name">{r.name}</span>
          <span className={`range-min ${r.cls}`}>{Math.round(r.s.tmin)}°</span>
          <div
            className="range-track"
            role="img"
            aria-label={`${r.name} 최저 ${Math.round(r.s.tmin)}도, 최고 ${Math.round(r.s.tmax)}도`}
          >
            {ticks.map((t) => (
              <i key={t} className="range-gridline" style={{ left: `${x(t)}%` }} />
            ))}
            <div
              className={`range-bar ${r.cls}`}
              style={{ left: `${x(r.s.tmin)}%`, width: `${Math.max(x(r.s.tmax) - x(r.s.tmin), 4)}%` }}
            />
          </div>
          <span className={`range-max ${r.cls}`}>{Math.round(r.s.tmax)}°</span>
        </div>
      ))}
      <div className="range-row range-scale" aria-hidden>
        <span />
        <span />
        <div className="range-ticks">
          {ticks.map((t) => (
            <span key={t} style={{ left: `${x(t)}%` }}>
              {t}°
            </span>
          ))}
        </div>
        <span />
      </div>
      <p className="range-summary">
        어제보다 아침(최저) {diffChip(today.tmin - yesterday.tmin)} · 낮(최고) {diffChip(today.tmax - yesterday.tmax)}
      </p>
    </div>
  )
}

/** 강수 비교: 물방울 + 비례 바 */
export function PrecipCompare({ today, yesterday }: { today: DayStats; yesterday: DayStats }) {
  const t = today.precipSum
  const y = yesterday.precipSum
  const max = Math.max(t, y, 1)
  return (
    <div className="precip-wrap">
      <div className="precip-row">
        <span className="range-name">오늘</span>
        <div className="precip-track">
          <div className="precip-bar today" style={{ width: `${(t / max) * 100}%` }} />
        </div>
        <span className="precip-val">
          {round1(t)}mm{today.precipProbMax !== null ? ` · ${today.precipProbMax}%` : ''}
        </span>
      </div>
      <div className="precip-row">
        <span className="range-name">어제</span>
        <div className="precip-track">
          <div className="precip-bar yesterday" style={{ width: `${(y / max) * 100}%` }} />
        </div>
        <span className="precip-val">{round1(y)}mm</span>
      </div>
    </div>
  )
}

/** 바람 비교: 최대 풍속 비례 바 (돌풍 병기) */
export function WindCompare({ today, yesterday }: { today: DayStats; yesterday: DayStats }) {
  const t = today.windMax ?? 0
  const y = yesterday.windMax ?? 0
  const max = Math.max(t, y, 10)
  const gust = (s: DayStats) => (s.gustMax ? ` · 돌풍 ${Math.round(s.gustMax)}` : '')
  return (
    <div className="precip-wrap">
      <div className="precip-row">
        <span className="range-name">오늘</span>
        <div className="precip-track">
          <div className="precip-bar wind today" style={{ width: `${(t / max) * 100}%` }} />
        </div>
        <span className="precip-val">
          {Math.round(t)}km/h{gust(today)}
        </span>
      </div>
      <div className="precip-row">
        <span className="range-name">어제</span>
        <div className="precip-track">
          <div className="precip-bar wind yesterday" style={{ width: `${(y / max) * 100}%` }} />
        </div>
        <span className="precip-val">
          {Math.round(y)}km/h{gust(yesterday)}
        </span>
      </div>
    </div>
  )
}
