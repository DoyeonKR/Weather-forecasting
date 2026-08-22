// 꾹 눌러(롱탭) 드래그로 순서 바꾸기 — 세로(섹션)·가로(칩) 공용 훅
import { useCallback, useRef, useState, type PointerEvent as RPointerEvent } from 'react'

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
}

const INTERACTIVE = 'button, a, input, select, textarea, iframe, .radar-map, .leaflet-container, .range-track'

export function useLongPressReorder<T extends string>({ order, onChange, axis, holdMs = 550, attr = 'data-reorder-id' }: Options<T>) {
  const [active, setActive] = useState(false) // 정렬 모드
  const [dragId, setDragId] = useState<T | null>(null)
  const timerRef = useRef<number | null>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const orderRef = useRef(order)
  orderRef.current = order

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

  const handlers: Handlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp: end,
    onPointerCancel: end,
  }

  const exit = useCallback(() => {
    end()
    setActive(false)
  }, [end])

  return { active, dragId, handlers, exit }
}
