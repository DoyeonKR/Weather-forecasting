import { useState } from 'react'
import type { WeatherScene } from '../lib/weatherScene'
import WeatherFx from './WeatherFx'

/** 사진 자체도 움직인다. 날씨 입자와 같은 재생·가시성 상태를 사용한다. */
export default function WeatherBackdrop({ scene, paused }: { scene: WeatherScene; paused: boolean }) {
  const [animated, setAnimated] = useState(false)
  return <>
    <figure className={`hero-photo ${animated ? 'is-animated' : 'is-still'}`} data-animated={animated} data-wind={scene.windLevel} aria-hidden="true">
      <img src={`${import.meta.env.BASE_URL}images/weather-journal/${scene.sky}.webp`} alt="" decoding="async" fetchPriority="high" />
    </figure>
    <WeatherFx scene={scene} paused={paused} scope="hero" onAnimatedChange={setAnimated} />
  </>
}
