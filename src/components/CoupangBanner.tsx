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
      const rect = el.getBoundingClientRect().width
      const w = Math.floor(Math.min(rect || el.clientWidth || el.parentElement?.clientWidth || 0, maxWidth))
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

  const src =
    'https://ads-partners.coupang.com/widgets.html' +
    `?id=${id}&template=${template}&trackingCode=${TRACKING}&subId=` +
    `&width=${width || 320}&height=${height}&tsource=`

  return (
    <div className="cp-banner" ref={wrapRef} style={{ minHeight: height }}>
      {width > 0 && (
        <iframe
          src={src}
          width={width}
          height={height}
          title="쿠팡 파트너스 추천 상품"
          loading="lazy"
          scrolling="no"
          referrerPolicy="unsafe-url"
          style={{ border: 0, display: 'block', borderRadius: 12 }}
        />
      )}
    </div>
  )
}
