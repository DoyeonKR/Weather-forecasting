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
    const update = () => setWidth(Math.min(Math.floor(el.clientWidth), maxWidth))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [maxWidth])

  const src =
    'https://ads-partners.coupang.com/widgets.html' +
    `?id=${id}&template=${template}&trackingCode=${TRACKING}&subId=` +
    `&width=${width || 320}&height=${height}&tsource=`

  return (
    <div className="cp-banner" ref={wrapRef}>
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
