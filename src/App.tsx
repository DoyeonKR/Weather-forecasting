import { useCallback, useEffect, useState } from 'react'
import { locate, type Located } from './lib/geo'
import { fetchWeather, type WeatherData } from './lib/weather'
import {
  codeLabel,
  deltaText,
  nowHeadline,
  precipSummary,
  round1,
  tomorrowAlerts,
} from './lib/compare'
import RadarMap from './components/RadarMap'
import './App.css'

type Status = 'loading' | 'ready' | 'error'

function DeltaBadge({ delta }: { delta: number }) {
  if (Math.abs(delta) < 0.5) return <span className="delta same">≈ 어제와 비슷</span>
  const up = delta > 0
  return (
    <span className={`delta ${up ? 'up' : 'down'}`}>
      {up ? '▲' : '▼'} {Math.abs(round1(delta))}°
    </span>
  )
}

export default function App() {
  const [status, setStatus] = useState<Status>('loading')
  const [loc, setLoc] = useState<Located | null>(null)
  const [wx, setWx] = useState<WeatherData | null>(null)

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const where = await locate()
      setLoc(where)
      const weather = await fetchWeather(where.lat, where.lon)
      setWx(weather)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (status === 'loading') {
    return (
      <div className="shell center">
        <div className="spinner" aria-label="불러오는 중" />
        <p className="muted">위치와 날씨를 확인하고 있어요…</p>
      </div>
    )
  }

  if (status === 'error' || !wx || !loc) {
    return (
      <div className="shell center">
        <p>날씨를 불러오지 못했어요.</p>
        <button type="button" className="retry" onClick={load}>
          다시 시도
        </button>
      </div>
    )
  }

  const now = codeLabel(wx.nowCode)
  const head = nowHeadline(wx.nowTemp, wx.yesterdaySameHour)
  const rain = precipSummary(wx.today, wx.yesterday)
  const alerts = tomorrowAlerts(wx.tomorrow, wx.today)
  const tomorrowLabel = codeLabel(wx.tomorrow.code)

  return (
    <div className="shell">
      <header className="top">
        <h1 className="brand">어제보다</h1>
        <button type="button" className="loc" onClick={load} title="위치·날씨 새로고침">
          📍 {loc.label} {loc.isFallback && <em>(위치 권한 필요)</em>}
        </button>
      </header>

      <section className="hero card">
        <div className="hero-main">
          <span className="hero-emoji" aria-hidden>
            {now.emoji}
          </span>
          <div>
            <div className="hero-temp">{round1(wx.nowTemp)}°</div>
            <div className="hero-sub">
              {now.label} · 체감 {round1(wx.nowApparent)}°
            </div>
          </div>
        </div>
        <p className={`headline ${head.delta > 0.4 ? 'warm' : head.delta < -0.4 ? 'cold' : ''}`}>
          {head.text}
        </p>
        {rain && <p className="rain-note">☔ {rain}</p>}
      </section>

      <section className="card">
        <h2 className="section-title">오늘 vs 어제</h2>
        <div className="grid2">
          <div className="stat">
            <span className="stat-label">최고</span>
            <span className="stat-value">{round1(wx.today.tmax)}°</span>
            <DeltaBadge delta={wx.today.tmax - wx.yesterday.tmax} />
            <span className="stat-yesterday">어제 {round1(wx.yesterday.tmax)}°</span>
          </div>
          <div className="stat">
            <span className="stat-label">최저</span>
            <span className="stat-value">{round1(wx.today.tmin)}°</span>
            <DeltaBadge delta={wx.today.tmin - wx.yesterday.tmin} />
            <span className="stat-yesterday">어제 {round1(wx.yesterday.tmin)}°</span>
          </div>
          <div className="stat">
            <span className="stat-label">강수량</span>
            <span className="stat-value">{round1(wx.today.precipSum)}mm</span>
            <span className="stat-yesterday">어제 {round1(wx.yesterday.precipSum)}mm</span>
          </div>
          <div className="stat">
            <span className="stat-label">강수확률</span>
            <span className="stat-value">{wx.today.precipProbMax ?? '—'}%</span>
          </div>
        </div>
      </section>

      <section className="card radar-card">
        <h2 className="section-title">비구름 레이더</h2>
        <RadarMap lat={loc.lat} lon={loc.lon} />
      </section>

      <section className="card">
        <h2 className="section-title">내일은 오늘보다</h2>
        <div className="tomorrow-row">
          <span className="tomorrow-emoji" aria-hidden>
            {tomorrowLabel.emoji}
          </span>
          <div className="tomorrow-info">
            <div>
              {tomorrowLabel.label} · {round1(wx.tomorrow.tmin)}° ~ {round1(wx.tomorrow.tmax)}°
            </div>
            <div className="muted small">
              낮 기온 {deltaText(wx.tomorrow.tmax - wx.today.tmax)} · 아침 기온{' '}
              {deltaText(wx.tomorrow.tmin - wx.today.tmin)}
            </div>
          </div>
        </div>
        {alerts.length > 0 && (
          <ul className="alerts">
            {alerts.map((a) => (
              <li key={a}>⚠️ {a}</li>
            ))}
          </ul>
        )}
      </section>

      <footer className="foot muted small">
        데이터: Open-Meteo · RainViewer · © OpenStreetMap
      </footer>
    </div>
  )
}
