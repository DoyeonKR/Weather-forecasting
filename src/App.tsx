import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowClockwise,
  ArrowUp,
  CaretDown,
  CloudFog,
  Crosshair,
  CloudSun,
  Drop,
  MapPin,
  ShareNetwork,
  Sun,
  Sunglasses,
  ThermometerSimple,
  TShirt,
  Umbrella,
  Warning,
  Wind,
} from '@phosphor-icons/react'
import { locate, type Located } from './lib/geo'
import { weatherIcon, weatherTone, type UiIcon } from './lib/weatherIcon'
import { loadLast, saveLast } from './lib/lastWeather'
import { GRADE_LABEL, fetchAir, type AirNow } from './lib/air'
import { answeredToday, loadFeel, resetFeel, voteFeel, type FeelVote } from './lib/feel'
import { loadCommute, saveCommute, type CommutePrefs } from './lib/commute'
import { fetchNormal, type Normal } from './lib/normals'
import { fetchWarnings, matchWarnings, type WarnItem } from './lib/warn'
import { AirRow, CommuteCompare, FeelAsk, NormalLine, WarnBanner } from './components/Extras'
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
// 운영자용 — 주소 끝 #stats 로만 연다
const StatsPanel = lazy(() => import('./components/StatsPanel'))
import PlaceBar from './components/PlaceBar'
import Settings from './components/Settings'
import WeatherFx from './components/WeatherFx'
import { DeltaHero, PrecipCompare, TempRangeBars, WindCompare } from './components/CompareGraphic'
import ComparePlaces from './components/ComparePlaces'
import CoupangBanner from './components/CoupangBanner'
import { fetchTodayVisitors, trackEvent } from './lib/track'
import HourlyCard from './components/HourlyCard'
import { loadOrder, saveOrder, type SectionKey } from './lib/sections'
import { useLongPressReorder } from './lib/reorder'
import './App.css'

type Status = 'loading' | 'ready' | 'error'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
/** 방문자 수가 이보다 적으면 숨긴다 — "오늘 2명"은 오히려 믿음을 깎는다 */
const VISITORS_MIN = 10
/** 탭으로 돌아왔을 때 이보다 오래된 날씨면 새로 받는다 */
const STALE_MS = 15 * 60 * 1000

function hhmm(ms: number) {
  return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(ms)
}

function tipIcon(emoji: string): UiIcon {
  if (emoji === '😷') return CloudFog
  if ('🌧️☔☂️🌂🌦️💧'.includes(emoji)) return Umbrella
  if ('☀️🔥🥵🧴🕶️🌡️🌅'.includes(emoji)) return emoji.includes('🕶️') ? Sunglasses : Sun
  if ('💨🍃'.includes(emoji)) return Wind
  if ('👕🧥👚'.includes(emoji)) return TShirt
  return CloudSun
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
  // 지난번에 받아 둔 날씨가 있으면 스피너 없이 그것부터 보여주고 곧바로 새로 받는다
  const [boot] = useState(() => loadLast(selectedId))
  const [loc, setLoc] = useState<Located | null>(boot?.loc ?? null)
  const [wx, setWx] = useState<WeatherData | null>(boot?.wx ?? null)
  const [kmaNow, setKmaNow] = useState<KmaNow | null>(boot?.kmaNow ?? null)
  const [visitors, setVisitors] = useState<number | null>(null)
  const [tipsOpen, setTipsOpen] = useState(true)
  const [sectionOrder, setSectionOrder] = useState<SectionKey[]>(loadOrder)
  /** 헤더의 지역 버튼을 누를 때마다 올려서 검색창을 연다 */
  const [searchSignal, setSearchSignal] = useState(0)
  const [air, setAir] = useState<AirNow | null>(boot?.air ?? null)
  const [feel, setFeel] = useState(loadFeel)
  const [commute, setCommute] = useState<CommutePrefs>(loadCommute)
  const [normal, setNormal] = useState<Normal | null>(null)
  const [warnItems, setWarnItems] = useState<WarnItem[] | null>(null)
  /** 공유·복사 결과를 잠깐 보여주는 한 줄 */
  const [toast, setToast] = useState<string | null>(null)
  const [statsOpen, setStatsOpen] = useState(() => location.hash === '#stats')
  useEffect(() => {
    const onHash = () => setStatsOpen(location.hash === '#stats')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    fetchTodayVisitors().then(setVisitors)
  }, [])

  // 위치 권한 팝업은 사용자가 "현재 위치"를 직접 눌렀을 때만
  const promptRef = useRef(false)
  // 지역을 빠르게 바꿀 때 먼저 시작한 요청이 나중 결과를 덮어쓰지 않도록
  const loadSeq = useRef(0)
  // 지금 화면에 그려진 날씨가 어느 지역 것인지 (실패했을 때 선택을 되돌리는 기준)
  const loadedId = useRef(boot ? selectedId : '')

  const load = useCallback(
    async (id: string) => {
      const seq = ++loadSeq.current
      setStatus('loading')
      // 다른 지역으로 바꿀 때 받아 둔 날씨가 있으면 먼저 보여준다.
      // 지역 이름과 날씨가 같은 출처라 헤더와 본문이 어긋나지 않는다.
      if (loadedId.current !== id) {
        const cached = loadLast(id)
        if (cached) {
          setLoc(cached.loc)
          setWx(cached.wx)
          setKmaNow(cached.kmaNow)
          setAir(cached.air ?? null)
          loadedId.current = id
        } else {
          // 다른 지역의 미세먼지가 남아 있으면 안 된다
          setAir(null)
        }
      }
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
          // 사용자가 "현재 위치"를 눌렀는데 못 가져왔다면 아무 일도 없는 것처럼 보이면 안 된다
          if (where.isFallback && wantPrompt) {
            setToast('내 위치를 가져오지 못했어요. 브라우저의 위치 권한을 확인해주세요')
          }
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
        saveLast(id, { loc: where, wx: weather, kmaNow: obs, air: null })
        // 미세먼지는 날씨를 붙잡지 않도록 따로 받는다 (없으면 줄만 안 보인다)
        fetchAir(where.lat, where.lon).then((a) => {
          if (seq !== loadSeq.current) return
          setAir(a)
          saveLast(id, { loc: where, wx: weather, kmaNow: obs, air: a })
        })
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
    if (id !== selectedId) trackEvent('place_select', { kind: id === 'current' ? 'current' : 'favorite' })
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

  // 평년(최근 10년)과 기상특보 — 지역이 바뀔 때만. 둘 다 실패하면 조용히 숨는다.
  const locLat = loc?.lat
  const locLon = loc?.lon
  useEffect(() => {
    if (locLat === undefined || locLon === undefined) return
    let alive = true
    setNormal(null)
    fetchNormal(locLat, locLon).then((n) => alive && setNormal(n))
    if (inKoreaBounds(locLat, locLon)) fetchWarnings().then((w) => alive && setWarnItems(w))
    else setWarnItems(null)
    return () => {
      alive = false
    }
  }, [locLat, locLon])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3800)
    return () => window.clearTimeout(t)
  }, [toast])

  // 긴 화면에서 맨 위로 돌아가는 버튼 — 조금 내려갔을 때만 나타난다
  const [showTop, setShowTop] = useState(false)
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 900)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function onFeelVote(v: FeelVote) {
    setFeel(voteFeel(v))
    trackEvent('feel_vote', { v })
  }

  function onSetCommute(next: CommutePrefs) {
    setCommute(next)
    saveCommute(next)
    trackEvent('commute_set', { on: next.on, am: next.am, pm: next.pm })
  }

  // 홈 화면 앱은 며칠씩 떠 있다. 다시 볼 때 오래된 날씨면 알아서 새로 받는다.
  const latest = useRef({ load, selectedId, fetchedAt: wx?.fetchedAt ?? 0 })
  latest.current = { load, selectedId, fetchedAt: wx?.fetchedAt ?? 0 }
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const { load: run, selectedId: id, fetchedAt } = latest.current
      if (fetchedAt && Date.now() - fetchedAt > STALE_MS) run(id)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

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
  const tips = funTips({
    today: wx.today,
    yesterday: wx.yesterday,
    uvMax: wx.uvMaxToday,
    airGrade: air?.grade ?? null,
    feelOffset: feel.offset,
  })
  const warnHits = warnItems ? matchWarnings(warnItems, loc.label) : []

  async function onShare() {
    if (!wx || !loc) return
    trackEvent('share')
    // 캔버스 그리기 코드는 누를 때만 받는다
    const { shareCompare } = await import('./lib/share')
    const r = await shareCompare({
      place: loc.label.replace(' (기본 위치)', ''),
      nowTemp: wx.nowTemp,
      condition: now.label,
      delta: wx.nowTemp - wx.yesterdaySameHour,
      today: wx.today,
      yesterday: wx.yesterday,
      air: air ? GRADE_LABEL[air.grade] : null,
    })
    if (r === 'shared') trackEvent('share_done')
    if (r === 'copied') setToast('링크와 요약을 복사했어요')
    else if (r === 'downloaded') setToast('공유 이미지를 저장했어요')
    else if (r === 'failed') setToast('공유하지 못했어요')
  }
  const picks = partnerPicks({ today: wx.today, uvMax: wx.uvMaxToday })
  const alerts = tomorrowAlerts(wx.tomorrow, wx.today)
  const tomorrowLabel = codeLabel(wx.tomorrow.code)

  return (
    <div className={`shell ${theme} ${status === 'loading' ? 'refreshing' : ''}`}>
      <WeatherFx theme={theme} />
      <div className="neon-frame" aria-hidden />
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
              visitors !== null &&
              visitors >= VISITORS_MIN && <span className="visitors">👀 오늘 {visitors}명</span>
            )}
          </span>
        </div>
        <div className="top-right">
          {/* 위치 칩은 "다른 지역 보기" 하나만 한다. 새로고침은 날씨 카드의 기준 시각 버튼. */}
          <button
            type="button"
            className="loc"
            onClick={() => setSearchSignal((n) => n + 1)}
            aria-label={`지역 바꾸기, 지금 ${loc.label}`}
          >
            <MapPin size={17} weight="fill" aria-hidden />
            <span className="loc-name">{loc.label.replace(' (기본 위치)', '(기본)')}</span>
            <CaretDown size={13} weight="bold" aria-hidden />
          </button>
          <Settings
            loc={{ lat: loc.lat, lon: loc.lon, label: loc.label }}
            favorites={favorites}
            homeId={homeId}
            onSetHome={setHome}
            sectionOrder={sectionOrder}
            onSetOrder={applyOrder}
            commute={commute}
            onSetCommute={onSetCommute}
            feelOffset={feel.offset}
            onResetFeel={() => setFeel(resetFeel())}
            visitors={visitors}
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
        openSearchSignal={searchSignal}
        onReorder={(ids) => {
          setFavorites((prev) => {
            const map = new Map(prev.map((f) => [f.id, f]))
            const next = ids.map((id) => map.get(id)!).filter(Boolean)
            saveFavorites(next)
            return next
          })
        }}
      />

      {loc.isFallback && selectedId === 'current' && (
        <button type="button" className="fallback-note" onClick={() => selectPlace('current')}>
          <Crosshair size={18} weight="bold" aria-hidden />
          <span>
            위치를 몰라 <b>서울</b> 기준으로 보여드리고 있어요
            <small>눌러서 내 위치로 보기</small>
          </span>
        </button>
      )}

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
            <WarnBanner hits={warnHits} />
            <div className="hero-date">
              <span>
                {new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit', weekday: 'long' }).format(new Date())}
              </span>
              <span className="hero-actions">
              <button type="button" className="hero-updated" onClick={onShare} aria-label="어제와 비교한 오늘 날씨 공유하기">
                <ShareNetwork size={14} weight="bold" aria-hidden /> 공유
              </button>
              <button
                type="button"
                className={`hero-updated ${Date.now() - wx.fetchedAt > STALE_MS ? 'stale' : ''}`}
                onClick={() => {
                  trackEvent('refresh')
                  selectPlace(selectedId)
                }}
                disabled={status === 'loading'}
                aria-label={
                  status === 'loading' ? '날씨 새로 받는 중' : `${hhmm(wx.fetchedAt)} 기준 날씨, 눌러서 새로고침`
                }
              >
                <ArrowClockwise size={14} weight="bold" aria-hidden className={status === 'loading' ? 'spin' : ''} />
                {status === 'loading' ? '갱신 중…' : `${hhmm(wx.fetchedAt)} 기준`}
              </button>
              </span>
            </div>
            <div className="hero-main">
              {(() => {
                const HeroIcon = weatherIcon(now.label, wx.nowIsDay)
                return <HeroIcon size={112} weight="duotone" aria-hidden />
              })()}
              <div className="hero-info">
                <div className="hero-temp">{round1(wx.nowTemp).toFixed(1)}°</div>
                <div className="hero-condition">{now.label}</div>
              </div>
            </div>
            <DeltaHero nowTemp={wx.nowTemp} yesterdaySameHour={wx.yesterdaySameHour} />
            <div className="hero-subs">
              <div className="stat-chips">
                <div className="stat-chip">
                  <ThermometerSimple className="stat-chip-icon warm-icon" size={25} weight="duotone" aria-hidden />
                  <span className="stat-chip-label">체감</span>
                  <span className="stat-chip-value">{round1(wx.nowApparent).toFixed(1)}°</span>
                </div>
                <div className="stat-chip">
                  <Drop className="stat-chip-icon cold-icon" size={25} weight="duotone" aria-hidden />
                  <span className="stat-chip-label">습도</span>
                  <span className="stat-chip-value">{Math.round(kmaNow?.reh ?? wx.nowHumidity)}%</span>
                </div>
                <div className="stat-chip">
                  <Umbrella className="stat-chip-icon rain-icon" size={25} weight="duotone" aria-hidden />
                  <span className="stat-chip-label">강수확률</span>
                  <span className="stat-chip-value">{wx.today.precipProbMax ?? '?'}%</span>
                </div>
                <div className="stat-chip">
                  <Wind className="stat-chip-icon wind-icon" size={25} weight="duotone" aria-hidden />
                  <span className="stat-chip-label">바람</span>
                  <span className="stat-chip-value">
                    {Math.round(wx.today.windMax ?? 0)}km/h
                  </span>
                </div>
              </div>
              {air && <AirRow air={air} />}
            </div>
            <HourlyCard wx={wx} embedded />
          </section>
            </>
      )}
      {key === 'prep' && (tips.length > 0 || picks.length > 0) && (
        <>
          {/* 날씨 카드 하나에 다 넣었더니 모바일에서 첫 카드만 1,500px 가 넘었다. 준비물은 따로 */}
          <section className="card prep-card">
            {tips.length > 0 && (
              <>
                <h2 className="section-title">오늘의 준비</h2>
                <ul className="tips tips-visual">
                  {tips.map((t) => {
                    const TipIcon = tipIcon(t.emoji)
                    return (
                    <li key={t.title} className="tip">
                      <span className="tip-icon" aria-hidden><TipIcon size={38} weight="duotone" /></span>
                      <div className="tip-text">
                        <div className="tip-title">{t.title}</div>
                        {tipsOpen && <div className="tip-body">{t.body}</div>}
                      </div>
                    </li>)
                  })}
                </ul>
                <button
                  type="button"
                  className="tips-more"
                  aria-expanded={tipsOpen}
                  onClick={() => setTipsOpen((o) => !o)}
                >
                  {tipsOpen ? '접기 ▲' : '자세히 보기 ▼'}
                </button>
                <FeelAsk
                  answered={answeredToday(feel)}
                  offset={feel.offset}
                  onVote={onFeelVote}
                  todayClothes={tips.find((t) => t.kind === 'clothes')?.title ?? null}
                />
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
            <CommuteCompare wx={wx} prefs={commute} />
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
              </h3>
              <PrecipCompare today={wx.today} yesterday={wx.yesterday} />
            </div>
            <div className="cmp-sec">
              <h3 className="cmp-title">
                <Wind size={16} weight="duotone" className="wind-icon" aria-hidden /> 바람
              </h3>
              <WindCompare today={wx.today} yesterday={wx.yesterday} />
            </div>
          </section>
    
            </>
      )}
      {key === 'tomorrow' && (
        <>
          <section className="card">
            <h2 className="section-title">내일은 오늘보다</h2>
            <div className="tomorrow-row">
              <span className={`tomorrow-emoji wi-${weatherTone(tomorrowLabel.label)}`} aria-hidden>
                {(() => {
                  const TomorrowIcon = weatherIcon(tomorrowLabel.label)
                  return <TomorrowIcon size={40} weight="duotone" />
                })()}
              </span>
              <div className="tomorrow-info">
                <div>
                  {tomorrowLabel.label} · {round1(wx.tomorrow.tmin).toFixed(1)}° ~ {round1(wx.tomorrow.tmax).toFixed(1)}°
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
                  <li key={a}>
                    <Warning size={16} weight="duotone" aria-hidden /> {a}
                  </li>
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
                  const DayIcon = weatherIcon(lb.label)
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
                      <span className={`week-emoji wi-${weatherTone(lb.label)}`} role="img" aria-label={lb.label}>
                        <DayIcon size={22} weight="duotone" aria-hidden />
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
                <RadarMap
                  lat={loc.lat}
                  lon={loc.lon}
                  tempC={wx.nowTemp}
                  observedRaining={kmaNow ? (kmaNow.pty ?? 0) > 0 || (kmaNow.rn1 ?? 0) > 0 : null}
                />
              </Suspense>
            </WhenVisible>
          </section>
        </>
      )}
            {key === 'places' && (
              <ComparePlaces baseLabel={loc.label} baseWx={wx} favorites={favorites} />
                    )}
            {/* 카드가 하나 늘어서 3 → 4 (여전히 '이번 주' 아래) */}
            {i === 4 && <CoupangBanner id={1020558} template="carousel" height={140} />}
          </div>
        ))}
        <CoupangBanner id={1020557} template="banner" height={90} maxWidth={728} />
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
            저장하고, 알림을 끄면 지웁니다. 방문 수와 어떤 버튼이 쓰이는지는 이름 없이 숫자만 셉니다.
        </p>
        <p className="muted small">
          데이터: 기상청 · 에어코리아 · Open-Meteo · RainViewer · © OpenStreetMap · 미세먼지에 '예측 모델'이
          붙은 값은 CAMS 모델이라 측정소 값과 다를 수 있어요
        </p>
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
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      {showTop && (
        <button
          type="button"
          className="to-top"
          aria-label="맨 위로"
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
            })
          }
        >
          <ArrowUp size={20} weight="bold" aria-hidden />
        </button>
      )}
      {statsOpen && (
        <Suspense fallback={null}>
          <StatsPanel
            onClose={() => {
              history.replaceState(null, '', location.pathname + location.search)
              setStatsOpen(false)
            }}
          />
        </Suspense>
      )}
    </div>
  )
}
