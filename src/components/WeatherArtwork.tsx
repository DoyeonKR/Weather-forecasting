import { useState } from 'react'
import { weatherTone } from '../lib/weatherIcon'
import { artworkFile, artworkName } from '../lib/journal'

/** 큰 요약에는 투명 일러스트, 작은 보조 정보에는 가벼운 SVG를 사용한다. */
export default function WeatherArtwork({ label, isDay = true, size = 96, variant = 'line', priority = false }: {
  label: string; isDay?: boolean; size?: number; variant?: 'line' | 'illustrated'; priority?: boolean
}) {
  const [failedFor, setFailedFor] = useState<string | null>(null)
  const tone = weatherTone(label)
  const name = artworkName(tone, label, isDay)
  const illustrated = variant === 'illustrated' && failedFor !== name
  return <img
    className={`weather-artwork weather-artwork--${illustrated ? 'illustrated' : 'line'}`}
    src={`${import.meta.env.BASE_URL}${artworkFile(name, illustrated)}`}
    width={size} height={size} alt="" aria-hidden="true" decoding="async"
    loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'}
    onError={() => setFailedFor(name)}
  />
}

export function TrendMark({ delta, size = 16 }: { delta: number; size?: number }) {
  const direction = Math.abs(delta) < 0.5 ? 'same' : delta > 0 ? 'up' : 'down'
  return <img className="trend-mark" src={`${import.meta.env.BASE_URL}icons/journal/trend-${direction}.svg`} width={size} height={size} alt="" aria-hidden="true" />
}
