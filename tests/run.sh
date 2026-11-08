#!/bin/bash
# テストの実行役。Chromium 用のライブラリを LD_LIBRARY_PATH で渡してから node を起動する。
cd "$(dirname "$0")/.."
# Tool containers may start without cached Node modules, Chromium, or its private shared libraries.
# Recreate them automatically so a fresh workspace can run the same test command.
if [ ! -d "$PWD/node_modules/playwright" ] || [ ! -f /tmp/pwlibs/usr/lib/x86_64-linux-gnu/libnspr4.so ] || ! find "$HOME/.cache/ms-playwright" -type f -name chrome-headless-shell -perm -111 -print -quit 2>/dev/null | grep -q .; then
    bash tests/setup.sh
fi
export LD_LIBRARY_PATH=/tmp/pwlibs/usr/lib/x86_64-linux-gnu:$LD_LIBRARY_PATH
export NODE_PATH="$PWD/node_modules"
# setup.sh で用意したフォントを使う。呼出側で明示された設定は尊重する。
if [ -z "${FONTCONFIG_FILE:-}" ] && [ -f /tmp/pwfonts/fontconfig/fonts.conf ]; then
    export FONTCONFIG_FILE=/tmp/pwfonts/fontconfig/fonts.conf
fi
exec node "$1" "${@:2}"
