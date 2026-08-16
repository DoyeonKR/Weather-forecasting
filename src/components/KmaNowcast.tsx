// 기상청 초단기 예측 애니메이션(MAPLE) — 실황+예측을 담은 공식 GIF (10분 단위 갱신)
import { useMemo, useState } from 'react'

/** KST 기준 10분 단위로 내림한 시각 문자열(YYYYMMDDHHmm). back 은 10분 단위 과거 이동 */
function kstFrameTime(back: number): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  kst.setUTCMinutes(Math.floor(kst.getUTCMinutes() / 10) * 10 - back * 10, 0, 0)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${kst.getUTCFullYear()}${p(kst.getUTCMonth() + 1)}${p(kst.getUTCDate())}${p(kst.getUTCHours())}${p(kst.getUTCMinutes())}`
}

export default function KmaNowcast() {
  // 생성 지연을 감안해 10분 전 프레임부터 시도, 없으면 10분씩 뒤로 (최대 4회)
  const [back, setBack] = useState(1)
  const [dead, setDead] = useState(false)
  const time = useMemo(() => kstFrameTime(back), [back])

  if (dead) return null

  return (
    <section className="card kma-card">
      <h2 className="section-title">기상청 초단기 예측 (실황+예측)</h2>
      <img
        className="kma-gif"
        src={`https://radar.kma.go.kr/n2019/predict/maple_home_${time}.gif`}
        alt="기상청 레이더 실황과 초단기 예측 애니메이션"
        loading="lazy"
        onError={() => {
          if (back < 5) setBack((b) => b + 1)
          else setDead(true)
        }}
      />
      <p className="muted small kma-credit">기상청 기상레이더센터 제공 · 10분마다 갱신</p>
    </section>
  )
}
