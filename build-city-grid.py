#!/usr/bin/env python3
"""City Grid Studio のソースを結合する小さなビルドスクリプト。

ソースの役割:
- engine-lib.js        : 共通の小さな道具箱（隠線の許容量・線の重複よけ）
- engine-core.js       : 共有状態・投影・基本図形
- engine-gizmo.js      : ギズモ・当たり判定・ドラッグ・アセットの寸法
- engine-render.js     : 書き出し範囲・隠れ線・線画レイヤー・グリッド・描画
- engine-input.js      : ポインター・ピンチ・消しゴム・モード切替
- engine-io.js         : 画像書き出し・参考写真・保存/読み込み・起動
- asset.js             : アセット形状・正規化
- asset-controller.js  : アセット配置・JSON・棚UI
- studio-lib.js        : studio-ui.js と studio-floorplan.js が共有する小さな道具箱
- studio-floorplan.js : 間取りモード（選択・移動・回転・寸法編集）
- studio-ui.js         : パネル・プリセット・初期化（間取りは studio-floorplan.js）

cyberpunk-city-studio.html は生成物なので、直接編集せず、
このスクリプトでソースから再生成する。

（2026-11-01）以前は engine.js / script.js という結合版も書き出していたが、
どこからも読み込まれておらず、ソース＋単体HTMLと内容が重複するだけだったため廃止した。
配布物は単体HTML 1本、開発用は index.html＋ソース5本に統一している。
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def read(name: str) -> str:
    """ワークスペース直下のソースを読む。"""
    return (ROOT / name).read_text(encoding="utf-8")


def write(name: str, text: str) -> None:
    """UTF-8で生成物を書き出す。"""
    (ROOT / name).write_text(text, encoding="utf-8")


def strip_comments(src: str) -> str:
    """コメントと空行を落とす（--min のときだけ使う）。

    文字列・テンプレート・正規表現の中身は壊さないよう、1文字ずつ状態を見て
    「文字列の外にある // と /* */」だけを落とす簡易スキャナ。
    行中のコードはそのまま残すので、動作は変わらない。
    """
    out = []
    i = 0
    n = len(src)
    quote = None
    while i < n:
        ch = src[i]
        if quote is None:
            if ch == "/" and i + 1 < n and src[i + 1] == "/":
                j = src.find("\n", i)
                i = n if j < 0 else j
                continue
            if ch == "/" and i + 1 < n and src[i + 1] == "*":
                j = src.find("*/", i + 2)
                i = n if j < 0 else j + 2
                continue
            if ch in "'\"`":
                quote = ch
            out.append(ch)
            i += 1
            continue
        if ch == "\\":
            out.append(src[i : i + 2])
            i += 2
            continue
        if ch == quote:
            quote = None
        out.append(ch)
        i += 1
    text = "\n".join(line.rstrip() for line in "".join(out).split("\n"))
    return "\n".join(line for line in text.split("\n") if line.strip())


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
    """ソース順を固定して、配布用の単体HTMLを更新する。

    `--min` を付けると、コメントと空行を落とした軽量版
    （cyberpunk-city-studio.min.html）も書き出す。中身の動作は同じ。
    """
    want_min = "--min" in sys.argv[1:]
    lib = read("engine-lib.js")
    core = read("engine-core.js")
    tools = "\n".join(
        read(name)
        for name in ("engine-gizmo.js", "engine-render.js", "engine-input.js", "engine-io.js")
    )
    asset = read("asset.js")
    controller = read("asset-controller.js")
    # 読み込み順は index.html と同じ（lib → ui → floorplan）。
    ui = read("studio-lib.js") + "\n" + read("studio-ui.js") + "\n" + read("studio-floorplan.js")

    # 単体HTMLの「engine」ブロック＝コア＋入力／描画ツール。
    engine = lib + "\n" + core + "\n" + tools

    # 単体HTMLは、engineとstudio-uiの2ブロックへ同じソースを埋め込む。
    html = read("cyberpunk-city-studio.html")
    # CSSも単体HTMLへ埋め込む。以前は手で貼っていたため、studio.css を直しても
    # 配布用HTMLだけ古い見た目のまま、という食い違いが起きた。
    html = inject_style(html, "<style>", read("style.css"))
    html = inject_style(html, '<style id="studio-ui">', read("studio.css"))
    html = inject_script(html, '<script id="engine">', engine)
    html = inject_script(html, '<script id="studio-ui">', asset + "\n" + controller + "\n" + ui)
    write("cyberpunk-city-studio.html", html)
    if want_min:
        # コメントを落とした軽量版。ソース側は説明を残したまま、配布用だけ小さくする。
        small = strip_comments(html)
        write("cyberpunk-city-studio.min.html", small)
        print(f"軽量版: cyberpunk-city-studio.min.html  {len(small):,} 文字")


if __name__ == "__main__":
    main()
