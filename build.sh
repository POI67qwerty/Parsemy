#!/bin/bash
# 1コマンドで「構文チェック → 単体HTML生成 → ドキュメントHTML生成」までやる。
#   ./build.sh
set -e
cd "$(dirname "$0")"

echo "== 構文チェック =="
for f in engine-lib.js engine-core.js engine-gizmo.js engine-render.js engine-input.js engine-io.js asset.js asset-kit.js asset-kit-parts.js asset-kit-assets.js asset-controller.js studio-lib.js studio-floorplan.js studio-canvas-controls.js studio-ui.js check-all-assets.js; do
    node --check "$f" && echo "  ok  $f"
done

echo "== 単体HTML生成 =="
python3 build-city-grid.py "$@"

echo "== ドキュメントHTML生成 =="
python3 build-guide.py CITY_GRID_STUDIO.md
python3 build-guide.py OBJECT_GEOMETRY_GUIDE.md
python3 build-guide.py ASSET_JS_GUIDE.md
python3 build-guide.py ASSET_KIT_GUIDE.md

echo "== できあがり =="
ls -la cyberpunk-city-studio.html CITY_GRID_STUDIO.html OBJECT_GEOMETRY_GUIDE.html ASSET_JS_GUIDE.html
echo "動作の点検は  node check-all-assets.js  （失敗すると exit=1）"
