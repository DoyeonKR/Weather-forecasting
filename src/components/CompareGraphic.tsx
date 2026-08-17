// 오늘 vs 어제 그래픽 비교 — 텍스트 대신 시각 요소로
import type { DayStats } from '../lib/compare'
import { round1 } from '../lib/compare'

/** 지금 vs 어제 같은 시각: 큰 화살표 + 숫자 */
export function DeltaHero({ nowTemp, yesterdaySameHour }: { nowTemp: number; yesterdaySameHour: number }) {
  const d = round1(nowTemp - yesterdaySameHour)
  const same = Math.abs(d) < 0.5
  return (
    <div className="delta-hero">
      {same ? (
        <span className="delta-hero-num same">≈</span>
      ) : (
        <>
          <span className={`delta-hero-arrow ${d > 0 ? 'warm' : 'cold'}`}>{d > 0 ? '▲' : '▼'}</span>
          <span className={`delta-hero-num ${d > 0 ? 'warm' : 'cold'}`}>{Math.abs(d)}°</span>
        </>
      )}
      <span className="delta-hero-cap">어제 이 시간</span>
    </div>
  )
}

/** 온도 범위 바: 같은 눈금 위에 오늘(테마색)과 어제(회색) 캡슐 */
export function TempRangeBars({ today, yesterday }: { today: DayStats; yesterday: DayStats }) {
  const lo = Math.floor(Math.min(today.tmin, yesterday.tmin)) - 1
  const hi = Math.ceil(Math.max(today.tmax, yesterday.tmax)) + 1
  const span = hi - lo
  const W = 100
  const x = (t: number) => ((t - lo) / span) * W

  const rows = [
    { name: '오늘', s: today, cls: 'today' },
    { name: '어제', s: yesterday, cls: 'yesterday' },
  ]

  return (
    <div className="range-wrap">
      {rows.map((r) => (
        <div className="range-row" key={r.name}>
          <span className="range-name">{r.name}</span>
          <span className={`range-min ${r.cls}`}>{Math.round(r.s.tmin)}°</span>
          <div className="range-track">
            <div
              className={`range-bar ${r.cls}`}
              style={{ left: `${x(r.s.tmin)}%`, width: `${Math.max(x(r.s.tmax) - x(r.s.tmin), 4)}%` }}
            />
          </div>
          <span className={`range-max ${r.cls}`}>{Math.round(r.s.tmax)}°</span>
        </div>
      ))}
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
