# 무능한 날씨예측기 ⛅

> "오늘 18°래" 그래서 어제보다 추운 거야, 더운 거야?

숫자만 보여주는 날씨 앱은 많습니다. **무능한 날씨예측기**는 질문을 바꿉니다.
사람이 실제로 체감하는 기준은 절대 온도가 아니라 **어제와의 차이**이기 때문에,
모든 정보를 "어제보다 / 오늘보다"라는 비교로 보여줍니다.

🔗 **라이브**: https://doyeonkr.github.io/Weather-forecasting/

## 주요 기능

- **어제 이 시간과 비교**: 접속하면 가장 먼저 보이는 한 줄. _"어제 이 시간보다 3.2° 낮아요"_
- **시간대별 7일 그래프**: 좌우로 밀어서 넘기는 3시간 간격 기온·강수, 칸마다 하루 전 대비 ▲▼.
  "비" 줄에 칸별 예상 강수량(3시간 합), 비가 멀면 "다음 비 → 언제·얼마나"
- **미세먼지**: 환경부 등급 + 어제 이맘때 대비 + 나빠지는 시각 (CAMS 모델 값)
- **출퇴근길·평년 비교**: 출근/퇴근 시각을 하루 전과, 오늘 기온을 최근 10년 이맘때와
- **내 체감 보정**: "어제 어땠어요?" 답으로 옷차림 추천을 사람마다 조금씩 옮김 (기기에만 저장)
- **공유 카드**: "어제보다 2° 추워요"를 그림으로 만들어 공유
- **알림**: 아침 브리핑·내일 준비·비 시작 알림(선택), 기상특보 배너. 설정의 기본 지역 기준 (기본 지역을 바꾸면 알림도 따라감).
  안드로이드 앱은 웹 푸시를 못 받아 앱이 직접 아침 브리핑·밤 내일 준비·비 시작·미세먼지·폭염/한파 알림을 띄운다
- **오늘 vs 어제**: 최고·최저 기온, 강수량, 강수확률을 어제 수치와 ▲▼ 배지로 나란히
- **오늘의 실용 멘트**: 우산 챙기기, 옷차림, 자외선 지수(선크림) 등 상황별 조언 최대 3개
- **비구름 레이더 (기상청 원본)**: 지도 위에 "곧 비가 올까?" 문장·색 범례·크게 보기를 얹고, OpenStreetMap 위에 기상청 레이더를 직접 오버레이.
  타임라인 슬라이더로 과거 2시간(실황)부터 미래 3시간(예측)까지 스크럽, 기본값은 현재
- **기상청 전국 예측 애니메이션**: 기상레이더센터의 실황+예측 영상을 그대로 (10분마다 갱신)
- **내일은 오늘보다**: 내일 기온·날씨를 오늘 기준 차이로 미리보기, 급변·비·눈은 주의 알림
- **위치 즐겨찾기**: 동네 검색으로 등록하면 어디서든 그 지역 날씨·레이더 조회 (localStorage)
- **날씨 배경 테마**: 현재 날씨와 밤낮에 따라 배경이 자동 변경 (맑음/흐림/비/눈/뇌우/안개, 8종)
- **PWA**: 홈 화면에 설치하면 전체화면 앱처럼 실행
- **안드로이드 앱 + 홈 화면 위젯**: 지금 기온·날씨·최고/최저·어제 이맘때와 차이·비 올 확률(24시간 안에 비가 오면 "15시 비"). 크기(2칸/3칸 이상)에 따라 판이 바뀌고 날씨·낮밤에 따라 배경이 바뀜. 30분마다 갱신
- **앱 안 업데이트**: 새 버전이 나오면 앱 아래에 카드가 뜨고 눌러서 바로 설치

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
| 안드로이드 앱 | Capacitor 8 껍데기 (배포된 사이트를 연다) + 네이티브 위젯 (RemoteViews, WorkManager) |
| 앱 배포 | GitHub Releases 에 APK 직접 배포 (스토어 없음) |

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
│   ├── weatherIcon.ts # 날씨 라벨 → 선형 아이콘·색 계열 (iconTone → artwork.css 의 .wic-*)
│   ├── lastWeather.ts # 마지막 날씨 캐시 (재방문 시 바로 표시)
│   ├── air.ts         # 미세먼지 등급·요약 (Open-Meteo 대기질)
│   ├── rainSoon.ts    # "내 위치는 곧 비가 올까?" 문장 (15분 강수 예보 + 기상청 실황)
│   ├── rainLane.ts    # 시간대별 카드 "비" 줄 — 칸별 3시간 강수량 합, 다음 비 묶음
│   ├── backoff.ts     # 승인 전인 선택 기능의 실패를 15분 쉬었다 재시도
│   ├── install.ts     # 홈 화면 설치 버튼·아이폰 안내
│   ├── inapp.ts       # 카카오톡·네이버 등 앱 안 브라우저 감지, 기본 브라우저로 열기
│   ├── uv.ts          # 자외선 지수 등급
│   ├── feel.ts        # 내 체감 보정 (기기 저장)
│   ├── commute.ts     # 출퇴근 시각 비교
│   ├── normals.ts     # 최근 10년 같은 시기 평균 (ERA5)
│   ├── share.ts       # 공유 카드 그리기·공유
│   ├── warn.ts        # 기상특보 구역 ↔ 지역 이름 매칭
│   ├── partners.ts    # 날씨에 맞는 준비물 추천
│   ├── push.ts        # 웹푸시 구독 (RPC 두 개로만 저장·해제) + 켜 둔 알림의 지역을 기본 지역에 맞추기
│   ├── notifyPlace.ts # 날씨 알림 기준 지역 = 기본 지역 (즐겨찾기 / 실제 현재 위치 / 첫 즐겨찾기)
│   ├── track.ts       # 익명 방문 집계
│   ├── nativeWidget.ts # 안드로이드 앱 안에서만: 위젯에 동네 넘기기·위젯 추가 창·APK 주소
│   ├── appUpdate.ts   # 안드로이드 앱 안에서만: 새 버전 확인(GitHub 릴리스)·설치 요청
│   ├── appNotify.ts   # 안드로이드 앱 안에서만: 앱이 직접 띄우는 날씨 알림 켜기·끄기·지역/말투/시간 넘기기·테스트
│   └── geo.ts         # geolocation + 역지오코딩
├── components/
│   ├── RadarMap.tsx      # Leaflet 지도 + 실황/예측 타임라인 (지연 로드)
│   ├── HourlyCard.tsx    # 3시간 간격 약 7일 기온·강수 (가로 스크롤, 하루 전 비교)
│   ├── Extras.tsx        # 미세먼지 줄·체감 질문·출퇴근·평년·특보 배너
│   ├── StatsPanel.tsx    # 운영자용 이용 통계 (주소 끝 #stats)
│   ├── ErrorBoundary.tsx # 카드 단위·앱 전체 오류 복구
│   ├── ShareSheet.tsx    # 기기 공유 창을 못 쓸 때의 공유 시트 (그림·복사)
│   ├── CompareGraphic.tsx# 어제 대비 변화를 막대로
│   ├── ComparePlaces.tsx # 다른 지역과 나란히 비교
│   ├── WeatherFx.tsx     # 현재 날씨에 맞춘 배경 애니메이션
│   ├── Settings.tsx      # 알림·기본지역·섹션순서·색상테마
│   ├── PromoLayer.tsx    # 오늘 준비물 추천 레이어
│   ├── CoupangBanner.tsx # 제휴 배너
│   ├── PlaceBar.tsx      # 위치 칩 + 장소 검색
│   ├── UpdateBanner.tsx  # 안드로이드 앱 새 버전 카드 (main.tsx 에서 App 바깥에 붙는다)
│   ├── AppNotifySection.tsx # 설정 > 날씨 알림 — 안드로이드 앱 안에서만 (웹은 Settings 의 웹 푸시 칸)
│   └── WhenVisible.tsx   # 화면에 들어올 때만 무거운 자식 마운트
├── App.tsx            # 화면 구성
public/sw.js           # 서비스워커 (캐시 + 푸시 수신 + 구독 갱신)
supabase/
├── sql/
│   ├── weather_push_subs.sql  # 구독 테이블 스키마와 접근 함수 (+ 비 알림)
│   └── weather_events.sql     # 기능 사용 집계 테이블
├── functions/
│   ├── kma-ncst/      # 기상청 초단기실황 프록시
│   ├── kma-warn/      # 기상청 특보 발효 현황 프록시 (특보 서비스 사용 승인 필요)
│   ├── air-korea/     # 에어코리아 가까운 측정소 실측 (측정소정보·대기오염정보 사용 승인 필요)
│   ├── weather-push/  # 아침·밤·비 시작 알림 발송 (pg_cron)
│   └── weather-push-test/  # 설정의 "테스트 알림 보내기" (구독 1건에 1분 1회)
└── (별도 배포) kma-proxy  # Edge Function
capacitor.config.ts    # 안드로이드 앱 설정 (server.url = 배포된 사이트)
native-shell/          # 사이트에 못 닿을 때 앱이 보여줄 안내 한 장
android/app/src/
├── main/java/com/doyeonkr/weather/
│   ├── MainActivity.java          # 플러그인 등록
│   ├── WidgetBridge.java          # 웹 ↔ 위젯 (동네 넘기기, 위젯 추가 창)
│   ├── AppUpdate.java             # 앱 안 업데이트 (받기 → 확인 → 설치)
│   ├── UpdateResultReceiver.java  # 설치 결과 (확인 창 띄우기, 실패 안내)
│   ├── ExternalWindows.java       # "새 창" 링크(쿠팡 광고 등)를 쿠팡 앱·브라우저로 (웹뷰는 새 창을 못 연다)
│   ├── AppNotify.java             # 앱 날씨 알림 플러그인 (웹 ↔ notify/)
│   ├── notify/
│   │   ├── Brief.java             # 알림 문구 — 서버 weather-push 의 morningMsg·nightMsg 를 옮긴 것 (BriefTest)
│   │   ├── Slot.java              # 알림 시각 계산 (늦으면 건너뛰기·업데이트 뒤 따라잡기, SlotTest)
│   │   ├── Conditions.java        # 조건 알림 기준·문구 — 서버 runRain 과 같게 (ConditionsTest)
│   │   ├── NotifyConditionWorker.java # 한 시간쯤마다 비 시작·미세먼지·폭염/한파 확인 (07~21시)
│   │   ├── Forecast.java          # Open-Meteo 예보·미세먼지 받기 (서버 fetchDaily·fetchAirWorst 와 같은 항목)
│   │   ├── NotifyScheduler.java   # 아침·밤 정확한 알람 + 3시간마다 예보 미리 받기
│   │   ├── NotifyRunner.java      # 알람 → 예보(못 받으면 받아 둔 것) → 알림
│   │   ├── NotifyAlarmReceiver.java · NotifyBootReceiver.java · NotifyRefreshWorker.java
│   │   └── NotifyStore.java · Notifier.java · Lines.java · NotifyApi.java
│   └── widget/
│       ├── WeatherWidget.java     # 위젯 생명주기 (놓기·크기 변경·치우기)
│       ├── WidgetStore.java       # 저장된 값으로 위젯 그리기, 크기별 판 고르기
│       ├── WidgetRain.java        # 위젯 "다음 비" (24시간 안, WidgetRainTest)
│       └── WidgetWorker.java      # 30분마다 Open-Meteo 에서 날씨 받기
├── main/res/layout/widget_weather_{compact,wide}.xml  # 좁은 판·넓은 판 (id 를 똑같이 맞춘다)
├── main/res/drawable/widget_bg_*.xml, ic_w_*.xml      # 날씨별 배경·아이콘
├── main/res/raw/persona_lines.json  # 알림 말투 문구 — persona.ts 에서 생성 (손으로 고치지 않는다)
├── test/java/.../notify/             # BriefTest·SlotTest (./gradlew testDebugUnitTest)
└── debug/  # 디버그 빌드에만: 위젯 미리보기 화면, 업데이트 시험용 설정
scripts/
├── export-persona-lines.mjs   # persona.ts → 앱 알림 말투 문구 (test/persona-lines.test.mjs 가 어긋남을 잡는다)
├── android-release-notes.sh   # CHANGELOG → 릴리스 노트 (자동·손 릴리스 공통)
├── setup-release-secrets.sh   # 서명 키를 저장소 비밀값으로 한 번 등록 (키 있는 PC 에서)
└── release-android.sh         # 손 릴리스 (Actions 를 못 쓸 때)
.github/workflows/
├── deploy-pages.yml      # main 머지 → 웹 배포
└── android-release.yml   # main 머지 → 앱 코드가 바뀌었으면 APK 릴리스, PR 에서는 빌드 확인
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
안드로이드 앱 코드가 바뀌었으면 `.github/workflows/android-release.yml` 이 APK 릴리스도 만듭니다 (아래 "안드로이드 앱").

## 안드로이드 앱

### 무엇을 바꾸면 무엇을 다시 내야 하나

앱은 화면을 안에 넣지 않고 배포된 사이트(`server.url`)를 연다. 그래서 대부분은 웹 배포만으로 바뀐다.

| 바꾼 것 | 필요한 일 | 사용자 쪽 |
|---|---|---|
| 웹 화면·문구·기능 (`src/`) | `main` 에 push (웹 배포) | 앱을 다시 열면 바로 반영 |
| 위젯 (`android/.../widget`, `res/layout`, `res/drawable`) | `package.json` 버전 올리고 CHANGELOG 쓰고 main 에 머지 (APK 자동 릴리스) | 앱 안 업데이트 카드 → 설치 |
| 네이티브 플러그인·권한·앱 이름·아이콘 | 위와 같음 | 앱 안 업데이트 카드 → 설치 |
| 알림 문구·기준 (`weather-push` 의 `morningMsg`·`nightMsg`·`runRain`) | 서버(Supabase 배포)와 앱 `notify/Brief.java`·`Conditions.java` 를 **같이** 고친다 → APK 릴리스 | 웹 알림은 바로, 앱 알림은 업데이트 뒤 |
| 말투 문구 (`persona.ts`) | `node scripts/export-persona-lines.mjs` 로 앱 문구도 다시 만든다 (안 하면 테스트 실패) → APK 릴리스 | 위와 같음 |

### 버전 규칙

- 앱 버전은 `package.json` 의 `version` 에서 자동으로 온다 (`android/app/build.gradle`). 손으로 고치지 않는다.
- versionCode 는 `1.0.108` → `1000108`. 숫자가 커야 위에 덮어 설치된다.
- 릴리스 태그는 `android-v{버전}`, 파일 이름은 늘 `eojeboda-weather.apk`. 앱 안 업데이트와 사이트의
  「앱 받기」 버튼(`releases/latest/download/eojeboda-weather.apk`)이 이 둘에 기대고 있다.
- 웹만 바꾼 버전(예: 1.0.107)은 안드로이드 릴리스를 만들지 않는다. 그러면 앱 안 카드도 안 뜬다.

### 서명 키

- `android/keystore.properties` + `weather-release.jks` 는 저장소에 올리지 않는다 (`.gitignore`).
- **잃어버리면 기존 사용자에게 업데이트를 줄 수 없다.** 다른 키로 만든 APK 는 위에 덮어 설치되지 않아서,
  모두 앱을 지우고 새로 깔아야 한다. 따로 백업해 둔다.
- 자동 릴리스용으로 GitHub 저장소 비밀값에도 들어 있다 (등록은 `scripts/setup-release-secrets.sh`). 비밀값은 백업이 아니다 — 꺼내 볼 수 없으니 원본 파일을 따로 보관한다.
- 키를 바꾸지 않는다. 워크플로는 지난 릴리스와 서명이 다르면 릴리스를 멈춘다.

### 릴리스 절차 (자동)

> **현재 상태 (2026-11-26)**: 서명 키 비밀값 4개 등록 완료. v1.0.108 APK 릴리스됨 (Latest = `android-v1.0.108`). 이제 앱 코드를 바꾸고 버전을 올려 main 에 머지하면 자동 릴리스된다.

`.github/workflows/android-release.yml` 이 main 에 머지될 때마다 판단한다.

| main 에 들어온 변경 | 결과 |
|---|---|
| 웹만 (`src/` 등) | APK 릴리스 안 함. 웹 배포만으로 앱에도 반영 |
| 앱 코드(`android/`, `capacitor.config.ts`, `native-shell/`) + `package.json` 버전 올림 + CHANGELOG 항목 | 서명된 APK 빌드 → 지난 릴리스와 **같은 서명 키·더 큰 versionCode** 인지 확인 → 릴리스 `android-v{버전}` 생성 |
| 앱 코드를 바꿨는데 버전을 안 올림 | 릴리스 안 함 + 경고 ("버전을 올리세요") |
| 서명 키 비밀값이 없음 | 릴리스 안 함 + 경고 |

PR 에서 앱 코드를 바꾸면 서명 없이 빌드만 해서 깨지지 않았는지 본다.
앱마다 6시간에 한 번 새 버전을 확인하므로, 릴리스 뒤 늦어도 6시간 안에 앱 안 카드가 뜬다.
릴리스 노트는 CHANGELOG 그 버전 항목에서 만든다 (`scripts/android-release-notes.sh`). 첫 줄이 앱 안 카드 설명이 된다.

**처음 한 번 (서명 키 등록)** — 키가 있는 PC 에서:
```bash
bash scripts/setup-release-secrets.sh
```
`android/keystore.properties` 와 키 파일을 읽어 저장소 비밀값 4개(`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`)로 등록한다. 값은 화면에 찍지 않는다.
등록 뒤 바로 릴리스하려면 `gh workflow run android-release.yml -R DoyeonKR/Weather-forecasting`
(GitHub → Actions → Android release → Run workflow 와 같다. `force` 를 켜면 앱 코드가 안 바뀌어도 릴리스).

**손으로 릴리스 (Actions 를 못 쓸 때)** — 키가 있는 PC 에서 `bash scripts/release-android.sh`. 같은 이름·같은 노트로 만든다.

### 앱 안 업데이트가 움직이는 방식

1. 웹(`lib/appUpdate.ts`)이 GitHub API 로 Latest 릴리스를 묻는다. 태그가 `android-v…` 이고 APK 가 붙어 있어야 새 버전으로 본다.
2. 설치된 앱 버전보다 새로우면 `UpdateBanner` 카드를 띄운다. 닫으면 그 버전은 다시 안 띄운다.
3. 「업데이트」 → 네이티브 `AppUpdate` 가 **앱에 고정된 주소**에서 APK 를 받는다 (웹은 주소를 넘기지 못한다).
4. 받은 파일이 같은 앱이고 더 새 버전일 때만 안드로이드 설치 창을 띄운다. 서명이 다르면 안드로이드가 거절한다.

사용자가 겪는 것:
- 처음 한 번은 「이 출처 허용」 설정 화면으로 간다. 켜고 돌아와서 다시 누르면 된다.
- 스토어 밖 앱이라 **업데이트마다 Play 프로텍트 경고**가 나온다. 「세부정보」 → 「무시하고 설치」. 카드에 안내가 뜬다.
- 설치가 끝나면 앱이 닫힌다(안드로이드 기본 동작). 다시 열면 새 버전.
- 1.0.106 앱에는 이 기능이 없어서, 카드의 「받기」가 브라우저로 APK 를 받게 한다.

이 경고까지 없애려면 Play 스토어에 올려야 한다 (개발자 계정 25달러·심사).

### 앱 날씨 알림

웹뷰(앱 화면)는 웹 푸시를 받지 못한다. 그래서 앱은 서버 푸시 대신 **휴대폰이 직접** 정해 둔 시각에 예보를 받아 알림을 띄운다.

| 항목 | 내용 |
|---|---|
| 종류 | 아침 오늘 브리핑, 밤 내일 출근 준비(오늘과 크게 다를 때만) + 조건 알림: 비 시작(6시간에 한 번)·미세먼지 나쁨·폭염/한파(하루 한 번), 07~21시 |
| 문구 | 서버 `morningMsg`·`nightMsg`·`runRain` 을 `notify/Brief.java`·`Conditions.java` 로 옮김. 말투는 `persona.ts` 에서 만든 `res/raw/persona_lines.json` |
| 비 시작 기준 | 서버는 기상청 초단기예보(키 필요), 앱은 웹 「곧 비가 올까」(`lib/rainSoon.ts`)와 같은 Open-Meteo 15분 예보 — 지금 안 오고 1시간 15분 안에 0.1mm 이상 |
| 조건 알림 주기 | WorkManager 한 시간 주기 (절전 중엔 미뤄질 수 있다 — 브리핑처럼 정확한 알람은 아니다) |
| 기준 지역·말투 | 웹의 `pushPlace`(기본 지역)·말투를 `AppNotify.update` 로 넘긴다 — 위젯 지역(보고 있는 곳)과 다르다 |
| 시각 | `USE_EXACT_ALARM`(13+)·`SCHEDULE_EXACT_ALARM`(12 이하)로 정확한 알람. 없으면 최대 1시간 늦는다 (에뮬레이터 확인) |
| 절전·인터넷 | 3시간마다 예보를 받아 둔다. 알람 때 못 받으면 받아 둔 예보로, 그것도 없으면 15분 뒤 다시 (2시간 넘게 늦으면 그날은 건너뜀) |
| 재부팅·업데이트 | `NotifyBootReceiver` 가 알람을 다시 건다 |
| 권한 | 안드로이드 13+ 는 처음 켤 때 알림 허용을 묻는다. 거절하면 휴대폰 알림 설정으로 가는 버튼 |
| 이전 앱 | 1.0.108 이하에는 플러그인이 없어 스위치가 꺼진 채 "앱을 업데이트하면 켤 수 있어요". 1.0.110~1.0.111 은 조건 알림 스위치가 안 보인다 |
| 절전 | 배터리 최적화 대상이면 「배터리 최적화에서 빼기」(`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`), 삼성은 절전 앱 목록 안내 |

⚠ `USE_EXACT_ALARM`·`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` 은 Play 스토어에서는 제한된다 (알람·캘린더 앱 등만). 스토어에 올리게 되면 이 권한을 빼고
FCM(서버 푸시)으로 옮길지 다시 정한다 (Firebase 프로젝트·Supabase 배포 필요).

### 빌드·확인 (개발 PC)

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME=~/Library/Android/sdk
npx cap sync android
cd android && sh ./gradlew assembleDebug   # app/build/outputs/apk/debug/app-debug.apk
```

- **디버그 APK 는 실제 폰에 깔지 않는다.** 서명이 달라 정식 앱 위에 안 깔리고, 지우고 깔면 다음 정식 업데이트가 막힌다. 에뮬레이터에서만.
- 위젯 미리보기 (디버그 빌드만): 진짜 위젯과 같은 그림을 정해진 크기에 나쁜 값(-12°, 긴 동네 이름, 빈 화면)으로 그린다.
  ```bash
  adb shell am start -n com.doyeonkr.weather/.widget.WidgetPreviewActivity --es page a   # a·b·c
  ```
  `--es seed winter` 로 가짜 날씨를 저장하고 `--ez pin true` 로 위젯 추가 창을 띄워 홈 화면에서도 볼 수 있다.
- 앱 알림 시험 (디버그 빌드만): `adb shell setprop debug.eojeboda.meteo http://localhost:8765/meteo` 로 예보를
  `forecast.json`·`air.json`·`minutely.json` 고정 파일에서 받게 한다 (`adb reverse tcp:8765 tcp:8765`). 알림 시각을 몇 분 뒤로 잡고
  `adb shell dumpsys deviceidle force-idle` 로 절전 중에도 오는지, `dumpsys alarm | grep NOTIFY_ALARM` 으로 알람이 걸렸는지 본다.
  조건 알림을 지금 한 번 돌리려면 `adb shell am start -n com.doyeonkr.weather/.widget.WidgetPreviewActivity --ez conditions true`.
  네이티브 단위 테스트: `cd android && ./gradlew testDebugUnitTest`
- 앱 안 업데이트 시험: 개발 서버를 `VITE_RELEASES_API=<가짜 릴리스 JSON 주소> npm run dev` 로 띄우고,
  디버그 앱에서 `adb shell setprop debug.eojeboda.update_url <APK 주소>` 로 받는 곳을 바꾼다.
  둘 다 배포본(웹 빌드·릴리스 APK)에서는 동작하지 않는다.

### 원복

| 상황 | 방법 |
|---|---|
| 방금 올린 릴리스가 문제 (아직 받은 사람 적음) | `gh release delete android-v{버전} --cleanup-tag` → 앱 안 카드·「앱 받기」가 바로 이전 릴리스를 가리킨다 (다음 머지 때 같은 버전으로 다시 릴리스되지 않게 버전을 올려서 고친다) |
| 자동 릴리스를 잠시 멈추고 싶음 | GitHub → Actions → Android release → ⋯ → Disable workflow (다시 켜면 이어서 동작) |
| 이미 새 버전을 깐 사람이 있음 | 낮은 버전은 위에 못 깐다. 코드를 되돌린 뒤 `package.json` 버전을 **올려서** 다시 릴리스 |
| 웹 화면이 문제 | 웹만 revert 해서 `main` 에 push (APK 필요 없음) |

## 로드맵

- [x] 자기 전 푸시 알림: 내일이 오늘보다 크게 춥거나 덥거나, 비·눈이 올 때
      (`weather-push` Edge Function + pg_cron, 시간대는 사용자가 선택)
- [x] 시간별 기온·강수 그래프 (`HourlyCard`)
- [x] 시간별 그래프에 어제 곡선 겹쳐 보기 (`HourlyCard` 점선)
- [x] `compare.ts` 판단 로직 테스트 (`npm test`)
- [x] 미세먼지 + 어제 대비, 공유 카드, 기능 사용 집계 (v1.0.63)
- [x] 내 체감 보정, 출퇴근 비교, 평년 비교 (v1.0.63)
- [x] 비 시작 알림, 기상특보 배너 (v1.0.63 — 특보는 공공데이터포털 사용 승인 후 동작)
- [x] `lcc.ts` 투영 변환 테스트
- [x] 에어코리아·기상특보 공공데이터포털 사용 승인 (2026-10-26)
- [x] 안드로이드 앱(APK) + 홈 화면 위젯 (v1.0.106)
- [x] 위젯 크기별 판·디자인, 앱 안 업데이트 (v1.0.108)
- [ ] Play 스토어 등록 (업데이트 때 Play 프로텍트 경고 없애기)

## 데이터 출처

기상청 기상레이더센터 · Open-Meteo · RainViewer · © OpenStreetMap contributors
