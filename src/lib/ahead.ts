// "오늘 남은 시간" 기준 강수 — 하루 전체 값은 이미 지나간 비까지 센다.
// 밤 10시에 아침 소나기(하루 최대 66%)를 보고 "우산 챙기기"를 권하면, 바로 아래 레이더의
// "앞으로 3시간 비 소식 없어요"와 정면으로 부딪힌다. 실용 멘트·추천·강수확률 칸은 남은 시간으로 본다.
// (어제와 비교하는 카드는 하루 대 하루 비교라 그대로 하루 전체 값을 쓴다)
import type { DayStats } from './compare'
import type { WeatherData } from './weather'

export function todayAhead(wx: Pick<WeatherData, 'today' | 'hourly' | 'nowHourLocal'>): DayStats {
  const { prob, precip, code } = wx.hourly
  // 시간별 강수확률은 나중에 추가된 값 — 옛 캐시에는 없으니 그때는 하루 값을 그대로
  if (!prob || prob.length < 48) return wx.today
  // 시간별 배열은 어제 0시부터: 24~47 이 오늘
  const from = 24 + wx.nowHourLocal
  let probMax = 0
  let sum = 0
  // 날씨 코드: 하루 대표 코드(Open-Meteo)와 같은 규칙 — 남은 시간 중 가장 궂은(큰) 코드
  let worst = -1
  for (let i = from; i <= 47; i++) {
    probMax = Math.max(probMax, prob[i] ?? 0)
    sum += precip[i] ?? 0
    if (typeof code?.[i] === 'number') worst = Math.max(worst, code[i])
  }
  return {
    ...wx.today,
    precipProbMax: probMax,
    precipSum: Math.round(sum * 10) / 10,
    code: worst >= 0 ? worst : wx.today.code,
  }
}

/**
 * 어제의 같은 시간대(지금 시각 ~ 자정) 강수 — 오늘 남은 시간과 공정하게 비교하려고.
 * 오늘은 남은 시간, 어제는 하루 전체로 비교하면 저녁마다 "어제보다 비가 덜 온다"가 된다.
 */
export function yesterdaySameWindow(
  wx: Pick<WeatherData, 'yesterday' | 'hourly' | 'nowHourLocal'>,
): DayStats {
  const { prob, precip } = wx.hourly
  if (!prob || prob.length < 48) return wx.yesterday
  let probMax = 0
  let sum = 0
  for (let i = wx.nowHourLocal; i <= 23; i++) {
    probMax = Math.max(probMax, prob[i] ?? 0)
    sum += precip[i] ?? 0
  }
  return { ...wx.yesterday, precipProbMax: probMax, precipSum: Math.round(sum * 10) / 10 }
}
