import { useCallback, useEffect, useState } from 'react'
import { locate, type Located } from './lib/geo'
import { fetchWeather, type WeatherData } from './lib/weather'
import {
  codeLabel,
  deltaText,
  funTips,
  nowHeadline,
  precipSummary,
  round1,
  themeClass,
  tomorrowAlerts,
} from './lib/compare'
import { loadFavorites, saveFavorites, type Place } from './lib/places'
import { PARTNERS_NOTICE, partnerPicks, partnersActive } from './lib/partners'
import RadarMap from './components/RadarMap'
import KmaNowcast from './components/KmaNowcast'
import PlaceBar from './components/PlaceBar'
import PromoLayer from './components/PromoLayer'
import './App.css'

type Status = 'loading' | 'ready' | 'error'

function DeltaBadge({ delta, unit = '°' }: { delta: number; unit?: string }) {
  if (Math.abs(delta) < 0.5) return <span className="delta same">≈ 어제와 비슷</span>
  const up = delta > 0
  return (
    <span className={`delta ${up ? 'up' : 'down'}`}>
      {up ? '▲' : '▼'} {Math.abs(round1(delta))}
      {unit}
    </span>
  )
}

export default function App() {
  const [status, setStatus] = useState<Status>('loading')
  const [favorites, setFavorites] = useState<Place[]>(loadFavorites)
  const [selectedId, setSelectedId] = useState<string>('current')
  const [loc, setLoc] = useState<Located | null>(null)
  const [wx, setWx] = useState<WeatherData | null>(null)

  const load = useCallback(
    async (id: string) => {
      setStatus('loading')
      try {
        let where: Located
        const fav = favorites.find((p) => p.id === id)
        if (fav) {
          where = { lat: fav.lat, lon: fav.lon, label: fav.name, isFallback: false }
        } else {
          where = await locate()
        }
        setLoc(where)
        setWx(await fetchWeather(where.lat, where.lon))
        setStatus('ready')
      } catch {
        setStatus('error')
      }
    },
    [favorites],
  )

  useEffect(() => {
    load(selectedId)
    // favorites 변경만으로는 재로드하지 않음 (선택 변경 시에만)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  function addFavorite(p: Place) {
    setFavorites((prev) => {
      if (prev.some((f) => f.id === p.id)) return prev
      const next = [...prev, p]
      saveFavorites(next)
      return next
    })
  }

  function removeFavorite(id: string) {
    setFavorites((prev) => {
      const next = prev.filter((f) => f.id !== id)
      saveFavorites(next)
      return next
    })
    if (selectedId === id) setSelectedId('current')
  }

  const theme = wx ? themeClass(wx.nowCode, wx.nowIsDay) : 'bg-loading'

  if (status === 'loading') {
    return (
      <div className={`shell center ${theme}`}>
        <div className="spinner" aria-label="불러오는 중" />
        <p className="muted">위치와 날씨를 확인하고 있어요…</p>
      </div>
    )
  }

  if (status === 'error' || !wx || !loc) {
    return (
      <div className="shell center bg-loading">
        <p>날씨를 불러오지 못했어요.</p>
        <button type="button" className="retry" onClick={() => load(selectedId)}>
          다시 시도
        </button>
      </div>
    )
  }

  const now = codeLabel(wx.nowCode)
  const head = nowHeadline(wx.nowTemp, wx.yesterdaySameHour)
  const rain = precipSummary(wx.today, wx.yesterday)
  const tips = funTips({ today: wx.today, yesterday: wx.yesterday, uvMax: wx.uvMaxToday })
  const picks = partnerPicks({ today: wx.today, uvMax: wx.uvMaxToday })
  const alerts = tomorrowAlerts(wx.tomorrow, wx.today)
  const tomorrowLabel = codeLabel(wx.tomorrow.code)

  return (
    <div className={`shell ${theme}`}>
      <PromoLayer picks={picks} />
      <header className="top">
        <h1 className="brand">무능한 날씨예측기</h1>
        <button type="button" className="loc" onClick={() => load(selectedId)} title="새로고침">
          {selectedId === 'current' ? '📍' : '⭐'} {loc.label}{' '}
          {selectedId === 'current' && loc.isFallback && <em>(위치 권한 필요)</em>}
        </button>
      </header>

      <PlaceBar
        favorites={favorites}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAdd={addFavorite}
        onRemove={removeFavorite}
      />

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
        {tips.length > 0 && (
          <ul className="tips">
            {tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}
        {picks.length > 0 && (
          <div className="picks">
            {picks.map((p) => (
              <a key={p.url} className="pick-btn" href={p.url} target="_blank" rel="noreferrer">
                {p.emoji} {p.label}
              </a>
            ))}
          </div>
        )}
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
            <DeltaBadge delta={wx.today.precipSum - wx.yesterday.precipSum} unit="mm" />
            <span className="stat-yesterday">어제 {round1(wx.yesterday.precipSum)}mm</span>
          </div>
          <div className="stat">
            <span className="stat-label">강수확률</span>
            <span className="stat-value">{wx.today.precipProbMax ?? '?'}%</span>
          </div>
        </div>
      </section>

      <section className="card radar-card">
        <h2 className="section-title">비구름 레이더</h2>
        <RadarMap lat={loc.lat} lon={loc.lon} />
      </section>

      <KmaNowcast />

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

      <footer className="foot">
        <a
          className="feedback-btn"
          href={`mailto:kdy7854@naver.com?subject=${encodeURIComponent('[무능한 날씨예측기] 개선 의견')}&body=${encodeURIComponent('앱을 쓰다가 이런 점이 아쉬웠어요:\n\n')}`}
        >
          ✉️ 개선점이 있다면 메일 보내기
        </a>
        <p className="muted small">문의: kdy7854@naver.com</p>
        {partnersActive() && <p className="muted small">{PARTNERS_NOTICE}</p>}
        <p className="muted small">데이터: 기상청 · Open-Meteo · RainViewer · © OpenStreetMap</p>
      </footer>
    </div>
  )
}
