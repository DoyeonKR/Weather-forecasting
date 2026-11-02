export interface TemperatureBand { d: string; cls: 'warm' | 'cold' | 'same' }

/** 선이 교차하면 교차점에서 면을 나눠 높고 낮음을 반대로 칠하지 않는다. */
export function temperatureBands(current: number[], previous: number[], x: (i: number) => number, y: (t: number) => number): TemperatureBand[] {
  const bands: TemperatureBand[] = []
  const add = (a: number, b: number, ca: number, cb: number, pa: number, pb: number) => {
    const delta = ca + cb - pa - pb
    bands.push({ d: `M${x(a)} ${y(ca)} L${x(b)} ${y(cb)} L${x(b)} ${y(pb)} L${x(a)} ${y(pa)} Z`, cls: Math.abs(delta) < 1e-6 ? 'same' : delta > 0 ? 'warm' : 'cold' })
  }
  for (let i = 0; i < Math.min(current.length, previous.length) - 1; i++) {
    const a = current[i], b = current[i + 1], p = previous[i], q = previous[i + 1]
    if (![a, b, p, q].every(Number.isFinite)) continue
    const da = a - p, db = b - q
    if (da * db < 0) {
      const f = da / (da - db), crossing = a + (b - a) * f
      add(i, i + f, a, crossing, p, crossing)
      add(i + f, i + 1, crossing, b, crossing, q)
    } else add(i, i + 1, a, b, p, q)
  }
  return bands
}
