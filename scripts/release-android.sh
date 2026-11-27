#!/usr/bin/env bash
# 안드로이드 앱(APK) 손 릴리스 — 평소에는 GitHub Actions(.github/workflows/android-release.yml)가
# main 에 머지될 때 알아서 한다. 이 스크립트는 Actions 를 못 쓸 때의 대안이다.
# 서명 키(android/keystore.properties + weather-release.jks)가 있는 PC 에서만.
#   1) package.json 버전을 올리고 CHANGELOG 를 쓴 커밋을 main 에 push
#   2) bash scripts/release-android.sh
# 앱 버전은 package.json 에서 오고(build.gradle), 태그는 android-v{버전}. 앱 안 업데이트(src/lib/appUpdate.ts)가
# GitHub 의 Latest 릴리스 태그와 설치된 앱 버전을 비교하고, eojeboda-weather.apk 를 받아 설치한다.
# 원복: 릴리스를 지우면(gh release delete android-v{버전} --cleanup-tag) 앱 안 알림이 바로 이전 Latest 로 돌아간다.
#       이미 설치한 사람은 버전을 더 올려 다시 릴리스해야 덮어 설치된다(낮은 버전은 위에 못 깐다).
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./package.json').version")
TAG="android-v$VERSION"
APK_NAME=eojeboda-weather.apk

fail() { echo "✖ $*" >&2; exit 1; }
[ -f android/keystore.properties ] || fail "android/keystore.properties 가 없어요 — 서명 키가 있는 PC 에서 실행하세요"
git diff --quiet HEAD || fail "커밋 안 한 변경이 있어요"
[ -n "$(git branch -r --contains HEAD)" ] || fail "지금 커밋이 GitHub 에 올라가 있지 않아요 (git push 먼저)"
gh release view "$TAG" >/dev/null 2>&1 && fail "$TAG 릴리스가 이미 있어요 — package.json 버전을 올리세요"
grep -q "^## v$VERSION " CHANGELOG.md || fail "CHANGELOG.md 에 v$VERSION 항목이 없어요"

npx cap sync android
(cd android && sh ./gradlew assembleRelease)
APK=android/app/build/outputs/apk/release/app-release.apk
[ -f "$APK" ] || fail "서명된 APK 가 없어요 (unsigned 만 있으면 keystore.properties 를 확인)"

OUT=$(mktemp -d)
cp "$APK" "$OUT/$APK_NAME"

bash scripts/android-release-notes.sh "$VERSION" > "$OUT/notes.md"

echo "── 릴리스 노트 ──"; cat "$OUT/notes.md"; echo "────────────────"
gh release create "$TAG" "$OUT/$APK_NAME" \
  --target "$(git rev-parse HEAD)" \
  --title "무능한 날씨예측기 안드로이드 앱 v$VERSION" \
  --notes-file "$OUT/notes.md" \
  --latest
echo "✔ $TAG 릴리스 완료 — 앱 안 카드는 앱을 열거나 돌아올 때 뜬다 (확인 결과 10분 저장)"
