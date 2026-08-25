// 지역 vs 지역 비교 — 현재 날씨와 1주일치를 나란히
import { useState } from 'react'
import { fetchWeather, type WeatherData } from '../lib/weather'
import { searchPlaces, type Place } from '../lib/places'
import { codeLabel, round1 } from '../lib/compare'

interface Props {
  baseLabel: string
  baseWx: WeatherData
  favorites: Place[]
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** 받침 유무에 따라 이/가 선택 */
function iGa(name: string): string {
  const code = name.charCodeAt(name.length - 1)
  if (code < 0xac00 || code > 0xd7a3) return '이'
  return (code - 0xac00) % 28 === 0 ? '가' : '이'
}

export default function ComparePlaces({ baseLabel, baseWx, favorites }: Props) {
  const [other, setOther] = useState<Place | null>(null)
  const [otherWx, setOtherWx] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [busy, setBusy] = useState(false)

  async function pick(p: Place) {
    setQuery('')
    setResults([])
    setOther(p)
    setLoading(true)
    try {
      setOtherWx(await fetchWeather(p.lat, p.lon))
    } catch {
      setOtherWx(null)
    } finally {
      setLoading(false)
    }
  }

  async function runSearch() {
    const q = query.trim()
    if (!q) return
    setBusy(true)
    try {
      setResults(await searchPlaces(q))
    } finally {
      setBusy(false)
    }
  }

  const shortBase = baseLabel.replace(' (기본 위치)', '').split(' ').pop() ?? baseLabel

  return (
    <section className="card">
      <h2 className="section-title">지역 비교</h2>

      <div className="vs-pick">
        <span className="vs-base-chip">{shortBase}</span>
        <span className="muted small">vs</span>
        {favorites
          .filter((f) => f.name !== baseLabel)
          .slice(0, 3)
          .map((f) => (
            <button
              key={f.id}
              type="button"
              className={`chip ${other?.id === f.id ? 'on' : ''}`}
              onClick={() => pick(f)}
            >
              {f.name}
            </button>
          ))}
      </div>
      <div className="search-row vs-search">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') runSearch()
          }}
          placeholder="🔍 비교할 지역 검색"
          className="search-input"
          enterKeyHint="search"
        />
        <button type="button" className="search-btn" onClick={runSearch} disabled={busy}>
          {busy ? '…' : '검색'}
        </button>
      </div>
      {results.length > 0 && (
        <ul className="search-results">
          {results.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => pick(r)}>
                📍 {r.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {loading && <p className="muted small">비교 데이터를 불러오는 중…</p>}

      {other && otherWx && !loading && (
        <>
          <div className="vs-now">
            <div className="vs-col">
              <span className="vs-name a">{shortBase}</span>
              <span className="vs-emoji" aria-hidden>
                {codeLabel(baseWx.nowCode).emoji}
              </span>
              <span className="vs-temp">{round1(baseWx.nowTemp)}°</span>
              <span className="muted small">
                체감 {round1(baseWx.nowApparent)}° · 습도 {Math.round(baseWx.nowHumidity)}%
              </span>
            </div>
            <div className="vs-mid">
              {(() => {
                const d = round1(baseWx.nowTemp - otherWx.nowTemp)
                if (Math.abs(d) < 0.5) return <span className="delta same">비슷</span>
                return (
                  <span className={`delta ${d > 0 ? 'up' : 'down'}`}>
                    {shortBase}
                    {iGa(shortBase)} {Math.abs(d)}° {d > 0 ? '높음' : '낮음'}
                  </span>
                )
              })()}
            </div>
            <div className="vs-col">
              <span className="vs-name b">{other.name}</span>
              <span className="vs-emoji" aria-hidden>
                {codeLabel(otherWx.nowCode).emoji}
              </span>
              <span className="vs-temp">{round1(otherWx.nowTemp)}°</span>
              <span className="muted small">
                체감 {round1(otherWx.nowApparent)}° · 습도 {Math.round(otherWx.nowHumidity)}%
              </span>
            </div>
          </div>

          <div className="vs-legend">
            <span>
              <i className="vs-dot a" /> {shortBase}
            </span>
            <span>
              <i className="vs-dot b" /> {other.name}
            </span>
          </div>
          <ul className="vs-week">
            {(() => {
              const all = [...baseWx.week, ...otherWx.week]
              const lo = Math.floor(Math.min(...all.map((d) => d.stats.tmin))) - 1
              const hi = Math.ceil(Math.max(...all.map((d) => d.stats.tmax))) + 1
              const span = hi - lo
              const x = (t: number) => ((t - lo) / span) * 100
              const otherByDate = new Map(otherWx.week.map((d) => [d.date, d.stats]))
              return baseWx.week.map((d, i) => {
                // 시간대가 다른 지역도 같은 날짜끼리 비교 (인덱스 정렬 금지)
                const oStats = otherByDate.get(d.date)
                if (!oStats) return null
                const dt = new Date(`${d.date}T00:00:00`)
                const dayName = i === 0 ? '오늘' : WEEKDAYS[dt.getDay()]
                const bar = (s: { tmin: number; tmax: number }, cls: string) => (
                  <div className="vs-track">
                    <span className="vs-min">{Math.round(s.tmin)}°</span>
                    <div className="range-track vs-range">
                      <div
                        className={`range-bar ${cls}`}
                        style={{
                          left: `${x(s.tmin)}%`,
                          width: `${Math.max(x(s.tmax) - x(s.tmin), 4)}%`,
                        }}
                      />
                    </div>
                    <span className="vs-max">{Math.round(s.tmax)}°</span>
                  </div>
                )
                return (
                  <li key={d.date}>
                    <span className="vs-day">{dayName}</span>
                    <div className="vs-bars">
                      {bar(d.stats, 'today')}
                      {bar(oStats, 'other')}
                    </div>
                  </li>
                )
              })
            })()}
          </ul>
        </>
      )}
    </section>
  )
}
