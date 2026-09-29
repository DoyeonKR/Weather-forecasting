// "어제와 비교" 공유 카드 — 캔버스로 그림을 만들어 기기 공유 시트로 보낸다.
// 서버가 필요 없다. 파일 공유가 안 되는 브라우저는 링크 공유 → 링크 복사 → 그림 저장 순으로 내려간다.

export interface ShareInput {
  place: string
  nowTemp: number
  condition: string
  /** 지금 - 어제 같은 시각 */
  delta: number
  today: { tmin: number; tmax: number }
  yesterday: { tmin: number; tmax: number }
  air?: string | null
}

/** sheet: 기기 공유 창을 못 써서 화면 시트로 넘김(그림·복사 버튼) */
export type ShareResult = 'shared' | 'sheet' | 'cancelled'

export const SHARE_URL = 'https://doyeonkr.github.io/Weather-forecasting/?ref=share'
const FONT = "'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif"

/** 한 줄 요약 — 카드 제목과 공유 문구에 같이 쓴다 */
export function headline(delta: number): string {
  const d = Math.round(Math.abs(delta) * 10) / 10
  if (d < 0.5) return '어제 이 시간과 비슷해요'
  return delta > 0 ? `어제보다 ${d}° 따뜻해요` : `어제보다 ${d}° 추워요`
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export async function drawShareCard(s: ShareInput): Promise<Blob | null> {
  const W = 1080
  const H = 1350
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d')
  if (!ctx) return null
  try {
    await document.fonts?.ready
  } catch {
    // 글꼴을 못 기다려도 기본 글꼴로 그린다
  }
  const warm = s.delta >= 0.5
  const cold = s.delta <= -0.5
  const accent = warm ? '#ff7a66' : cold ? '#5fb0ff' : '#c9d6ea'

  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#0f1f45')
  bg.addColorStop(1, '#070d1c')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = '#9fb3d4'
  ctx.font = `700 40px ${FONT}`
  ctx.fillText('무능한 날씨예측기', 80, 130)
  const date = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date())
  ctx.font = `500 36px ${FONT}`
  ctx.fillText(`${s.place.slice(0, 18)} · ${date}`, 80, 190)

  // 핵심 한 줄
  ctx.fillStyle = '#ffffff'
  ctx.font = `800 64px ${FONT}`
  ctx.fillText('지금', 80, 380)
  ctx.fillStyle = accent
  const head = headline(s.delta)
  // 첫 낱말과 나머지 두 줄로. 폭을 넘으면 글씨를 줄인다.
  const words = head.split(' ')
  const fit = (text: string, y: number) => {
    let size = 118
    ctx.font = `900 ${size}px ${FONT}`
    while (size > 60 && ctx.measureText(text).width > W - 160) {
      size -= 6
      ctx.font = `900 ${size}px ${FONT}`
    }
    ctx.fillText(text, 80, y)
  }
  fit(words[0], 520)
  fit(words.slice(1).join(' '), 660)

  ctx.fillStyle = '#dfe8f7'
  ctx.font = `700 54px ${FONT}`
  ctx.fillText(`${(Math.round(s.nowTemp * 10) / 10).toFixed(1)}° · ${s.condition}`, 80, 770)

  // 오늘 vs 어제 범위 막대 (같은 눈금)
  const lo = Math.floor(Math.min(s.today.tmin, s.yesterday.tmin)) - 1
  const hi = Math.ceil(Math.max(s.today.tmax, s.yesterday.tmax)) + 1
  const bx = 300
  const bw = W - bx - 270
  const xOf = (t: number) => bx + ((t - lo) / (hi - lo)) * bw
  const rows: [string, { tmin: number; tmax: number }, string][] = [
    ['오늘', s.today, accent],
    ['어제', s.yesterday, '#8b98ad'],
  ]
  rows.forEach(([name, r, color], k) => {
    const y = 900 + k * 120
    ctx.fillStyle = '#b8c6dc'
    ctx.font = `700 42px ${FONT}`
    ctx.fillText(name, 80, y + 14)
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    roundRect(ctx, bx, y - 18, bw, 36, 18)
    ctx.fill()
    ctx.fillStyle = color
    roundRect(ctx, xOf(r.tmin), y - 18, Math.max(xOf(r.tmax) - xOf(r.tmin), 36), 36, 18)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font = `700 38px ${FONT}`
    ctx.fillText(`${Math.round(r.tmin)}°~${Math.round(r.tmax)}°`, bx + bw + 24, y + 14)
  })

  if (s.air) {
    ctx.fillStyle = '#b8c6dc'
    ctx.font = `600 38px ${FONT}`
    ctx.fillText(`미세먼지 ${s.air}`, 80, 1170)
  }

  ctx.fillStyle = '#6f84a6'
  ctx.font = `500 32px ${FONT}`
  ctx.fillText('doyeonkr.github.io/Weather-forecasting', 80, 1270)

  return await new Promise((resolve) => cv.toBlob((b) => resolve(b), 'image/png'))
}

export async function shareCompare(
  s: ShareInput,
  /** 기기 공유 창을 못 쓸 때 — 앱이 시트를 띄운다. 그림을 못 만들었어도 문구는 보낸다 */
  onSheet: (blob: Blob | null, text: string) => void,
): Promise<ShareResult> {
  const text = `${s.place} ${headline(s.delta)} (지금 ${Math.round(s.nowTemp)}°, ${s.condition})`
  const blob = await drawShareCard(s).catch(() => null)
  const file = blob ? new File([blob], 'eojeboda-today.png', { type: 'image/png' }) : null
  try {
    if (file && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: `${text}\n${SHARE_URL}` })
      return 'shared'
    }
    if (navigator.share) {
      await navigator.share({ title: '무능한 날씨예측기', text, url: SHARE_URL })
      return 'shared'
    }
  } catch (e) {
    // 사용자가 공유 창을 닫은 것은 실패가 아니다
    if ((e as Error)?.name === 'AbortError') return 'cancelled'
  }
  // 예전에는 여기서 몰래 파일을 내려받았다. 앱 안 브라우저(WebView)는 그 다운로드를 막는 일이 많아서
  // "저장했어요"라고 알려 놓고 아무것도 저장되지 않았다 → 그림을 화면에 보여주고 사용자가 고르게 한다.
  onSheet(blob, text)
  return 'sheet'
}
