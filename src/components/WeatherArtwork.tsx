import { weatherTone } from '../lib/weatherIcon'
import { artworkName } from '../lib/journal'

/** 화면 크기에 관계없이 선명한 모노크롬 날씨 벡터 에셋. */
export default function WeatherArtwork({ label, isDay = true, size = 96 }: { label: string; isDay?: boolean; size?: number }) {
  const tone = weatherTone(label)
  const name = artworkName(tone, label, isDay)
  return <img className="weather-artwork" src={`${import.meta.env.BASE_URL}icons/journal/${name}.svg`} width={size} height={size} alt="" aria-hidden="true" />
}

export function TrendMark({ delta, size = 16 }: { delta: number; size?: number }) {
  const direction = Math.abs(delta) < 0.5 ? 'same' : delta > 0 ? 'up' : 'down'
  return <img className="trend-mark" src={`${import.meta.env.BASE_URL}icons/journal/trend-${direction}.svg`} width={size} height={size} alt="" aria-hidden="true" />
}
