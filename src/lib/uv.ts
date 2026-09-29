/** 자외선 지수 등급 (WHO 기준) */
export function uvLabel(uv: number): string {
  if (uv < 3) return '낮음'
  if (uv < 6) return '보통'
  if (uv < 8) return '높음'
  if (uv < 11) return '매우 높음'
  return '위험'
}
