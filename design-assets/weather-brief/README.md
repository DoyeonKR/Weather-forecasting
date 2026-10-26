# 날씨 브리핑 배너 이미지

2026-10-26 · 기준 코드: main / bb3a74d / v1.0.73

## 전달 범위

내장 이미지 생성 도구로 만든 **텍스트 없는 배너 배경 4종**입니다. PNG 원본과 웹용 WebP를 함께 보관합니다.
문구·시간·기온·페이지 표시·버튼은 이미지에 포함하지 않았습니다. 왼쪽의 어두운 여백에 실제 HTML 텍스트를 얹으세요.
이 작업은 이미지와 구현 참고 사항을 준비했습니다. 앱의 배너 고정·자동 전환·문구 연결은 후속 구현 대상입니다.

## 파일

| 주제 | 웹용 파일 | 원본 크기 | WebP 용량 |
| --- | --- | --- | --- |
| 내일 일출 | public/images/weather-brief/sunrise.webp | 2172 × 724 | 28,948 B |
| 오늘 일몰 | public/images/weather-brief/sunset.webp | 2172 × 724 | 22,156 B |
| 더 따뜻한 날 | public/images/weather-brief/warmer.webp | 2159 × 728 | 44,014 B |
| 더 쌀쌀한 날 | public/images/weather-brief/cooler.webp | 2172 × 724 | 45,122 B |

PNG 원본: 이 디렉터리의 sunrise.png / sunset.png / warmer.png / cooler.png.
실제 생성 프롬프트 전체: prompts.json.

## 배치 권장

- 기존 헤더보다 위에 두는 낮은 브리핑 띠. 모바일 높이는 약 76~84px, 모서리는 약 14px를 시작점으로 권장합니다.
- 짙은 네이비 바탕과 왼쪽 문구, 오른쪽 풍경을 사용합니다. 제목 1줄 + 보조 문구 1줄 정도의 밀도가 어울립니다.
- 배경은 오른쪽 중앙에 두고, CSS에서 background-size: auto 150%를 시작점으로 조정하세요. 넓은 데스크톱에서 cover로 늘리면 풍경이 과하게 확대됩니다.
- 왼쪽 바탕은 #0b1630 계열입니다. 오른쪽 풍경과 문구가 겹치지 않도록 모바일에서는 약 100~120px의 오른쪽 여백을 확보하세요.
- GitHub Pages 하위 경로를 사용하므로 URL은 import.meta.env.BASE_URL + 'images/weather-brief/sunrise.webp' 형태로 구성하세요.
- 이미지가 장식용이면 CSS 배경으로 넣거나 img의 alt를 비워 둡니다. 실제 정보는 HTML 텍스트로 제공하세요.

## 고정·루프 구현 시 코드 확인 사항

- src/App.css의 .shell에는 overflow: hidden이 있습니다. 그 안에 sticky만 추가하면 스크롤 고정이 기대대로 동작하지 않을 수 있습니다.
- 이 구조에서는 배너를 .shell 바깥에 position: fixed로 배치하고 상단에 고정하는 구성이 명확합니다. 배너 높이와 env(safe-area-inset-top)만큼 본문 상단 공간을 함께 확보하세요.
- 설정·공유 대화상자보다 낮은 z-index를 사용하고, 320px 폭·모바일 웹뷰·PWA 안전 영역에서 겹침을 확인하세요.
- 한 장씩 약 6초 간격으로 차분하게 전환하고, 250~400ms 정도의 짧은 크로스페이드를 권장합니다. 사용자가 전환을 멈출 수 있게 하고 prefers-reduced-motion도 고려하세요.
- 자동 전환 문구를 계속 강제 낭독하지 않도록 접근성 알림 빈도를 조절하세요.

## 날씨 데이터 연결 시 주의

- src/lib/weather.ts의 WeatherData.sun은 **오늘**의 rise/set만 반환합니다.
- API 요청에는 이미 일출·일몰 배열이 있지만, **내일 일출**은 응답 daily.sunrise[2]를 별도 필드로 반환하도록 확장해야 합니다. daily[0]은 어제입니다.
- 어제 같은 시각 대비: wx.nowTemp - wx.yesterdaySameHour.
- 내일 낮 기온 대비: wx.tomorrow.tmax - wx.today.tmax. 아침 기온은 tmin끼리 비교합니다.
- 일출·일몰은 선택한 지역의 현지 시각을 유지하고, 값이 없을 때 임의의 시간을 넣지 마세요.

## 확인

최신 코드 git pull --ff-only 결과 원격과 동일함을 확인했습니다.
타입 검사·린트·기존 테스트 52개가 통과했습니다.
