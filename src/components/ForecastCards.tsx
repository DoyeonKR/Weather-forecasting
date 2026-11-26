// 값만 받아 그리는 예보 카드 세 장 — App.tsx 에서 그대로 옮겼다 (동작·마크업 변화 없음)
import { Drop, ThermometerSimple, Warning, Wind } from '@phosphor-icons/react'
import { PrecipCompare, TempRangeBars, WindCompare } from './CompareGraphic'
import { NormalLine } from './Extras'
import DeltaPill from './DeltaPill'
import WeatherArtwork from './WeatherArtwork'
import { codeLabel, compareSummary, round1, type DayStats } from '../lib/compare'
import { iconTone, weatherIcon, weatherTone } from '../lib/weatherIcon'
import type { Normal } from '../lib/normals'
import type { WeatherData } from '../lib/weather'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** 어제와 비교하면 — 기온·강수(지금~자정)·바람 */
export function CompareCard({
  wx,
  ahead,
  yestWindow,
  normal,
}: {
  wx: WeatherData
  /** 오늘 남은 시간 */
  ahead: DayStats
  /** 어제 같은 시간대 */
  yestWindow: DayStats
  normal: Normal | null
}) {
  return (
    <section className="card">
      <h2 className="section-title">어제와 비교하면</h2>
      <p className="cmp-summary">{compareSummary(ahead, yestWindow)}</p>
      <div className="cmp-sec">
        <h3 className="cmp-title">
          <ThermometerSimple size={16} weight="duotone" className="warm-icon" aria-hidden /> 기온
        </h3>
        <TempRangeBars today={wx.today} yesterday={wx.yesterday} />
        {normal && <NormalLine normal={normal} today={wx.today} />}
      </div>
      <div className="cmp-sec">
        <h3 className="cmp-title">
          <Drop size={16} weight="duotone" className="cold-icon" aria-hidden /> 강수
          {/* 오늘은 남은 시간, 어제는 같은 시간대 — 어느 구간인지 밝혀야 숫자를 오해하지 않는다 */}
          <small className="cmp-window">{wx.nowHourLocal}시~자정</small>
        </h3>
        <PrecipCompare today={ahead} yesterday={yestWindow} />
      </div>
      <div className="cmp-sec">
        <h3 className="cmp-title">
          <Wind size={16} weight="duotone" className="wind-icon" aria-hidden /> 바람
        </h3>
        <WindCompare today={wx.today} yesterday={wx.yesterday} />
      </div>
    </section>
  )
}

/** 내일은 오늘보다 — 아침·낮 기온과 주의할 점 */
export function TomorrowCard({ wx, alerts }: { wx: WeatherData; alerts: string[] }) {
  const tomorrowLabel = codeLabel(wx.tomorrow.code)
  const tomorrowTone = weatherTone(tomorrowLabel.label)
  return (
    <section className="card tomorrow-card" data-jump="tomorrow">
      <div className="tomorrow-heading">
        <div className="tomorrow-title">
          <h2 className="section-title">내일은 오늘보다</h2>
          <p>{tomorrowLabel.label}</p>
        </div>
        <span className={`tomorrow-emoji wi-${tomorrowTone}`} aria-hidden>
          <WeatherArtwork label={tomorrowLabel.label} size={72} variant="illustrated" />
        </span>
      </div>
      <div className="tomorrow-stats">
        {([
          { label: '아침 · 최저', temp: wx.tomorrow.tmin, diff: wx.tomorrow.tmin - wx.today.tmin },
          { label: '낮 · 최고', temp: wx.tomorrow.tmax, diff: wx.tomorrow.tmax - wx.today.tmax },
        ]).map(({ label, temp, diff }) => (
          <div className="tomorrow-stat" key={label}>
            <span>{label}</span>
            <strong>{round1(temp).toFixed(1)}°</strong>
            <small className={Math.abs(round1(diff)) < 0.5 ? 'muted' : diff > 0 ? 'warm-icon' : 'cold-icon'}>
              <DeltaPill delta={diff} digits={1} sameText="오늘과 비슷" />
            </small>
          </div>
        ))}
      </div>
      {alerts.length > 0 && (
        <ul className="alerts">
          {alerts.map((a) => (
            <li key={a}>
              <Warning size={16} weight="duotone" aria-hidden /> {a}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** 이번 주 날씨 — 오늘 줄은 남은 시간 기준 */
export function WeekCard({ wx, ahead }: { wx: WeatherData; ahead: DayStats }) {
  const lo = Math.floor(Math.min(...wx.week.map((d) => d.stats.tmin))) - 1
  const hi = Math.ceil(Math.max(...wx.week.map((d) => d.stats.tmax))) + 1
  const span = hi - lo
  return (
    <section className="card" data-jump="week">
      <div className="week-heading">
        <h2 className="section-title">이번 주 날씨</h2>
        <span className="week-key"><span><i className="chart-end low" aria-hidden="true" /> 최저</span><span><i className="chart-end high" aria-hidden="true" /> 최고</span></span>
      </div>
      <ul className="week">
        <li className="week-head" aria-hidden>
          <span>요일</span>
          <span>날짜</span>
          <span style={{ textAlign: 'center' }}>날씨</span>
          <span style={{ textAlign: 'right', paddingRight: 8 }}>강수</span>
          <span style={{ textAlign: 'right' }}>최저</span>
          <span />
          <span style={{ textAlign: 'right' }}>최고</span>
        </li>
        {wx.week.map((d, i) => {
          const dt = new Date(`${d.date}T00:00:00`)
          // 오늘 줄은 남은 시간 기준 (밤에 맑으면 해 대신 달)
          const lb = codeLabel(i === 0 ? ahead.code : d.stats.code)
          const DayIcon = weatherIcon(lb.label, i === 0 ? wx.nowIsDay : true)
          const dayName = i === 0 ? '오늘' : WEEKDAYS[dt.getDay()]
          const left = ((d.stats.tmin - lo) / span) * 100
          const width = Math.max(((d.stats.tmax - d.stats.tmin) / span) * 100, 4)
          // 오늘 줄은 남은 시간 기준 — 위쪽 강수확률 칸(0%)과 같은 숫자를 말하게
          const p = i === 0 ? ahead.precipProbMax : d.stats.precipProbMax
          return (
            <li key={d.date} className={i === 0 ? 'week-today' : ''}>
              <span className={`week-day ${dt.getDay() === 0 ? 'sun' : dt.getDay() === 6 ? 'sat' : ''}`}>
                {dayName}
              </span>
              <span className="week-date">
                {dt.getMonth() + 1}.{dt.getDate()}
              </span>
              <span className={`week-emoji wic-${iconTone(lb.label, i === 0 ? wx.nowIsDay : true)}`} role="img" aria-label={lb.label}>
                <DayIcon size={22} weight="duotone" aria-hidden />
              </span>
              <span className="week-prob">{(p ?? 0) >= 20 ? `${p}%` : ''}</span>
              <span className="week-min">{Math.round(d.stats.tmin)}°</span>
              <div className="week-track">
                <div className="week-bar" style={{ left: `${left}%`, width: `${width}%` }} />
              </div>
              <span className="week-max">{Math.round(d.stats.tmax)}°</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
