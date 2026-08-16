# 무능한 날씨예측기 ⛅

> "오늘 18°래" 그래서 어제보다 추운 거야, 더운 거야?

숫자만 보여주는 날씨 앱은 많습니다. **무능한 날씨예측기**는 질문을 바꿉니다.
사람이 실제로 체감하는 기준은 절대 온도가 아니라 **어제와의 차이**이기 때문에,
모든 정보를 "어제보다 / 오늘보다"라는 비교로 보여줍니다.

🔗 **라이브**: https://doyeonkr.github.io/Weather-forecasting/

## 주요 기능

- **어제 이 시간과 비교** — 접속하면 가장 먼저 보이는 한 줄:
  _"어제 이 시간보다 3.2° 낮아요"_
- **오늘 vs 어제** — 최고·최저 기온(▲▼ 차이 배지), 강수량, 강수확률을 어제 수치와 나란히
- **실시간 비구름 레이더** — 지난 1시간의 실제 강수 이동 + 단기 예측을 지도 위에서 애니메이션으로
- **내일은 오늘보다** — 내일 기온·날씨를 오늘 기준 차이로 미리보기, 급변(±5° 이상)·비·눈은 주의 알림으로 강조
- **위치 기반** — 브라우저 위치 권한으로 현재 동네를 자동 인식 (거부 시 서울 기준)

## 기술 스택

| 영역 | 선택 |
|---|---|
| 프레임워크 | Vite 6 + React 19 + TypeScript |
| 날씨 데이터 | [Open-Meteo](https://open-meteo.com/) — `past_days=1` 파라미터로 어제 실측값 확보 |
| 레이더 | [RainViewer](https://www.rainviewer.com/) 타일 + [Leaflet](https://leafletjs.com/) |
| 지도 | © OpenStreetMap |
| 역지오코딩 | BigDataCloud (클라이언트 무료) |
| 호스팅 | GitHub Pages (정적, 서버리스) |

모든 API가 **무료·인증키 불필요·CORS 허용**이라 백엔드 없이 정적 호스팅만으로 완결됩니다.

## 프로젝트 구조

```
src/
├── lib/
│   ├── compare.ts     # 비교·문구 로직 (순수 함수 — API 의존 없음)
│   ├── weather.ts     # Open-Meteo 호출 및 응답 정규화
│   └── geo.ts         # geolocation + 역지오코딩
├── components/
│   └── RadarMap.tsx   # Leaflet + RainViewer 레이더 애니메이션
└── App.tsx            # 화면 구성
```

시간별 데이터는 인덱스 `0–23`이 어제, `24–47`이 오늘 — "어제 같은 시각" 비교는
`temp[now] - temp[now - 24]` 한 줄로 끝나는 구조입니다.

## 개발

```bash
npm install
npm run dev      # http://localhost:5173/Weather-forecasting/
npm run build    # 프로덕션 빌드 (dist/)
npx tsc --noEmit # 타입 체크
```

## 배포

`main` 브랜치에 push하면 GitHub Actions(`.github/workflows/deploy-pages.yml`)가
타입 체크 → 빌드 → GitHub Pages 배포를 자동으로 수행합니다.

## 로드맵

- [ ] 자기 전 푸시 알림 — 내일이 오늘보다 크게 춥거나/덥거나, 비·눈이 올 때 (판단 로직 `tomorrowAlerts`는 구현 완료, 발송 스케줄러만 남음)
- [ ] PWA 설치 지원 (manifest + 서비스워커)
- [ ] 시간별 기온 그래프 — 어제 곡선과 겹쳐 보기
- [ ] `compare.ts` 유닛 테스트
