// 날씨 라벨 → 선형 아이콘. 메인·시간대·주간·내일이 같은 그림을 쓰도록 한 곳에 둔다.
import type { ComponentType } from 'react'
import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSun, MoonStars, Snowflake, Sun } from '@phosphor-icons/react'

export type UiIcon = ComponentType<{
  size?: number
  weight?: 'regular' | 'bold' | 'duotone' | 'fill'
  className?: string
  'aria-hidden'?: boolean
}>

export function weatherIcon(label: string, isDay = true): UiIcon {
  if (label.includes('뇌우')) return CloudLightning
  if (label.includes('눈')) return Snowflake
  if (label.includes('안개')) return CloudFog
  if (label.includes('비') || label.includes('소나기')) return CloudRain
  if (label.includes('구름') || label.includes('흐림')) return label.includes('조금') ? CloudSun : Cloud
  return isDay ? Sun : MoonStars
}

/** 날씨 계열 키 — 모노크롬 SVG 에셋과 장식 사진 선택에도 사용한다. */
export function weatherTone(label: string): 'sun' | 'cloud' | 'rain' | 'snow' | 'storm' {
  if (label.includes('뇌우')) return 'storm'
  if (label.includes('눈')) return 'snow'
  if (label.includes('비') || label.includes('소나기')) return 'rain'
  if (label.includes('안개') || label.includes('흐림') || (label.includes('구름') && !label.includes('조금'))) {
    return 'cloud'
  }
  return 'sun'
}
