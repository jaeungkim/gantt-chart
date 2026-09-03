#!/bin/sh
# Regenerate the vendored Pretendard subsets from the upstream variable master.
# Two subsets with complementary unicode-ranges; the site is bilingual and ships both.
# Requires: curl, and pyftsubset (fontTools) built with brotli - `pip install fonttools[woff]`.
set -e
cd "$(dirname "$0")/.."

VERSION=${PRETENDARD_VERSION:-1.3.9}
MASTER=$(mktemp -t PretendardVariable.XXXXXX).woff2
trap 'rm -f "$MASTER"' EXIT

curl -fsSL -o "$MASTER" \
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v${VERSION}/packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2"

FONTS=apps/site/app/fonts

pyftsubset "$MASTER" \
  --unicodes="U+1100-11FF,U+3130-318F,U+A960-A97F,U+AC00-D7A3,U+D7B0-D7FF" \
  --flavor=woff2 --layout-features='*' \
  --output-file="$FONTS/PretendardVariable-korean.woff2"

pyftsubset "$MASTER" \
  --unicodes="U+0-10FF,U+1200-312F,U+3190-A95F,U+A980-ABFF,U+D7A4-D7AF,U+D800-10FFFF" \
  --flavor=woff2 --layout-features='*' \
  --output-file="$FONTS/PretendardVariable-latin.woff2"

ls -l "$FONTS"/*.woff2
