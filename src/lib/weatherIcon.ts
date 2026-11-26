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

/**
 * 아이콘 색 계열 — 시간대별·주간·출퇴근 아이콘이 다 회색이라 한눈에 구분이 안 됐다(2026-11-26 의견).
 * weatherTone 과 달리 밤(달)·구름 조금·안개를 따로 본다. 색은 artwork.css 의 .wic-*.
 */
export type IconTone = 'sun' | 'night' | 'partly' | 'cloud' | 'fog' | 'rain' | 'snow' | 'storm'

export function iconTone(label: string, isDay = true): IconTone {
  if (label.includes('뇌우')) return 'storm'
  if (label.includes('눈')) return 'snow'
  if (label.includes('안개')) return 'fog'
  if (label.includes('비') || label.includes('소나기')) return 'rain'
  if (label.includes('구름') || label.includes('흐림')) {
    if (!label.includes('조금')) return 'cloud'
    return isDay ? 'partly' : 'night'
  }
  return isDay ? 'sun' : 'night'
}
