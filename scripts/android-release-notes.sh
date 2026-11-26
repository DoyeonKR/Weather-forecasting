#!/usr/bin/env bash
# 안드로이드 릴리스 노트: CHANGELOG 의 그 버전 항목(소제목·인용 줄 빼고) + 설치 안내.
# 첫 줄이 앱 안 업데이트 카드에 한 줄 설명으로 나온다. release-android.sh 와 GitHub Actions 가 같이 쓴다.
#   bash scripts/android-release-notes.sh 1.0.108 > notes.md
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION="$1"
APK_NAME=eojeboda-weather.apk
grep -q "^## v$VERSION " CHANGELOG.md || { echo "CHANGELOG.md 에 v$VERSION 항목이 없어요" >&2; exit 1; }
awk -v v="## v$VERSION " 'index($0, v) == 1 { on = 1; next } /^## v/ { on = 0 } on' CHANGELOG.md \
  | grep -v '^###' | grep -v '^>' | sed '/^$/d'
echo
echo "설치: 앱이 있으면 앱 안 「업데이트」 버튼으로. 처음이면 아래 $APK_NAME 을 받아 열기 → \"출처를 알 수 없는 앱\" 허용 → 설치."
echo "Play 프로텍트 경고가 나오면 「세부정보」 → 「무시하고 설치」를 누르세요."
