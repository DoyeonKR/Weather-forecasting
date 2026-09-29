// "내 위치는 곧 비가 올까?" — 레이더 지도 위에 한 줄로 말해 준다.
// 지도만 보면 색을 읽고 시각을 넘겨 봐야 알 수 있어서, 같은 질문에 글로 먼저 답한다.
// 값은 Open-Meteo 15분 강수 예보(내 위치 한 점). 국내는 기상청 실황(지금 비가 오는지)이 있으면 그걸 우선한다.

export interface RainSummary {
  /** 지금 비(눈)가 오고 있는지 */
  raining: boolean
  /** 화면에 그대로 쓰는 문장 */
  text: string
  /** 지도에서 보여줄 시각(epoch 초) — 비가 시작되는 때(또는 그치는 때). 없으면 null */
  jumpTo: number | null
}

/** 15분 강수 mm — 이보다 적으면 비로 세지 않는다 (모델 값이 0.1 단위라 이슬비 잡음을 거른다) */
const THRESH = 0.1
/** 앞으로 볼 시간 (15분 칸 수) */
const AHEAD = 12

function clock(sec: number): string {
  const d = new Date(sec * 1000)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 5분 단위로 반올림한 "N분 / N시간 M분" */
function span(seconds: number): string {
  const min = Math.max(5, Math.round(seconds / 60 / 5) * 5)
  if (min < 60) return `${min}분`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}시간 ${m}분` : `${h}시간`
}

function strength(mmPerHour: number): string {
  if (mmPerHour < 1) return '약한 '
  if (mmPerHour < 4) return ''
  if (mmPerHour < 10) return '강한 '
  return '매우 강한 '
}

/**
 * @param times 15분 칸의 시작 시각(epoch 초), 오름차순
 * @param precip 그 칸의 강수량 mm/15분
 * @param observedRaining 기상청 실황이 말하는 "지금 비 여부" (없으면 null → 예보 값으로)
 */
export function summarizeRain(
  times: number[],
  precip: number[],
  nowSec: number,
  snow: boolean,
  observedRaining: boolean | null = null,
): RainSummary | null {
  if (times.length === 0 || times.length !== precip.length) return null
  // 지금이 속한 칸 (마지막으로 시작한 칸)
  let cur = -1
  for (let i = 0; i < times.length; i++) if (times[i] <= nowSec) cur = i
  if (cur < 0) return null
  const what = snow ? '눈' : '비'
  // 조사: 비→가, 눈→이 ("눈가" 처럼 어색하게 읽히지 않게)
  const sub = snow ? '눈이' : '비가'
  const wet = (i: number) => (precip[i] ?? 0) >= THRESH
  const raining = observedRaining ?? wet(cur)
  const last = Math.min(times.length - 1, cur + AHEAD)

  if (raining) {
    const mmh = wet(cur) ? precip[cur] * 4 : 0
    const label = `${mmh > 0 ? strength(mmh) : ''}${sub}`
    let stop = -1
    for (let i = cur + 1; i <= last; i++) {
      if (!wet(i)) {
        stop = i
        break
      }
    }
    if (stop < 0) {
      return { raining: true, text: `지금 ${label} 내리고 있어요. 앞으로 3시간은 이어질 것 같아요`, jumpTo: null }
    }
    return {
      raining: true,
      text: `지금 ${label} 내리고 있어요. 약 ${span(times[stop] - nowSec)} 뒤(${clock(times[stop])}쯤) 그칠 것 같아요`,
      jumpTo: times[stop],
    }
  }

  for (let i = cur + 1; i <= last; i++) {
    if (wet(i)) {
      const mmh = precip[i] * 4
      return {
        raining: false,
        text: `약 ${span(times[i] - nowSec)} 뒤(${clock(times[i])}쯤) ${strength(mmh)}${sub} 시작될 것 같아요`,
        jumpTo: times[i],
      }
    }
  }
  return { raining: false, text: `내 위치는 앞으로 3시간 ${what} 소식이 없어요`, jumpTo: null }
}

export async function fetchRainSummary(
  lat: number,
  lon: number,
  snow: boolean,
  observedRaining: boolean | null,
): Promise<RainSummary | null> {
  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast')
    url.searchParams.set('latitude', String(lat))
    url.searchParams.set('longitude', String(lon))
    url.searchParams.set('minutely_15', 'precipitation')
    url.searchParams.set('past_minutely_15', '2')
    url.searchParams.set('forecast_minutely_15', String(AHEAD + 4))
    url.searchParams.set('timeformat', 'unixtime')
    url.searchParams.set('timezone', 'auto')
    const res = await fetch(url)
    if (!res.ok) return null
    const d = await res.json()
    return summarizeRain(d?.minutely_15?.time ?? [], d?.minutely_15?.precipitation ?? [], Date.now() / 1000, snow, observedRaining)
  } catch {
    return null
  }
}
