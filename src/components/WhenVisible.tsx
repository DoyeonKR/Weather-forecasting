// 화면에 들어올 때까지 무거운 자식을 만들지 않는다.
// 레이더 지도는 지도 라이브러리와 GIF 해석기까지 160KB 가 넘는데,
// 아래로 내려보지 않는 사람이 훨씬 많다.
import { useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** 자리를 미리 잡아둘 높이 (내용이 들어올 때 화면이 튀지 않게) */
  minHeight: number
  /** 이만큼 남았을 때 미리 불러오기 시작 */
  margin?: number
}

export default function WhenVisible({ children, minHeight, margin = 400 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (shown) return
    const el = ref.current
    if (!el) return

    // 관찰자 하나에만 맡기지 않는다. 화면을 그리지 않는 상태에서는 콜백이 오지 않아
    // 내려가도 지도가 끝내 안 나오는 경우가 생긴다. 좌표는 그런 것과 무관하게 읽힌다.
    const near = () => {
      const r = el.getBoundingClientRect()
      return r.top < window.innerHeight + margin && r.bottom > -margin
    }
    if (near()) {
      setShown(true)
      return
    }

    const check = () => {
      if (near()) setShown(true)
    }
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)

    // 스크롤 없이 순서만 바뀌어 올라오는 경우는 관찰자가 잡아준다
    let io: IntersectionObserver | null = null
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) setShown(true)
        },
        { rootMargin: `${margin}px` },
      )
      io.observe(el)
    }

    return () => {
      window.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
      io?.disconnect()
    }
  }, [shown, margin])

  if (shown) return <>{children}</>
  return <div ref={ref} style={{ minHeight }} aria-hidden />
}
