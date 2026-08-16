// 기상청 GIS CGI 가 쓰는 람베르트 정각원추(LCC, EPSG:9802 계열) 투영
// +proj=lcc +lat_1=30 +lat_2=60 +lat_0=0 +lon_0=126 +datum=WGS84
// (radar.kma.go.kr GIS 뷰어의 좌표 변환을 그대로 재현 — 순수 함수, 테스트 가능)

const A = 6378137
const F = 1 / 298.257223563
const E2 = F * (2 - F)
const E = Math.sqrt(E2)
const LAT1 = (30 * Math.PI) / 180
const LAT2 = (60 * Math.PI) / 180
const LON0 = (126 * Math.PI) / 180

function mFn(phi: number): number {
  const s = Math.sin(phi)
  return Math.cos(phi) / Math.sqrt(1 - E2 * s * s)
}

function tFn(phi: number): number {
  const s = Math.sin(phi)
  return Math.tan(Math.PI / 4 - phi / 2) / Math.pow((1 - E * s) / (1 + E * s), E / 2)
}

const N = (Math.log(mFn(LAT1)) - Math.log(mFn(LAT2))) / (Math.log(tFn(LAT1)) - Math.log(tFn(LAT2)))
const FF = mFn(LAT1) / (N * Math.pow(tFn(LAT1), N))
const RHO0 = A * FF * Math.pow(tFn(0), N) // lat_0 = 0

/** 위경도(도) → LCC 미터 */
export function lccForward(lat: number, lon: number): { x: number; y: number } {
  const phi = (lat * Math.PI) / 180
  const lam = (lon * Math.PI) / 180
  const rho = A * FF * Math.pow(tFn(phi), N)
  const theta = N * (lam - LON0)
  return { x: rho * Math.sin(theta), y: RHO0 - rho * Math.cos(theta) }
}

/** LCC 미터 → 위경도(도) */
export function lccInverse(x: number, y: number): { lat: number; lon: number } {
  const rho = Math.sign(N) * Math.sqrt(x * x + (RHO0 - y) * (RHO0 - y))
  const theta = Math.atan2(x, RHO0 - y)
  const t = Math.pow(rho / (A * FF), 1 / N)
  let phi = Math.PI / 2 - 2 * Math.atan(t)
  for (let i = 0; i < 8; i++) {
    const s = Math.sin(phi)
    phi = Math.PI / 2 - 2 * Math.atan(t * Math.pow((1 - E * s) / (1 + E * s), E / 2))
  }
  return { lat: (phi * 180) / Math.PI, lon: ((theta / N + LON0) * 180) / Math.PI }
}
