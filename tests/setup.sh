#!/bin/bash
# Playwright を「毎回ゼロから」使えるようにする準備（1回だけ実行すればよい）。
# node のパッケージ・ブラウザ本体・Chromium が要求する共有ライブラリ（root 権限なしで使うため
# .deb を展開して LD_LIBRARY_PATH で渡す）をそろえる。
set -e
cd "$(dirname "$0")/.."
[ -d node_modules/playwright ] || npm install --silent
npx playwright install chromium >/dev/null 2>&1 || true
LIBS=/tmp/pwlibs
if [ ! -f "$LIBS/usr/lib/x86_64-linux-gnu/libnss3.so" ]; then
    mkdir -p "$LIBS" /tmp/debs && cd /tmp/debs
    for spec in "n/nspr libnspr4" "n/nss libnss3" "libx/libxdamage libxdamage1" \
                "libx/libxext libxext6" "libx/libxres libxres1" "libx/libxkbcommon libxkbcommon0" \
                "a/alsa-lib libasound2" "a/at-spi2-core libatk1.0-0" \
                "a/at-spi2-core libatk-bridge2.0-0" "a/at-spi2-core libatspi2.0-0"; do
        set -- $spec
        url="http://deb.debian.org/debian/pool/main/$1/"
        f=$(curl -s "$url" | grep -o "$2_[0-9][^\"]*_amd64\.deb" | grep -v deb11 | sort -u | tail -1)
        [ -n "$f" ] && { [ -f "$f" ] || curl -sO "$url$f"; dpkg-deb -x "$f" "$LIBS"; }
    done
fi
# 保存済み画素基準はギズモの日本語ラベルにも依存する。
# システムにフォントをインストールせず、基準作成時のフォントと設定を用意する。
FONTS=/tmp/pwfonts
if [ ! -f "$FONTS/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc" ] || [ ! -f "$FONTS/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf" ]; then
    mkdir -p "$FONTS" /tmp/pwfontdebs
    (cd /tmp/pwfontdebs && apt-get download fonts-wqy-zenhei fonts-liberation >/dev/null && for f in ./*.deb; do dpkg-deb -x "$f" "$FONTS"; done)
fi
mkdir -p "$FONTS/fontconfig"
rm -rf "$FONTS/fontconfig/conf.d"
cp -aL /etc/fonts/fonts.conf /etc/fonts/conf.d "$FONTS/fontconfig/"
cp "$FONTS/etc/fonts/conf.avail/25-wqy-zenhei.conf" "$FONTS/fontconfig/conf.d/25-wqy-zenhei.conf"
cp "$FONTS/etc/fonts/conf.avail/64-wqy-zenhei.conf" "$FONTS/fontconfig/conf.d/64-wqy-zenhei.conf"
# config内の順序を維持したまま、ローカルのフォントディレクトリを追加する。
FONT_CONF="$FONTS/fontconfig/fonts.conf" python3 - <<'PY'
import os
p = os.environ['FONT_CONF']
s = open(p, encoding='utf-8').read()
s = s.replace('</fontconfig>', '<dir>/tmp/pwfonts/usr/share/fonts</dir>\n</fontconfig>')
open(p, 'w', encoding='utf-8').write(s)
PY
echo "準備できました。テストは tests/run.sh <スクリプト> で実行する。"
