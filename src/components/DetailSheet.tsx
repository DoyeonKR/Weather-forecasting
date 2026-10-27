// 요약 카드를 누르면 아래에서 올라오는 상세 시트 — 예전 섹션 카드 내용을 그대로 담는다.
// Esc·배경 누르기·닫기 버튼으로 닫고, 열려 있는 동안 뒤 화면은 스크롤되지 않는다.
import { useEffect, useRef, type ReactNode } from 'react'
import { X } from '@phosphor-icons/react'

export default function DetailSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      prevFocus?.focus?.()
    }
  }, [onClose])

  return (
    <div className="dsheet-backdrop" onClick={onClose}>
      <div
        ref={panelRef}
        className="dsheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dsheet-bar">
          <span className="dsheet-grip" aria-hidden />
          <button type="button" className="dsheet-close" onClick={onClose} aria-label="닫기">
            <X size={18} weight="bold" aria-hidden />
          </button>
        </div>
        <div className="dsheet-body">{children}</div>
      </div>
    </div>
  )
}
