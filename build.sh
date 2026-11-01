#!/bin/bash
# 1コマンドで「構文チェック → 単体HTML生成 → ドキュメントHTML生成」までやる。
#   ./build.sh
set -e
cd "$(dirname "$0")"

echo "== 構文チェック =="
for f in engine-core.js engine-tools.js asset.js asset-controller.js studio-ui.js check-all-assets.js; do
    node --check "$f" && echo "  ok  $f"
done

echo "== 単体HTML生成 =="
python3 build-city-grid.py

echo "== ドキュメントHTML生成 =="
python3 build-guide.py CITY_GRID_STUDIO.md
python3 build-guide.py OBJECT_GEOMETRY_GUIDE.md
python3 build-guide.py ASSET_JS_GUIDE.md

echo "== できあがり =="
ls -la cyberpunk-city-studio.html CITY_GRID_STUDIO.html OBJECT_GEOMETRY_GUIDE.html ASSET_JS_GUIDE.html
echo "動作の点検は  node check-all-assets.js  （失敗すると exit=1）"
