#!/bin/bash
# 1コマンドで構文チェックと配布用単体HTMLの生成を行う。
# 解説書は CODE_GUIDE.html を直接編集・閲覧する。
#   ./build.sh
set -e
cd "$(dirname "$0")"

echo "== 構文チェック =="
for f in engine-lib.js engine-core.js engine-gizmo.js engine-render.js engine-input.js engine-io.js asset.js asset-kit.js asset-kit-parts.js asset-kit-assets.js asset-controller.js studio-lib.js studio-floorplan.js studio-canvas-controls.js studio-ui.js check-all-assets.js; do
    node --check "$f" && echo "  ok  $f"
done

echo "== 単体HTML生成 =="
python3 build-city-grid.py "$@"

echo "== できあがり =="
ls -la cyberpunk-city-studio.html
echo "動作の点検は  node check-all-assets.js  （失敗すると exit=1）"
