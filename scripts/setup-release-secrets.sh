#!/usr/bin/env bash
# 서명 키를 GitHub 저장소 비밀값으로 한 번 등록한다 — 그 뒤로는 main 에 머지만 하면 APK 가 자동 릴리스된다
# (.github/workflows/android-release.yml). 서명 키(android/keystore.properties + weather-release.jks)가 있는 PC 에서만.
#   bash scripts/setup-release-secrets.sh
# 등록하는 비밀값: ANDROID_KEYSTORE_BASE64 · ANDROID_KEYSTORE_PASSWORD · ANDROID_KEY_ALIAS · ANDROID_KEY_PASSWORD
# 값은 화면에 찍지 않는다. 지우려면: gh secret delete <이름> -R DoyeonKR/Weather-forecasting
set -euo pipefail
cd "$(dirname "$0")/.."
REPO=DoyeonKR/Weather-forecasting
PROPS=android/keystore.properties

fail() { echo "✖ $*" >&2; exit 1; }
[ -f "$PROPS" ] || fail "$PROPS 가 없어요 — 서명 키가 있는 PC 에서 실행하세요"
gh auth status >/dev/null 2>&1 || fail "gh 로그인이 필요해요 (gh auth login)"

prop() { grep -E "^[[:space:]]*$1[[:space:]]*=" "$PROPS" | head -1 | cut -d= -f2- | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//' | tr -d '\r'; }
STORE_FILE=$(prop storeFile)
[ -n "$STORE_FILE" ] || fail "$PROPS 에 storeFile 이 없어요"
# storeFile 은 android/app 기준 경로 (app/build.gradle 의 file())
case "$STORE_FILE" in
  /*) JKS="$STORE_FILE" ;;
  *) JKS="android/app/$STORE_FILE" ;;
esac
[ -f "$JKS" ] || fail "키 파일을 못 찾았어요: $JKS"
for k in storePassword keyAlias keyPassword; do [ -n "$(prop $k)" ] || fail "$PROPS 에 $k 가 없어요"; done

echo "키 파일: $JKS"
echo "저장소: $REPO 에 비밀값 4개를 등록합니다."
base64 < "$JKS" | tr -d '\n' | gh secret set ANDROID_KEYSTORE_BASE64 -R "$REPO"
printf '%s' "$(prop storePassword)" | gh secret set ANDROID_KEYSTORE_PASSWORD -R "$REPO"
printf '%s' "$(prop keyAlias)" | gh secret set ANDROID_KEY_ALIAS -R "$REPO"
printf '%s' "$(prop keyPassword)" | gh secret set ANDROID_KEY_PASSWORD -R "$REPO"
gh secret list -R "$REPO" | grep ANDROID_ || true

echo
echo "✔ 등록 끝. 지금 버전을 바로 릴리스하려면:"
echo "  gh workflow run android-release.yml -R $REPO"
echo "  (앱 코드가 지난 릴리스 뒤로 바뀌었고 그 버전 릴리스가 아직 없을 때만 실제로 릴리스한다)"
