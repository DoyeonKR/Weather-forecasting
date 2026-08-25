// 꾹 눌러(롱탭) 드래그로 순서 바꾸기 — 세로(섹션)·가로(칩) 공용 훅
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as RMouseEvent,
  type PointerEvent as RPointerEvent,
} from 'react'

interface Options<T extends string> {
  order: T[]
  onChange: (next: T[]) => void
  axis: 'x' | 'y'
  /** 롱탭 인식 시간 ms */
  holdMs?: number
  /** 드래그 대상 요소를 찾는 data 속성 이름 */
  attr?: string
}

interface Handlers {
  onPointerDown: (e: RPointerEvent<HTMLElement>) => void
  onPointerMove: (e: RPointerEvent<HTMLElement>) => void
  onPointerUp: (e: RPointerEvent<HTMLElement>) => void
  onPointerCancel: (e: RPointerEvent<HTMLElement>) => void
  onClickCapture: (e: RMouseEvent<HTMLElement>) => void
}

const INTERACTIVE = 'button, a, input, select, textarea, iframe, .radar-map, .leaflet-container, .range-track'

export function useLongPressReorder<T extends string>({ order, onChange, axis, holdMs = 550, attr = 'data-reorder-id' }: Options<T>) {
  const [active, setActive] = useState(false) // 정렬 모드
  const [dragId, setDragId] = useState<T | null>(null)
  const timerRef = useRef<number | null>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const orderRef = useRef(order)
  orderRef.current = order
  const containerRef = useRef<HTMLElement | null>(null)
  const prevPos = useRef<Map<string, { left: number; top: number }>>(new Map())
  const rafRef = useRef<number | null>(null)
  const flipTimerRef = useRef<number | null>(null)

  // FLIP: 순서가 바뀌면 이전 위치에서 새 위치로 미끄러지는 애니메이션
  // 측정은 offsetLeft/Top 으로 한다. getBoundingClientRect 는 진행 중인 transform 과
  // 페이지 스크롤이 섞여, 연속 재정렬 때 카드가 반대로 튀는 원인이 된다.
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    const items = Array.from(container.querySelectorAll<HTMLElement>(`[${attr}]`))
    const newPos = new Map<string, { left: number; top: number }>()
    for (const el of items) {
      newPos.set(el.getAttribute(attr)!, { left: el.offsetLeft, top: el.offsetTop })
    }
    const moved: HTMLElement[] = []
    for (const el of items) {
      const id = el.getAttribute(attr)!
      const prev = prevPos.current.get(id)
      const next = newPos.get(id)!
      if (!prev) continue
      const dx = prev.left - next.left
      const dy = prev.top - next.top
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue
      el.style.transition = 'none'
      el.style.transform = `translate(${dx}px, ${dy}px)`
      moved.push(el)
    }
    prevPos.current = newPos
    if (moved.length === 0) return

    let done = false
    const release = (animate: boolean) => {
      if (done) return
      done = true
      for (const el of moved) {
        el.style.transition = animate ? 'transform 0.32s cubic-bezier(0.2, 0, 0, 1)' : 'none'
        el.style.transform = ''
      }
    }

    // 앞선 런의 콜백이 뒤늦게 새 transform 을 지우지 않도록 한 번만 예약한다
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    if (flipTimerRef.current !== null) window.clearTimeout(flipTimerRef.current)
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      release(true)
    })
    // 탭이 숨겨져 rAF 가 오지 않으면 카드가 어긋난 채 굳으므로 안전장치를 둔다
    flipTimerRef.current = window.setTimeout(() => {
      flipTimerRef.current = null
      release(false)
    }, 400)
  }, [order, attr])

  // 언마운트 시 예약된 프레임·타이머 정리
  useLayoutEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      if (flipTimerRef.current !== null) window.clearTimeout(flipTimerRef.current)
    },
    [],
  )

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const idOf = (el: Element | null): T | null => {
    const host = el?.closest(`[${attr}]`) as HTMLElement | null
    return (host?.getAttribute(attr) as T | null) ?? null
  }

  const onPointerDown = useCallback(
    (e: RPointerEvent<HTMLElement>) => {
      const target = e.target as HTMLElement
      const id = idOf(target)
      if (!id) return
      // 정렬 모드가 아닐 때 버튼·입력·지도 위에서는 롱탭 시작 안 함
      if (!active && target.closest(INTERACTIVE)) return
      startRef.current = { x: e.clientX, y: e.clientY }
      if (active) {
        setDragId(id)
        ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
        return
      }
      clearTimer()
      timerRef.current = window.setTimeout(() => {
        setActive(true)
        setDragId(id)
        try {
          navigator.vibrate?.(12)
        } catch {
          // 무시
        }
      }, holdMs)
    },
    [active, holdMs], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const onPointerMove = useCallback(
    (e: RPointerEvent<HTMLElement>) => {
      // 롱탭 대기 중 손가락이 많이 움직이면(스크롤) 취소
      if (!active && startRef.current) {
        const dx = Math.abs(e.clientX - startRef.current.x)
        const dy = Math.abs(e.clientY - startRef.current.y)
        if (dx > 8 || dy > 8) clearTimer()
        return
      }
      if (!active || !dragId) return
      e.preventDefault()
      const container = e.currentTarget as HTMLElement
      const items = Array.from(container.querySelectorAll<HTMLElement>(`[${attr}]`))
      const from = orderRef.current.indexOf(dragId)
      if (from < 0) return
      const pos = axis === 'y' ? e.clientY : e.clientX
      let to = from
      for (let i = 0; i < items.length; i++) {
        const r = items[i].getBoundingClientRect()
        const mid = axis === 'y' ? r.top + r.height / 2 : r.left + r.width / 2
        const idx = orderRef.current.indexOf(items[i].getAttribute(attr) as T)
        if (idx < from && pos < mid) {
          to = Math.min(to, idx)
        } else if (idx > from && pos > mid) {
          to = Math.max(to, idx)
        }
      }
      if (to !== from) {
        const next = [...orderRef.current]
        const [it] = next.splice(from, 1)
        next.splice(to, 0, it)
        onChange(next)
      }
      // 화면 가장자리 자동 스크롤 (세로만)
      if (axis === 'y') {
        const vh = window.innerHeight
        if (e.clientY < 70) window.scrollBy(0, -12)
        else if (e.clientY > vh - 70) window.scrollBy(0, 12)
      }
    },
    [active, dragId, axis, attr, onChange],
  )

  const end = useCallback(() => {
    clearTimer()
    startRef.current = null
    setDragId(null)
  }, [])

  // 정렬 모드에서 탭이 그대로 onClick 을 실행해 지역이 바뀌는 것을 막는다
  const onClickCapture = useCallback(
    (e: RMouseEvent<HTMLElement>) => {
      if (!active) return
      const t = e.target as HTMLElement
      if (t.closest('[data-reorder-exit]')) return
      e.preventDefault()
      e.stopPropagation()
    },
    [active],
  )

  const setContainer = useCallback((el: HTMLElement | null) => {
    containerRef.current = el
  }, [])

  const handlers: Handlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp: end,
    onPointerCancel: end,
    onClickCapture,
  }

  const exit = useCallback(() => {
    end()
    setActive(false)
  }, [end])

  return { active, dragId, handlers, exit, setContainer }
}
