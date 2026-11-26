# 무능한 날씨예측기 — 작업 규칙

웹앱(Vite + React, GitHub Pages) + 그 사이트를 여는 안드로이드 앱(Capacitor, 네이티브 홈 화면 위젯).
구조·배포·릴리스 설명은 README.md 가 정본이다. 이 파일은 작업할 때 지킬 규칙만 둔다.

## 남은 작업: 서명 키 등록 + v1.0.108 첫 자동 릴리스 (2026-11-26 기준 미완료)

사용자가 "키 옮겼어", "릴리스 이어서 해줘", "서명 키 등록해줘" 처럼 말하면 이 절차를 그대로 따른다. 끝나면 이 절을 지운다.

**지금 상태**
- v1.0.108(위젯 새 디자인·글 잘림 수정, 앱 쿠팡 광고 수정, 앱 안 업데이트)은 main 에 머지됐고 웹은 배포됐다. **APK 는 아직 릴리스 안 됨** — GitHub Latest 릴리스는 `android-v1.0.106`.
- 자동 릴리스 워크플로(`.github/workflows/android-release.yml`)는 있지만 저장소 비밀값(`ANDROID_*` 4개)이 없어 "서명 키 비밀값 없음" 경고만 남기고 건너뛴다.
- 서명 키는 **1.0.106 을 빌드한 다른 PC** 에만 있다 (Claude 세션을 돌린 Mac 에는 없음을 확인함). 사용자가 그 PC 에서 이 Mac 의 다운로드 폴더(`~/Downloads`)로 옮겨 오기로 했다.
- 키를 옮기기 전에도 서비스는 정상이다 (사이트·「앱 받기」·기존 앱 모두 그대로). 미루는 동안 앱 안 쿠팡 광고·위젯 수정만 사용자에게 안 간다.

**필요한 파일 2개** — 원래 레포의 `android/` 안에 있던 것
- `keystore.properties` (`storeFile`·`storePassword`·`keyAlias`·`keyPassword`)
- `.jks` 키 파일 (대개 `weather-release.jks`. 이름은 `keystore.properties` 의 `storeFile` 이 정본)

**절차** (Claude 가 직접 실행한다. 비밀번호·키 내용은 화면·대화·커밋 어디에도 찍지 않는다)
1. 파일 찾기: 이 레포의 `android/` 에 있으면 그대로, 없으면 `~/Downloads` 등 사용자가 말한 곳에서 찾아 `android/` 로 복사한다
   (`keystore.properties` 와 `android/*.jks` 는 `.gitignore` 에 있다 — 커밋되지 않는지 `git status` 로 확인).
   `storeFile` 은 `android/app` 기준 경로다 → 키를 `android/weather-release.jks` 에 두면 `storeFile=../weather-release.jks`.
2. **같은 키인지 먼저 확인** — 다르면 여기서 멈추고 사용자에게 알린다. 다른 키로 릴리스하면 기존 사용자 전원이 업데이트하지 못한다.
   ```bash
   KT="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/keytool"   # 맥. 다른 곳이면 JDK 의 keytool
   "$KT" -list -v -keystore android/weather-release.jks -alias <keyAlias> -storepass <storePassword> | grep -E "Owner|소유자|SHA256"
   ```
   기대값 (릴리스된 v1.0.106 APK 의 인증서):
   - 소유자: `CN=Eojeboda Weather, O=DoyeonKR, C=KR`
   - SHA-256: `8E:8C:6F:DE:6C:52:EE:B8:1A:BB:6B:6B:60:92:A7:26:66:7F:D3:83:49:06:E8:98:F7:B4:99:C3:3E:31:D5:F7:B2`
     (apksigner 표기로는 `8e8c6fde6c52eeb81abb6b6092a726667fd3834906e898f7b499c33e31d5f7b2`)
   비밀번호는 `keystore.properties` 에서 읽어 넘기고, 명령을 사용자에게 보여줄 때는 가린다.
3. 비밀값 등록: `bash scripts/setup-release-secrets.sh` (gh 로그인 필요. `gh secret list -R DoyeonKR/Weather-forecasting` 에 `ANDROID_` 4개가 보이면 성공)
4. 릴리스 실행: `gh workflow run android-release.yml -R DoyeonKR/Weather-forecasting` → `gh run list --workflow android-release.yml -R DoyeonKR/Weather-forecasting --limit 1` 로 실행 id 를 찾아 `gh run watch <id> --exit-status`
   - "서명·버전 확인" 단계가 실패하면 키가 다르거나 versionCode 문제 — 로그를 읽고 사용자에게 알린다. 확인 단계를 우회하지 않는다.
5. 확인: `gh release view android-v1.0.108 -R DoyeonKR/Weather-forecasting` 가 Latest 이고 `eojeboda-weather.apk` 가 붙어 있는지,
   받은 APK 를 `apksigner verify --print-certs` 로 봐서 SHA-256 이 위 기대값과 같은지.
6. 정리: `~/Downloads` 에 옮겨 온 키 파일은 어디에 보관할지 사용자에게 묻는다 (지우기 전에 반드시 백업 여부 확인 — 키를 잃으면 앱 업데이트를 영영 못 준다).
   이 "남은 작업" 절을 지우고, README "릴리스 절차"의 '현재 상태' 줄을 고쳐 `docs:` 커밋으로 main 에 push.

**키를 끝내 못 찾으면** — 새 키를 만들 수는 있지만 사용자 결정이 필요하다: 기존 1.0.106 설치자(2026-11-26 기준 다운로드 5회)는 앱을 지우고 새로 깔아야 하고,
워크플로의 "지난 릴리스와 같은 키" 확인도 한 번 우회해야 한다. 사용자에게 이 둘을 설명하고 동의받기 전에는 진행하지 않는다.

## 변경할 때마다 같이 고칠 것 (빠뜨리지 않는다)

| 무엇을 바꿨나 | 같이 고칠 것 |
|---|---|
| 사용자에게 보이는 기능·문구·동작 | `CHANGELOG.md` 새 버전 항목 + `package.json` version 올리기 |
| 기능 추가·삭제, 파일 추가·이동, 새 설정·환경변수·명령, 배포·릴리스 방식 | `README.md` 의 해당 절 (주요 기능 / 기술 스택 / 프로젝트 구조 / 개발 / 배포 / 안드로이드 앱 / 로드맵) |
| 안드로이드 네이티브 (`android/`, `capacitor.config.ts`, `native-shell/`) | 위 둘 (버전을 꼭 올린다 — 안 올리면 자동 릴리스가 안 된다) + 사용자에게 "머지하면 APK 가 자동 릴리스되고 앱 안 카드로 간다"고 알린다 |
| 로드맵 항목을 끝냈다 | `README.md` 로드맵 체크 |

작업을 마치기 전에 README 가 실제 코드와 어긋난 곳이 없는지 한 번 훑는다. 어긋나면 같은 커밋이나 바로 다음 `docs:` 커밋으로 고친다.

## 버전·커밋

- 버전은 `package.json` 의 `version` 한 곳에서만 올린다. 안드로이드 versionName/versionCode 는 여기서 자동으로 온다 (`android/app/build.gradle`) — 직접 고치지 않는다.
- 사용자에게 보이는 변경 커밋은 제목 끝에 버전을 붙인다: `feat: 내일 아침 미세먼지 예보 v1.0.100`
- conventional prefix(`feat:`/`fix:`/`refactor:`/`perf:`/`docs:`/`chore:`) + 한국어. 본문에 **왜** 바꿨는지(무엇이 잘못됐고 무엇이 달라지는지)를 적는다.
- CHANGELOG 항목의 첫 줄은 안드로이드 릴리스 노트 첫 줄 → 앱 안 업데이트 카드 설명이 된다. 사용자 말로 짧게.

## 안드로이드

- 서명 키(`android/keystore.properties`, `weather-release.jks`)는 절대 커밋하지 않는다. 키가 없는 PC 에서는 릴리스를 만들지 않는다.
- 릴리스는 `.github/workflows/android-release.yml` 이 main 머지 때 자동으로 한다 (앱 코드 변경 + 새 버전일 때만). 손 릴리스는 `bash scripts/release-android.sh`. 태그 `android-v{버전}`, 파일 `eojeboda-weather.apk` 고정 — 앱 안 업데이트와 「앱 받기」 버튼이 기댄다.
- 워크플로의 서명·버전 확인 단계(지난 릴리스와 같은 키, 더 큰 versionCode)를 빼거나 약하게 하지 않는다.
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
