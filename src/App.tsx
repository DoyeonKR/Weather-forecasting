import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { locate, type Located } from './lib/geo'
import { fetchWeather, type WeatherData } from './lib/weather'
import {
  codeLabel,
  compareSummary,
  deltaText,
  funTips,
  round1,
  themeClass,
  tomorrowAlerts,
} from './lib/compare'
import { loadFavorites, loadHome, saveFavorites, saveHome, type Place } from './lib/places'
import { fetchKmaNow, inKoreaBounds, ptyLabel, type KmaNow } from './lib/kmaNow'
import { PARTNERS_NOTICE, partnerPicks, partnersActive } from './lib/partners'
import WhenVisible from './components/WhenVisible'
// 지도·GIF 해석기는 첫 화면에 필요 없으므로 화면에 나올 때 불러온다
const RadarMap = lazy(() => import('./components/RadarMap'))
import PlaceBar from './components/PlaceBar'
import PromoLayer from './components/PromoLayer'
import Settings from './components/Settings'
import WeatherFx from './components/WeatherFx'
import { DeltaHero, PrecipCompare, TempRangeBars, WindCompare } from './components/CompareGraphic'
import ComparePlaces from './components/ComparePlaces'
import CoupangBanner from './components/CoupangBanner'
import { fetchTodayVisitors } from './lib/track'
import HourlyCard from './components/HourlyCard'
import { loadOrder, saveOrder, type SectionKey } from './lib/sections'
import { useLongPressReorder } from './lib/reorder'
import './App.css'

type Status = 'loading' | 'ready' | 'error'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** 멘트 이모지 → 애니메이션 종류 */
function tipAnim(emoji: string): string {
  if ('🌧️☔☂️🌂🌦️💧'.includes(emoji)) return 'anim-rain'
  if ('🌨️☃️⛄🧊🥶❄️'.includes(emoji)) return 'anim-snow'
  if ('☀️🔥🥵🧴🕶️🌡️🌅'.includes(emoji)) return 'anim-sun'
  if ('💨🍃'.includes(emoji)) return 'anim-wind'
  return 'anim-idle'
}

export default function App() {
  const [status, setStatus] = useState<Status>('loading')
  const [favorites, setFavorites] = useState<Place[]>(loadFavorites)
  const [selectedId, setSelectedId] = useState<string>(() => {
    const home = loadHome()
    return home === 'current' || loadFavorites().some((f) => f.id === home) ? home : 'current'
  })
  const [homeId, setHomeId] = useState<string>(loadHome)
  /** 검색으로 보는 임시 장소 (즐겨찾기 아님) */
  const [tempPlace, setTempPlace] = useState<Place | null>(null)
  const [loc, setLoc] = useState<Located | null>(null)
  const [wx, setWx] = useState<WeatherData | null>(null)
  const [kmaNow, setKmaNow] = useState<KmaNow | null>(null)
  const [visitors, setVisitors] = useState<number | null>(null)
  const [tipsOpen, setTipsOpen] = useState(true)
  const [sectionOrder, setSectionOrder] = useState<SectionKey[]>(loadOrder)

  useEffect(() => {
    fetchTodayVisitors().then(setVisitors)
  }, [])

  // 위치 권한 팝업은 사용자가 "현재 위치"를 직접 눌렀을 때만
  const promptRef = useRef(false)
  // 지역을 빠르게 바꿀 때 먼저 시작한 요청이 나중 결과를 덮어쓰지 않도록
  const loadSeq = useRef(0)
  // 지금 화면에 그려진 날씨가 어느 지역 것인지 (실패했을 때 선택을 되돌리는 기준)
  const loadedId = useRef('')

  const load = useCallback(
    async (id: string) => {
      const seq = ++loadSeq.current
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
          // GPS 를 기다리는 동안 사용자가 다른 지역을 골랐으면 이 결과는 버린다
          if (seq !== loadSeq.current) return
          // 권한이 없고 사용자가 요청한 것도 아니면, 즐겨찾기가 있을 때 그쪽을 우선
          if (where.isFallback && !wantPrompt && favorites.length > 0) {
            setSelectedId(favorites[0].id)
            return
          }
        }
        if (seq !== loadSeq.current) return
        const [weather, obs] = await Promise.all([
          fetchWeather(where.lat, where.lon),
          inKoreaBounds(where.lat, where.lon) ? fetchKmaNow(where.lat, where.lon) : Promise.resolve(null),
        ])
        if (seq !== loadSeq.current) return
        // 지역 이름과 날씨는 같이 바뀌어야 한다. 먼저 바꾸면 갱신이 실패했을 때
        // 헤더는 부산, 기온은 서울 값인 화면이 그대로 남는다.
        setLoc(where)
        setWx(weather)
        setKmaNow(obs)
        loadedId.current = id
        setStatus('ready')
      } catch {
        if (seq !== loadSeq.current) return
        setStatus('error')
        // 화면에 이전 지역 날씨가 남아 있으면 선택 칩도 그 지역으로 되돌린다.
        // 칩은 부산인데 기온은 서울이면 사용자는 그것을 부산 날씨로 읽는다.
        if (loadedId.current && loadedId.current !== id) setSelectedId(loadedId.current)
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
    if (homeId === id) {
      saveHome('current')
      setHomeId('current')
    }
  }

  function moveFavorite(id: string, dir: -1 | 1) {
    setFavorites((prev) => {
      const i = prev.findIndex((f) => f.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      saveFavorites(next)
      return next
    })
  }

  function setHome(id: string) {
    saveHome(id)
    setHomeId(id)
  }

  function applyOrder(next: SectionKey[]) {
    setSectionOrder(next)
    saveOrder(next)
  }

  const reorder = useLongPressReorder<SectionKey>({ order: sectionOrder, onChange: applyOrder, axis: 'y' })

  // 배경 테마: 기상청 관측(PTY)이 강수를 잡으면 관측 기준으로 (비=61, 눈·진눈깨비=73)
  const effCode =
    kmaNow?.pty && kmaNow.pty > 0 ? (kmaNow.pty === 1 || kmaNow.pty === 5 ? 61 : 73) : wx?.nowCode
  const theme = wx ? themeClass(effCode ?? wx.nowCode, wx.nowIsDay) : 'bg-loading'

  // 첫 로딩에만 전체 화면 스피너. 지역 전환 등 갱신 중에는 기존 화면을 유지한다.
  if (status === 'loading' && (!wx || !loc)) {
    return (
      <div className={`shell center ${theme}`}>
        <div className="neon-frame" aria-hidden />
        <div className="spinner" aria-hidden />
        <p className="muted" role="status">
          위치와 날씨를 확인하고 있어요…
        </p>
      </div>
    )
  }

  if (!wx || !loc) {
    return (
      <div className="shell center bg-loading">
        <div className="neon-frame" aria-hidden />
        <p>날씨를 불러오지 못했어요.</p>
        <button type="button" className="retry" onClick={() => selectPlace(selectedId)}>
          다시 시도
        </button>
        {selectedId !== 'current' && (
          <button type="button" className="retry ghost" onClick={() => selectPlace('current')}>
            현재 위치로 보기
          </button>
        )}
      </div>
    )
  }

  // 현재 날씨 상태: 기상청 관측(PTY)이 강수를 잡으면 관측값 우선, 아니면 모델 라벨
  const obsLabel = ptyLabel(kmaNow?.pty ?? null)
  const now = obsLabel ?? codeLabel(wx.nowCode)
  const tips = funTips({ today: wx.today, yesterday: wx.yesterday, uvMax: wx.uvMaxToday })
  const picks = partnerPicks({ today: wx.today, uvMax: wx.uvMaxToday })
  const alerts = tomorrowAlerts(wx.tomorrow, wx.today)
  const tomorrowLabel = codeLabel(wx.tomorrow.code)

  return (
    <div className={`shell ${theme} ${status === 'loading' ? 'refreshing' : ''}`}>
      <WeatherFx theme={theme} />
      <div className="neon-frame" aria-hidden />
      <PromoLayer picks={picks} />
      <header className="top">
        <div>
          <h1 className="brand">무능한 날씨예측기</h1>
          {/* 감싸는 요소를 고정으로 둬야 안쪽이 버튼과 문구로 교체돼도 읽어준다 */}
          <span aria-live="polite">
            {status === 'loading' ? (
              <span className="visitors">날씨 갱신 중…</span>
            ) : status === 'error' ? (
              <button type="button" className="visitors err" onClick={() => selectPlace(selectedId)}>
                갱신 실패, 눌러서 다시 시도
              </button>
            ) : (
              visitors !== null && <span className="visitors">👀 오늘 {visitors}명</span>
            )}
          </span>
        </div>
        <div className="top-right">
          <button
            type="button"
            className="loc"
            onClick={() => selectPlace(selectedId)}
            title={loc.isFallback && selectedId === 'current' ? '눌러서 내 위치 사용' : `${loc.label} 새로고침`}
          >
            {selectedId === 'current' ? '📍' : favorites.some((f) => f.id === selectedId) ? '⭐' : '🔍'}{' '}
            <span className="loc-name">{loc.label.replace(' (기본 위치)', '(기본)')}</span>
          </button>
          <Settings
            loc={{ lat: loc.lat, lon: loc.lon, label: loc.label }}
            favorites={favorites}
            homeId={homeId}
            onSetHome={setHome}
            sectionOrder={sectionOrder}
            onSetOrder={applyOrder}
          />
        </div>
      </header>

      <PlaceBar
        favorites={favorites}
        selectedId={selectedId}
        onSelect={selectPlace}
        onView={viewPlace}
        onRemove={removeFavorite}
        onMove={moveFavorite}
        onReorder={(ids) => {
          setFavorites((prev) => {
            const map = new Map(prev.map((f) => [f.id, f]))
            const next = ids.map((id) => map.get(id)!).filter(Boolean)
            saveFavorites(next)
            return next
          })
        }}
      />

      {tempPlace?.id === selectedId && !favorites.some((f) => f.id === selectedId) && (
        <button type="button" className="star-add" onClick={() => addFavorite(tempPlace)}>
          ⭐ {tempPlace.name} 즐겨찾기에 추가
        </button>
      )}

      <div
        key={selectedId}
        ref={reorder.setContainer}
        className={`switch-enter ${reorder.active ? 'reorder-active' : ''}`}
        {...reorder.handlers}
      >
        {reorder.active && (
          <div className="reorder-bar">
            <span>카드를 끌어서 순서를 바꾸세요</span>
            <button type="button" data-reorder-exit onClick={reorder.exit}>
              완료
            </button>
          </div>
        )}
        {sectionOrder.map((key, i) => (
          <div
            key={key}
            data-reorder-id={key}
            className={`section-wrap ${reorder.dragId === key ? 'dragging' : ''}`}
          >
      {key === 'hero' && (
        <>
          <section className="hero card">
            <div className="hero-main">
              <span className="hero-emoji" aria-hidden>
                {now.emoji}
              </span>
              <div className="hero-info">
                <div className="hero-temp">{round1(wx.nowTemp)}°</div>
              </div>
              <DeltaHero nowTemp={wx.nowTemp} yesterdaySameHour={wx.yesterdaySameHour} />
            </div>
            <div className="hero-subs">
              <div className="hero-cond">
                <span className="hero-cond-tag">지금</span>
                {now.emoji} {now.label}
              </div>
              <div className="stat-chips">
                <div className="stat-chip">
                  <span className="stat-chip-icon" aria-hidden>🌡️</span>
                  <span className="stat-chip-label">체감</span>
                  <span className="stat-chip-value">{round1(wx.nowApparent)}°</span>
                </div>
                <div className="stat-chip">
                  <span className="stat-chip-icon" aria-hidden>💧</span>
                  <span className="stat-chip-label">습도</span>
                  <span className="stat-chip-value">{Math.round(kmaNow?.reh ?? wx.nowHumidity)}%</span>
                </div>
                <div className="stat-chip">
                  <span className="stat-chip-icon" aria-hidden>☔</span>
                  <span className="stat-chip-label">강수확률</span>
                  <span className="stat-chip-value">{wx.today.precipProbMax ?? '?'}%</span>
                </div>
                <div className="stat-chip">
                  <span className="stat-chip-icon" aria-hidden>🌧️</span>
                  <span className="stat-chip-label">{kmaNow !== null && (kmaNow.rn1 ?? 0) > 0 ? '시간당' : '오늘 강수'}</span>
                  <span className="stat-chip-value">
                    {kmaNow !== null && (kmaNow.rn1 ?? 0) > 0 ? `${kmaNow.rn1}mm` : `${round1(wx.today.precipSum)}mm`}
                  </span>
                </div>
              </div>
            </div>
            {tips.length > 0 && (
              <>
                <ul className="tips tips-visual">
                  {tips.map((t) => (
                    <li key={t.title} className="tip">
                      <span className={`tip-emoji ${tipAnim(t.emoji)}`} aria-hidden>
                        {t.emoji}
                      </span>
                      <div className="tip-text">
                        <div className="tip-title">{t.title}</div>
                        {tipsOpen && <div className="tip-body">{t.body}</div>}
                      </div>
                    </li>
                  ))}
                </ul>
                <button type="button" className="tips-more" onClick={() => setTipsOpen((o) => !o)}>
                  {tipsOpen ? '접기 ▲' : '자세히 보기 ▼'}
                </button>
              </>
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
    
            </>
      )}
      {key === 'compare' && (
        <>
          <section className="card">
            <h2 className="section-title">어제와 비교하면</h2>
            <p className="cmp-summary">{compareSummary(wx.today, wx.yesterday)}</p>
            <div className="cmp-sec">
              <h3 className="cmp-title">🌡️ 기온</h3>
              <TempRangeBars today={wx.today} yesterday={wx.yesterday} />
            </div>
            <div className="cmp-sec">
              <h3 className="cmp-title">💧 강수</h3>
              <PrecipCompare today={wx.today} yesterday={wx.yesterday} />
            </div>
            <div className="cmp-sec">
              <h3 className="cmp-title">💨 바람</h3>
              <WindCompare today={wx.today} yesterday={wx.yesterday} />
            </div>
          </section>
    
            </>
      )}
            {key === 'hourly' && <HourlyCard wx={wx} />}
      {key === 'tomorrow' && (
        <>
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
    
            </>
      )}
      {key === 'week' && (
        <>
          <section className="card">
            <h2 className="section-title">이번 주 날씨</h2>
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
              {(() => {
                const lo = Math.floor(Math.min(...wx.week.map((d) => d.stats.tmin))) - 1
                const hi = Math.ceil(Math.max(...wx.week.map((d) => d.stats.tmax))) + 1
                const span = hi - lo
                return wx.week.map((d, i) => {
                  const dt = new Date(`${d.date}T00:00:00`)
                  const lb = codeLabel(d.stats.code)
                  const dayName = i === 0 ? '오늘' : WEEKDAYS[dt.getDay()]
                  const left = ((d.stats.tmin - lo) / span) * 100
                  const width = Math.max(((d.stats.tmax - d.stats.tmin) / span) * 100, 4)
                  return (
                    <li key={d.date} className={i === 0 ? 'week-today' : ''}>
                      <span className={`week-day ${dt.getDay() === 0 ? 'sun' : dt.getDay() === 6 ? 'sat' : ''}`}>
                        {dayName}
                      </span>
                      <span className="week-date">
                        {dt.getMonth() + 1}.{dt.getDate()}
                      </span>
                      <span className="week-emoji" role="img" aria-label={lb.label}>
                        {lb.emoji}
                      </span>
                      <span className="week-prob">
                        {(d.stats.precipProbMax ?? 0) >= 20 ? `${d.stats.precipProbMax}%` : ''}
                      </span>
                      <span className="week-min">{Math.round(d.stats.tmin)}°</span>
                      <div className="week-track">
                        <div className="week-bar" style={{ left: `${left}%`, width: `${width}%` }} />
                      </div>
                      <span className="week-max">{Math.round(d.stats.tmax)}°</span>
                    </li>
                  )
                })
              })()}
            </ul>
          </section>
    
            </>
      )}
      {key === 'radar' && (
        <>
          <section className="card radar-card">
            <h2 className="section-title">비구름 레이더</h2>
            <WhenVisible minHeight={320}>
              <Suspense
                fallback={
                  <div className="radar-map radar-loading" role="status">
                    지도 불러오는 중…
                  </div>
                }
              >
                <RadarMap lat={loc.lat} lon={loc.lon} />
              </Suspense>
            </WhenVisible>
          </section>
        </>
      )}
            {key === 'places' && (
              <ComparePlaces baseLabel={loc.label} baseWx={wx} favorites={favorites} />
                    )}
            {i === 3 && <CoupangBanner id={1020558} template="carousel" height={140} />}
          </div>
        ))}
        <CoupangBanner id={1020557} template="banner" height={90} maxWidth={728} />
        <p className="muted small order-hint">카드나 즐겨찾기 칩을 길게 누르면 순서를 바꿀 수 있어요 · 설정(⚙️)에서도 변경 가능</p>
      </div>

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
        <p className="muted small">
            위치는 날씨를 물어볼 때만 쓰고 기기 안에 둡니다. 알림을 켜면 알림 보낼 지역과 시간만
            저장하고, 알림을 끄면 지웁니다. 방문 수는 이름 없이 숫자만 셉니다.
        </p>
        <p className="muted small">데이터: 기상청 · Open-Meteo · RainViewer · © OpenStreetMap</p>
        <p className="muted small">
          <a
            className="family-link"
            href="https://blog.naver.com/kdy7854/224386138785"
            target="_blank"
            rel="noreferrer"
          >
            v{__APP_VERSION__} 패치 노트
          </a>
        </p>
      </footer>
    </div>
  )
}
