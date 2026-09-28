// 쿠팡 파트너스 위젯 — carousel(관심사 기반 개인화 상품) / banner(카테고리 배너)
import { useEffect, useRef, useState } from 'react'

const TRACKING = 'AF2713725'

interface Props {
  /** 파트너스 위젯 id */
  id: number
  template: 'carousel' | 'banner'
  height: number
  maxWidth?: number
}

export default function CoupangBanner({ id, template, height, maxWidth = 680 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    let alive = true
    let tries = 0

    const measure = () => {
      if (!alive) return
      // 테두리·안쪽 여백을 뺀 폭 — 겉 폭으로 재면 광고가 틀 밖으로 14px 삐져나간다
      const cs = getComputedStyle(el)
      const inner = el.clientWidth - parseFloat(cs.paddingLeft || '0') - parseFloat(cs.paddingRight || '0')
      const w = Math.floor(Math.min(inner || el.parentElement?.clientWidth || 0, maxWidth))
      if (w > 0) {
        setWidth(w)
        return
      }
      // 레이아웃이 아직 잡히지 않았으면 몇 번 더 시도 (탭 비활성 등)
      if (tries++ < 10) window.setTimeout(measure, 200)
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => {
      alive = false
      ro.disconnect()
    }
  }, [maxWidth])

  // 가로 배너는 소재가 폭에 맞춰 줄어드는데 높이를 고정해 두면 아래가 흰 띠로 남는다
  // (375 폭에서 소재 39px + 흰 여백 51px). 소재 비율대로 높이를 줄인다.
  const h =
    template === 'banner' && width > 0 ? Math.max(Math.round((width * height) / maxWidth), 36) : height

  const src =
    'https://ads-partners.coupang.com/widgets.html' +
    `?id=${id}&template=${template}&trackingCode=${TRACKING}&subId=` +
    `&width=${width || 320}&height=${h}&tsource=`

  return (
    <div className="cp-slot">
      <span className="cp-label">광고 · 쿠팡 파트너스</span>
      <div className="cp-banner" ref={wrapRef} style={{ minHeight: h }}>
        {width > 0 && (
          <iframe
            src={src}
            width={width}
            height={h}
            title="쿠팡 파트너스 추천 상품"
            loading="lazy"
            scrolling="no"
            referrerPolicy="unsafe-url"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
            style={{ border: 0, display: 'block', borderRadius: 10 }}
          />
        )}
      </div>
    </div>
  )
}
