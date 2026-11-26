# 무능한 날씨예측기 — 작업 규칙

웹앱(Vite + React, GitHub Pages) + 그 사이트를 여는 안드로이드 앱(Capacitor, 네이티브 홈 화면 위젯).
구조·배포·릴리스 설명은 README.md 가 정본이다. 이 파일은 작업할 때 지킬 규칙만 둔다.

## 변경할 때마다 같이 고칠 것 (빠뜨리지 않는다)

| 무엇을 바꿨나 | 같이 고칠 것 |
|---|---|
| 사용자에게 보이는 기능·문구·동작 | `CHANGELOG.md` 새 버전 항목 + `package.json` version 올리기 |
| 기능 추가·삭제, 파일 추가·이동, 새 설정·환경변수·명령, 배포·릴리스 방식 | `README.md` 의 해당 절 (주요 기능 / 기술 스택 / 프로젝트 구조 / 개발 / 배포 / 안드로이드 앱 / 로드맵) |
| 안드로이드 네이티브 (`android/`: 위젯, 플러그인, 권한, 매니페스트, 리소스) | 위 둘 + 사용자에게 "APK 릴리스가 필요하다"고 분명히 알린다 (웹 배포만으로는 안 바뀐다) |
| 로드맵 항목을 끝냈다 | `README.md` 로드맵 체크 |

작업을 마치기 전에 README 가 실제 코드와 어긋난 곳이 없는지 한 번 훑는다. 어긋나면 같은 커밋이나 바로 다음 `docs:` 커밋으로 고친다.

## 버전·커밋

- 버전은 `package.json` 의 `version` 한 곳에서만 올린다. 안드로이드 versionName/versionCode 는 여기서 자동으로 온다 (`android/app/build.gradle`) — 직접 고치지 않는다.
- 사용자에게 보이는 변경 커밋은 제목 끝에 버전을 붙인다: `feat: 내일 아침 미세먼지 예보 v1.0.100`
- conventional prefix(`feat:`/`fix:`/`refactor:`/`perf:`/`docs:`/`chore:`) + 한국어. 본문에 **왜** 바꿨는지(무엇이 잘못됐고 무엇이 달라지는지)를 적는다.
- CHANGELOG 항목의 첫 줄은 안드로이드 릴리스 노트 첫 줄 → 앱 안 업데이트 카드 설명이 된다. 사용자 말로 짧게.

## 안드로이드

- 서명 키(`android/keystore.properties`, `weather-release.jks`)는 절대 커밋하지 않는다. 키가 없는 PC 에서는 릴리스를 만들지 않는다.
- 릴리스는 `bash scripts/release-android.sh` 로만 (태그 `android-v{버전}`, 파일 `eojeboda-weather.apk` 고정 — 앱 안 업데이트와 「앱 받기」 버튼이 기댄다).
- 디버그 APK 를 사용자 폰에 깔라고 하지 않는다 (서명이 달라 다음 정식 업데이트가 막힌다).
- 위젯 레이아웃 `widget_weather_compact.xml` 과 `widget_weather_wide.xml` 은 id 를 똑같이 맞춘다 (`WidgetStore` 가 같은 id 로 채운다. 하나에만 있으면 위젯이 "불러올 수 없음"으로 깨진다).
- 위젯을 바꾸면 디버그 미리보기(`WidgetPreviewActivity`, README 참고)로 나쁜 값(-12°, 긴 동네 이름, 빈 화면, 글자 1.3배)과 작은 크기에서 잘리지 않는지 본다.
- `AppUpdate` 는 받는 주소를 앱에 고정한다. 웹에서 주소를 넘겨받게 바꾸지 않는다.

## 확인 명령

```bash
npx tsc -b && npx eslint . && npx vite build
node --test test/*.mjs        # npm test 가 폴더를 못 읽는 Node 에서
```

판단 로직(`src/lib/*.ts`)을 바꾸면 `test/` 에 테스트를 더한다.

## 문체

- 화면 문구·문서는 한국어, 쉬운 말. 코드 주석도 한국어로 "왜"를 적는다.
- 운영 절차 문서에는 원복(rollback) 방법을 함께 적는다.
