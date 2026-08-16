// 기상청 MAPLE 초단기 예측(GIF)을 지도 오버레이로 변환
// - Supabase Edge 프록시로 GIF 수신 → gifuct-js 프레임 분해
// - 배경/해안선/문자 제거(크로마키) 후 LCC→요청 사각형으로 재투영
//
// 좌표 보정(2026-08-17, 울릉도·제주 랜드마크 실측, 호미곶 검증 오차 ~2px):
// gif 픽셀 (px,py) ↔ LCC(EPSG:9802) 미터 (x,y):
//   x = X0 + px * S,  y = Y1 - py * S
import { parseGIF, decompressFrames } from 'gifuct-js'

const PROXY = 'https://tqegatiuembcvphxmujl.supabase.co/functions/v1/kma-proxy'
const S = 1266.1 // m / px
const X0 = -428642
const Y1 = 4843793
// 유효 샘플 창(제목·범례·테두리·푸터 제외)
const PX_MIN = 3, PX_MAX = 806, PY_MIN = 22, PY_MAX = 792

/** KST 10분 단위 내림, back*10분 과거 스탬프와 그 epoch(초) */
function kstStamp(back: number): { stamp: string; epoch: number } {
  const kst = new Date(Date.now() + 9 * 3600_000)
  kst.setUTCMinutes(Math.floor(kst.getUTCMinutes() / 10) * 10 - back * 10, 0, 0)
  const p = (n: number) => String(n).padStart(2, '0')
  return {
    stamp: `${kst.getUTCFullYear()}${p(kst.getUTCMonth() + 1)}${p(kst.getUTCDate())}${p(kst.getUTCHours())}${p(kst.getUTCMinutes())}`,
    epoch: (kst.getTime() - 9 * 3600_000) / 1000,
  }
}

function isBackground(r: number, g: number, b: number): boolean {
  if (r > 230 && g > 230 && b > 230) return true // 흰 배경
  if (r < 90 && g < 90 && b < 90) return true // 해안선·문자
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max - min < 30 // 회색(격자선 등)
}

export interface MapleOverlayFrame {
  /** epoch 초 */
  time: number
  /** 요청 사각형에 재투영된 투명 PNG dataURL */
  url: string
}

/**
 * 예측 프레임들을 LCC 정사각형(rect)에 재투영해 dataURL 로 반환.
 * rectX0/rectY1: 사각형 좌상단 LCC 좌표, rectSize: 한 변(m), outPx: 출력 해상도
 */
export async function mapleForecastOverlays(
  rectX0: number,
  rectY1: number,
  rectSize: number,
  outPx: number,
): Promise<MapleOverlayFrame[]> {
  // 최신 GIF 확보 (생성 지연 대비 과거로 폴백)
  let buf: ArrayBuffer | null = null
  let baseEpoch = 0
  for (let back = 1; back <= 5 && !buf; back++) {
    const { stamp, epoch } = kstStamp(back)
    try {
      const res = await fetch(`${PROXY}?t=${stamp}`)
      if (!res.ok) continue
      buf = await res.arrayBuffer()
      baseEpoch = epoch
    } catch {
      // 다음 스탬프 시도
    }
  }
  if (!buf) return []

  const gif = parseGIF(buf)
  const frames = decompressFrames(gif, true)
  const W = gif.lsd.width
  const H = gif.lsd.height

  // 프레임 합성 버퍼 (GIF는 이전 프레임 위에 패치를 얹는 구조)
  const full = new Uint8ClampedArray(W * H * 4)
  let prevRect: { left: number; top: number; width: number; height: number } | null = null
  let prevDisposal = 0

  const out = document.createElement('canvas')
  out.width = outPx
  out.height = outPx
  const outCtx = out.getContext('2d')!
  const result: MapleOverlayFrame[] = []
  const mPerOut = rectSize / outPx

  frames.forEach((f, fi) => {
    if (prevDisposal === 2 && prevRect) {
      for (let y = prevRect.top; y < prevRect.top + prevRect.height; y++) {
        full.fill(0, (y * W + prevRect.left) * 4, (y * W + prevRect.left + prevRect.width) * 4)
      }
    }
    const { left, top, width, height } = f.dims
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const si = (y * width + x) * 4
        if (f.patch[si + 3] > 0) {
          const di = ((top + y) * W + (left + x)) * 4
          full[di] = f.patch[si]
          full[di + 1] = f.patch[si + 1]
          full[di + 2] = f.patch[si + 2]
          full[di + 3] = 255
        }
      }
    }
    prevRect = f.dims
    prevDisposal = f.disposalType

    // 프레임 0 = 실황(지도에선 com_gis 가 담당) → 건너뜀
    if (fi === 0) return

    // 재투영 + 크로마키
    const img = outCtx.createImageData(outPx, outPx)
    for (let j = 0; j < outPx; j++) {
      const yLcc = rectY1 - (j + 0.5) * mPerOut
      const py = Math.round((Y1 - yLcc) / S)
      if (py < PY_MIN || py > PY_MAX) continue
      for (let i = 0; i < outPx; i++) {
        const xLcc = rectX0 + (i + 0.5) * mPerOut
        const px = Math.round((xLcc - X0) / S)
        if (px < PX_MIN || px > PX_MAX) continue
        const si = (py * W + px) * 4
        const r = full[si], g = full[si + 1], b = full[si + 2]
        if (full[si + 3] === 0 || isBackground(r, g, b)) continue
        const di = (j * outPx + i) * 4
        img.data[di] = r
        img.data[di + 1] = g
        img.data[di + 2] = b
        img.data[di + 3] = 255
      }
    }
    outCtx.putImageData(img, 0, 0)
    result.push({ time: baseEpoch + fi * 10 * 60, url: out.toDataURL('image/png') })
  })

  return result
}
