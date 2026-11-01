#!/usr/bin/env python3
"""City Grid Studio のソースを結合する小さなビルドスクリプト。

ソースの役割:
- engine-core.js       : 共有状態・投影・基本図形
- engine-tools.js      : ギズモ・描画・入力・保存
- asset.js             : アセット形状・正規化
- asset-controller.js  : アセット配置・JSON・棚UI
- studio-ui.js         : パネル・間取り・プリセット

cyberpunk-city-studio.html は生成物なので、直接編集せず、
このスクリプトでソースから再生成する。

（2026-11-01）以前は engine.js / script.js という結合版も書き出していたが、
どこからも読み込まれておらず、ソース＋単体HTMLと内容が重複するだけだったため廃止した。
配布物は単体HTML 1本、開発用は index.html＋ソース5本に統一している。
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


def inject_style(html: str, marker: str, content: str) -> str:
    """指定したstyleタグの中身だけを置き換える（CSSの二重管理を防ぐ）。"""
    start = html.index(marker) + len(marker)
    end = html.index("</style>", start)
    return html[:start] + "\n" + content + "\n" + html[end:]


def main() -> None:
    """ソース順を固定して、配布用の単体HTMLを更新する。"""
    core = read("engine-core.js")
    tools = read("engine-tools.js")
    asset = read("asset.js")
    controller = read("asset-controller.js")
    ui = read("studio-ui.js")

    # 単体HTMLの「engine」ブロック＝コア＋入力／描画ツール。
    engine = core + "\n" + tools

    # 単体HTMLは、engineとstudio-uiの2ブロックへ同じソースを埋め込む。
    html = read("cyberpunk-city-studio.html")
    # CSSも単体HTMLへ埋め込む。以前は手で貼っていたため、studio.css を直しても
    # 配布用HTMLだけ古い見た目のまま、という食い違いが起きた。
    html = inject_style(html, "<style>", read("style.css"))
    html = inject_style(html, '<style id="studio-ui">', read("studio.css"))
    html = inject_script(html, '<script id="engine">', engine)
    html = inject_script(html, '<script id="studio-ui">', asset + "\n" + controller + "\n" + ui)
    write("cyberpunk-city-studio.html", html)


if __name__ == "__main__":
    main()
