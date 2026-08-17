import { useCallback, useEffect, useRef, useState } from 'react'
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
import PlaceBar from './components/PlaceBar'
import PromoLayer from './components/PromoLayer'
import Settings from './components/Settings'
import { fetchTodayVisitors } from './lib/track'
import './App.css'

type Status = 'loading' | 'ready' | 'error'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

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
  /** 검색으로 보는 임시 장소 (즐겨찾기 아님) */
  const [tempPlace, setTempPlace] = useState<Place | null>(null)
  const [loc, setLoc] = useState<Located | null>(null)
  const [wx, setWx] = useState<WeatherData | null>(null)
  const [visitors, setVisitors] = useState<number | null>(null)

  useEffect(() => {
    fetchTodayVisitors().then(setVisitors)
  }, [])

  // 위치 권한 팝업은 사용자가 "현재 위치"를 직접 눌렀을 때만
  const promptRef = useRef(false)

  const load = useCallback(
    async (id: string) => {
      setStatus('loading')
      try {
        let where: Located
        const fav =
          favorites.find((p) => p.id === id) ?? (tempPlace?.id === id ? tempPlace : undefined)
        if (fav) {
          where = { lat: fav.lat, lon: fav.lon, label: fav.name, isFallback: false }
        } else {
          const wantPrompt = promptRef.current
          promptRef.current = false
          where = await locate(wantPrompt)
          // 권한이 없고 사용자가 요청한 것도 아니면, 즐겨찾기가 있을 때 그쪽을 우선
          if (where.isFallback && !wantPrompt && favorites.length > 0) {
            setSelectedId(favorites[0].id)
            return
          }
        }
        setLoc(where)
        setWx(await fetchWeather(where.lat, where.lon))
        setStatus('ready')
      } catch {
        setStatus('error')
      }
    },
    [favorites, tempPlace],
  )

  function selectPlace(id: string) {
    if (id === 'current') promptRef.current = true
    if (id === selectedId) load(id)
    else setSelectedId(id)
  }

  function viewPlace(p: Place) {
    setTempPlace(p)
    if (p.id === selectedId) load(p.id)
    else setSelectedId(p.id)
  }

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
        <div className="neon-frame" aria-hidden />
        <div className="spinner" aria-label="불러오는 중" />
        <p className="muted">위치와 날씨를 확인하고 있어요…</p>
      </div>
    )
  }

  if (status === 'error' || !wx || !loc) {
    return (
      <div className="shell center bg-loading">
        <div className="neon-frame" aria-hidden />
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
      <div className="neon-frame" aria-hidden />
      <PromoLayer picks={picks} />
      <header className="top">
        <div>
          <h1 className="brand">무능한 날씨예측기</h1>
          {visitors !== null && <span className="visitors">👀 오늘 {visitors}명 다녀갔어요</span>}
        </div>
        <div className="top-right">
          <button type="button" className="loc" onClick={() => selectPlace(selectedId)} title="새로고침">
            {selectedId === 'current' ? '📍' : favorites.some((f) => f.id === selectedId) ? '⭐' : '🔍'}{' '}
            {loc.label}{' '}
            {selectedId === 'current' && loc.isFallback && <em>(눌러서 내 위치 사용)</em>}
          </button>
          <Settings loc={{ lat: loc.lat, lon: loc.lon, label: loc.label }} />
        </div>
      </header>

      <PlaceBar
        favorites={favorites}
        selectedId={selectedId}
        onSelect={selectPlace}
        onView={viewPlace}
        onRemove={removeFavorite}
      />

      {tempPlace?.id === selectedId && !favorites.some((f) => f.id === selectedId) && (
        <button type="button" className="star-add" onClick={() => addFavorite(tempPlace)}>
          ⭐ {tempPlace.name} 즐겨찾기에 추가
        </button>
      )}

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

      <section className="card">
        <h2 className="section-title">이번 주 날씨</h2>
        <ul className="week">
          {wx.week.map((d, i) => {
            const dt = new Date(`${d.date}T00:00:00`)
            const lb = codeLabel(d.stats.code)
            const dayName = i === 0 ? '오늘' : WEEKDAYS[dt.getDay()]
            return (
              <li key={d.date} className={i === 0 ? 'week-today' : ''}>
                <span className={`week-day ${dt.getDay() === 0 ? 'sun' : dt.getDay() === 6 ? 'sat' : ''}`}>
                  {dayName}
                </span>
                <span className="week-date">
                  {dt.getMonth() + 1}.{dt.getDate()}
                </span>
                <span className="week-emoji" aria-hidden>
                  {lb.emoji}
                </span>
                <span className="week-prob">
                  {(d.stats.precipProbMax ?? 0) >= 20 ? `${d.stats.precipProbMax}%` : ''}
                </span>
                <span className="week-min">{Math.round(d.stats.tmin)}°</span>
                <span className="week-max">{Math.round(d.stats.tmax)}°</span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="card radar-card">
        <h2 className="section-title">비구름 레이더</h2>
        <RadarMap lat={loc.lat} lon={loc.lon} />
      </section>

      <footer className="foot">
        <a
          className="feedback-btn kakao"
          href="https://open.kakao.com/o/sMM1eS0f"
          target="_blank"
          rel="noreferrer"
        >
          💬 오픈채팅으로 문의하기
        </a>
        <p className="muted small">오픈채팅으로 보내주시면 개선 의견을 실시간으로 반영해드려요.</p>
        <a
          className="feedback-btn"
          href={`mailto:kdy7854@naver.com?subject=${encodeURIComponent('[무능한 날씨예측기] 개선 의견')}&body=${encodeURIComponent('앱을 쓰다가 이런 점이 아쉬웠어요:\n\n')}`}
        >
          ✉️ 메일로 보내기
        </a>
        <p className="muted small">문의: kdy7854@naver.com</p>
        <p className="muted small">
          패밀리 사이트:{' '}
          <a className="family-link" href="https://doyeonkr.github.io/our-days/" target="_blank" rel="noreferrer">
            우리들의 하루 (커플 앱)
          </a>
        </p>
        {partnersActive() && <p className="muted small">{PARTNERS_NOTICE}</p>}
        <p className="muted small">데이터: 기상청 · Open-Meteo · RainViewer · © OpenStreetMap</p>
      </footer>
    </div>
  )
}
