// 시간대별 기온·강수 — 앞으로 24시간 기온 곡선(어제 같은 시간대 점선 겹침) + 강수량 막대
import type { WeatherData } from '../lib/weather'

interface Props {
  wx: WeatherData
}

const W = 340
const H = 150
const PAD_L = 8
const PAD_R = 8
const TOP = 22
const BOTTOM = 38 // 강수 막대 + 시간 라벨 영역

export default function HourlyCard({ wx }: Props) {
  const { time, temp, precip } = wx.hourly
  // hourly 는 어제 00시부터 시작. 현재 시각 인덱스 = 24 + 현재 시
  const nowHour = new Date().getHours()
  const start = 24 + nowHour
  const N = 24
  const idx = Array.from({ length: N }, (_, i) => start + i).filter((i) => i < temp.length)
  if (idx.length < 6) return null
  const tToday = idx.map((i) => temp[i])
  const tYest = idx.map((i) => temp[i - 24])
  const pr = idx.map((i) => precip[i] ?? 0)

  const all = [...tToday, ...tYest].filter((v) => typeof v === 'number' && !Number.isNaN(v))
  const lo = Math.floor(Math.min(...all)) - 1
  const hi = Math.ceil(Math.max(...all)) + 1
  const span = Math.max(hi - lo, 4)
  const innerW = W - PAD_L - PAD_R
  const innerH = H - TOP - BOTTOM
  const x = (i: number) => PAD_L + (i / (idx.length - 1)) * innerW
  const y = (t: number) => TOP + (1 - (t - lo) / span) * innerH

  const path = (arr: number[]) =>
    arr.map((t, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(t).toFixed(1)}`).join(' ')

  const maxP = Math.max(...pr, 1)
  const barW = Math.max(innerW / idx.length - 2, 3)
  const tMin = Math.min(...tToday)
  const tMax = Math.max(...tToday)
  const iMin = tToday.indexOf(tMin)
  const iMax = tToday.indexOf(tMax)

  return (
    <section className="card hourly-card">
      <h2 className="section-title">시간대별 기온·강수</h2>
      <div className="hourly-legend">
        <span>
          <i className="hl today" /> 오늘
        </span>
        <span>
          <i className="hl yest" /> 어제 같은 시간
        </span>
        <span>
          <i className="hl rain" /> 강수량
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="hourly-svg" role="img" aria-label="앞으로 24시간 기온과 강수량">
        {/* 강수 막대 */}
        {pr.map((p, i) =>
          p > 0 ? (
            <rect
              key={`p${i}`}
              x={x(i) - barW / 2}
              y={H - BOTTOM + 4 + (1 - p / maxP) * 16}
              width={barW}
              height={(p / maxP) * 16}
              rx={1.5}
              className="hourly-bar"
            />
          ) : null,
        )}
        {/* 어제 점선 */}
        <path d={path(tYest)} className="hourly-line yest" />
        {/* 오늘 실선 */}
        <path d={path(tToday)} className="hourly-line today" />
        {/* 지금 지점 */}
        <circle cx={x(0)} cy={y(tToday[0])} r={3.5} className="hourly-now" />
        {/* 최고/최저 라벨 */}
        <text x={x(iMax)} y={y(tMax) - 6} className="hourly-temp-label max" textAnchor="middle">
          {Math.round(tMax)}°
        </text>
        <text x={x(iMin)} y={y(tMin) + 14} className="hourly-temp-label min" textAnchor="middle">
          {Math.round(tMin)}°
        </text>
        {/* 시간 라벨 (3시간 간격) */}
        {idx.map((i, k) => {
          if (k % 3 !== 0) return null
          const h = new Date(time[i]).getHours()
          return (
            <text key={`h${k}`} x={x(k)} y={H - 4} className="hourly-hour" textAnchor="middle">
              {k === 0 ? '지금' : `${h}시`}
            </text>
          )
        })}
      </svg>
    </section>
  )
}
