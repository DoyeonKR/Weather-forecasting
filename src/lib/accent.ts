// 포인트 컬러 테마 — 컴포넌트와 분리해야 개발 중 HMR 이 깨지지 않는다
export const ACCENT_KEY = 'eojeboda:accent'

export const ACCENTS = [
  { id: 'blue', name: '파랑', color: '#2f81f7' },
  { id: 'mint', name: '민트', color: '#10b981' },
  { id: 'purple', name: '퍼플', color: '#8b5cf6' },
  { id: 'orange', name: '오렌지', color: '#f97316' },
  { id: 'pink', name: '핑크', color: '#ec4899' },
] as const

export function applySavedAccent(): void {
  try {
    const saved = localStorage.getItem(ACCENT_KEY)
    if (saved && saved !== 'blue') document.documentElement.dataset.accent = saved
  } catch {
    // 무시
  }
}
