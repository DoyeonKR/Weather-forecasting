# 무능한 날씨예측기 ⛅

> "오늘 18°래" 그래서 어제보다 추운 거야, 더운 거야?

숫자만 보여주는 날씨 앱은 많습니다. **무능한 날씨예측기**는 질문을 바꿉니다.
사람이 실제로 체감하는 기준은 절대 온도가 아니라 **어제와의 차이**이기 때문에,
모든 정보를 "어제보다 / 오늘보다"라는 비교로 보여줍니다.

🔗 **라이브**: https://doyeonkr.github.io/Weather-forecasting/

## 주요 기능

- **어제 이 시간과 비교**: 접속하면 가장 먼저 보이는 한 줄. _"어제 이 시간보다 3.2° 낮아요"_
- **오늘 vs 어제**: 최고·최저 기온, 강수량, 강수확률을 어제 수치와 ▲▼ 배지로 나란히
- **오늘의 실용 멘트**: 우산 챙기기, 옷차림, 자외선 지수(선크림) 등 상황별 조언 최대 3개
- **비구름 레이더 (기상청 원본)**: OpenStreetMap 지도 위에 기상청 레이더를 직접 오버레이.
  타임라인 슬라이더로 과거 2시간(실황)부터 미래 3시간(예측)까지 스크럽, 기본값은 현재
- **기상청 전국 예측 애니메이션**: 기상레이더센터의 실황+예측 영상을 그대로 (10분마다 갱신)
- **내일은 오늘보다**: 내일 기온·날씨를 오늘 기준 차이로 미리보기, 급변·비·눈은 주의 알림
- **위치 즐겨찾기**: 동네 검색으로 등록하면 어디서든 그 지역 날씨·레이더 조회 (localStorage)
- **날씨 배경 테마**: 현재 날씨와 밤낮에 따라 배경이 자동 변경 (맑음/흐림/비/눈/뇌우/안개, 8종)
- **PWA**: 홈 화면에 설치하면 전체화면 앱처럼 실행

## 기술 스택

| 영역 | 선택 |
|---|---|
| 프레임워크 | Vite 6 + React 19 + TypeScript |
| 지도 | [Leaflet](https://leafletjs.com/) + © OpenStreetMap 타일 |
| 레이더 실황 (한국) | 기상청 레이더 GIS 이미지 (투명 오버레이) |
| 레이더 예측 (한국) | 기상청 MAPLE 초단기 예측 GIF를 프레임 분해 후 재투영 |
| 레이더 (해외) | [RainViewer](https://www.rainviewer.com/) 타일 + Open-Meteo 예보 격자 |
| 날씨 데이터 | [Open-Meteo](https://open-meteo.com/) (`past_days=1`로 어제 실측 확보, 키 불필요) |
| GIF 디코딩 | [gifuct-js](https://github.com/matt-way/gifuct-js) |
| CORS 프록시 | Supabase Edge Function (`kma-proxy`, 비밀값 없음, 5분 캐시) |
| 지오코딩 | Nominatim(장소 검색), BigDataCloud(역지오코딩) |
| 호스팅 | GitHub Pages (정적, 서버리스) + GitHub Actions 자동 배포 |

프론트엔드는 전부 무료·무인증 API로 완결되며, 서버 컴포넌트는 CORS 헤더를 붙여주는
20줄짜리 프록시 함수 하나뿐입니다.

## 기상청 레이더를 지도에 얹은 방법

이 앱의 핵심 기술은 기상청 레이더(실황+예측)를 슬리피 맵(OSM) 위에 정확히 겹쳐 그리는 것입니다.
기상청은 웹 지도용 타일을 제공하지 않기 때문에 두 가지 경로를 직접 만들었습니다.

### 1. 실황: GIS CGI + LCC 투영 재현

기상청 레이더 사이트의 GIS 뷰어가 내부적으로 쓰는 CGI는 임의의 위경도 bbox를 받아
**투명 배경의 레이더 에코 PNG**를 돌려줍니다 (인증 불필요). 다만 좌표를
람베르트 정각원추(LCC) 도법으로 주고받기 때문에, 해당 투영의 정변환·역변환을
[`src/lib/lcc.ts`](src/lib/lcc.ts)에 구현했습니다.

```
+proj=lcc +lat_1=30 +lat_2=60 +lat_0=0 +lon_0=126 +datum=WGS84
```

위치 중심 700km 정사각형을 LCC 미터로 계산해 요청하고, 반환된 PNG를 Leaflet
`imageOverlay`로 얹습니다. `DATE` 파라미터를 10분 단위로 바꿔 과거 2시간(13프레임)을
확보합니다. 검증: 서울 좌표의 변환 결과가 기상청 뷰어의 지도 중심값과 일치.

### 2. 예측: MAPLE GIF 프레임 분해 + 픽셀 좌표 역산 + 재투영

기상청의 초단기 예측(MAPLE, 레이더 외삽 기반 +10분~+3시간)은 전국 고정 화면의
**애니메이션 GIF로만** 제공됩니다. 이를 지도 오버레이로 바꾸는 파이프라인이
[`src/lib/kmaMaple.ts`](src/lib/kmaMaple.ts)입니다.

1. **수신**: 기상청 서버는 CORS를 허용하지 않으므로 Supabase Edge Function이 GIF를 중계
2. **분해**: gifuct-js로 19프레임(실황 1 + 예측 18)을 디코딩, 프레임 시각은
   생성 시각 + 10분 × n
3. **크로마키**: 흰 배경, 검정 해안선·문자, 회색 격자선을 픽셀 단위로 제거해
   비구름 에코만 남김
4. **좌표 역산**: GIF의 픽셀 좌표와 LCC 좌표의 관계를 실측으로 보정.
   울릉도와 제주도(위치가 명확한 고립 섬)의 픽셀 중심을 찾아 축척 1266.1 m/px과
   원점을 계산하고, 호미곶으로 교차 검증 (오차 약 2px)
5. **재투영**: 지도 오버레이 사각형의 각 픽셀마다 위경도 → LCC → GIF 픽셀 순으로
   역추적해 색을 샘플링, 투명 PNG로 만들어 `imageOverlay`에 공급

실황과 예측이 같은 팔레트·투명도로 한 타임라인에 이어지며, 기상청 커버리지 밖(해외)
위치는 RainViewer 실황과 Open-Meteo 예보 격자로 자동 폴백합니다.

## 프로젝트 구조

```
src/
├── lib/
│   ├── compare.ts     # 어제 비교·실용 멘트 로직 (순수 함수)
│   ├── weather.ts     # Open-Meteo 호출 및 정규화
│   ├── kmaNow.ts      # 기상청 초단기실황 (관측값 우선 반영)
│   ├── lcc.ts         # 람베르트 정각원추 투영 정·역변환
│   ├── kmaMaple.ts    # 예측 GIF → 지도 오버레이 파이프라인
│   ├── places.ts      # 즐겨찾기 저장 + Nominatim 검색
│   ├── sections.ts    # 섹션 순서 저장·이동
│   ├── reorder.ts     # 롱탭 드래그 정렬 (FLIP 애니메이션)
│   ├── accent.ts      # 색상 테마 토큰
│   ├── partners.ts    # 날씨에 맞는 준비물 추천
│   ├── push.ts        # 웹푸시 구독 (RPC 두 개로만 저장·해제)
│   ├── track.ts       # 익명 방문 집계
│   └── geo.ts         # geolocation + 역지오코딩
├── components/
│   ├── RadarMap.tsx      # Leaflet 지도 + 실황/예측 타임라인 (지연 로드)
│   ├── HourlyCard.tsx    # 24시간 기온·강수 그래프
│   ├── CompareGraphic.tsx# 어제 대비 변화를 막대로
│   ├── ComparePlaces.tsx # 다른 지역과 나란히 비교
│   ├── WeatherFx.tsx     # 현재 날씨에 맞춘 배경 애니메이션
│   ├── Settings.tsx      # 알림·기본지역·섹션순서·색상테마
│   ├── PromoLayer.tsx    # 오늘 준비물 추천 레이어
│   ├── CoupangBanner.tsx # 제휴 배너
│   ├── PlaceBar.tsx      # 위치 칩 + 장소 검색
│   └── WhenVisible.tsx   # 화면에 들어올 때만 무거운 자식 마운트
├── App.tsx            # 화면 구성
public/sw.js           # 서비스워커 (캐시 + 푸시 수신 + 구독 갱신)
supabase/
├── sql/
│   └── weather_push_subs.sql  # 구독 테이블 스키마와 접근 함수
└── (별도 배포) kma-proxy · kma-ncst · weather-push  # Edge Function
```

## 개발

```bash
npm install
npm run dev      # http://localhost:5173/Weather-forecasting/
npm run build    # 프로덕션 빌드 (dist/)
npm run typecheck # 타입 체크 (tsc -b, 루트 tsconfig 는 files:[] 라 --noEmit 만으로는 0개를 본다)
npm test         # 판단 로직 테스트
```

## 배포

`main` 브랜치에 push하면 GitHub Actions(`.github/workflows/deploy-pages.yml`)가
타입 체크, 빌드, GitHub Pages 배포를 자동으로 수행합니다.

## 로드맵

- [x] 자기 전 푸시 알림: 내일이 오늘보다 크게 춥거나 덥거나, 비·눈이 올 때
      (`weather-push` Edge Function + pg_cron, 시간대는 사용자가 선택)
- [x] 시간별 기온·강수 그래프 (`HourlyCard`)
- [x] 시간별 그래프에 어제 곡선 겹쳐 보기 (`HourlyCard` 점선)
- [x] `compare.ts` 판단 로직 테스트 (`npm test`)
- [ ] `lcc.ts` 투영 변환 테스트

## 데이터 출처

기상청 기상레이더센터 · Open-Meteo · RainViewer · © OpenStreetMap contributors
