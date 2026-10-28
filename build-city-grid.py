#!/usr/bin/env python3
"""City Grid Studio のソースを結合する小さなビルドスクリプト。

ソースの役割:
- engine-core.js       : 共有状態・投影・基本図形
- engine-tools.js      : ギズモ・描画・入力・保存
- asset.js             : アセット形状・正規化
- asset-controller.js  : アセット配置・JSON・棚UI
- studio-ui.js         : パネル・間取り・プリセット

engine.js / script.js / cyberpunk-city-studio.html は生成物なので、
直接編集せず、このスクリプトでソースから再生成する。
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def read(name: str) -> str:
    """ワークスペース直下のソースを読む。"""
    return (ROOT / name).read_text(encoding="utf-8")


def write(name: str, text: str) -> None:
    """UTF-8で生成物を書き出す。"""
    (ROOT / name).write_text(text, encoding="utf-8")


def inject_script(html: str, marker: str, content: str) -> str:
    """指定したscriptタグの中身だけを置き換える。HTML本体は保持する。"""
    start = html.index(marker) + len(marker)
    end = html.index("</script>", start)
    return html[:start] + "\n" + content + "\n" + html[end:]


def main() -> None:
    """ソース順を固定して、3種類の配布用ファイルを更新する。"""
    core = read("engine-core.js")
    tools = read("engine-tools.js")
    asset = read("asset.js")
    controller = read("asset-controller.js")
    ui = read("studio-ui.js")

    # engine.jsはコア＋入力／描画ツールの軽量な結合版。
    engine = core + "\n" + tools
    # script.jsはHTML外部利用向けに、engineへアセットとUIを追加した完全版。
    script = engine + "\n" + asset + "\n" + controller + "\n" + ui
    write("engine.js", engine)
    write("script.js", script)

    # 単体HTMLは、engineとstudio-uiの2ブロックへ同じソースを埋め込む。
    html = read("cyberpunk-city-studio.html")
    html = inject_script(html, '<script id="engine">', engine)
    html = inject_script(html, '<script id="studio-ui">', asset + "\n" + controller + "\n" + ui)
    write("cyberpunk-city-studio.html", html)


if __name__ == "__main__":
    main()
