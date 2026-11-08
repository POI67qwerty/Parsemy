#!/bin/bash
# Linux版Playwright WebKitの回帰。OSの実タッチ／iPad実機Safariの代替ではない。
# 初回: bash tests/setup.sh && npx playwright install --with-deps webkit
set -euo pipefail
cd "$(dirname "$0")/.."
for t in tests/six-orthographic-views.js tests/six-view-camera-lock.js tests/six-view-edit.js tests/six-view-drag.js tests/six-view-save.js tests/depth-projection-optimization.js tests/depth-earlyz-coverage.js tests/fisheye-bvh-pixels.js; do
    echo "=== WebKit: $t ==="
    CITY_TEST_BROWSER=webkit bash tests/run.sh "$t"
done
echo '=== モバイルWebKit: 合成2指ピンチ ==='
CITY_TEST_BROWSER=webkit CITY_TEST_TOUCH=1 bash tests/run.sh tests/webkit-mobile-pointer.js
