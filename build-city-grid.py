#!/usr/bin/env python3
"""City Grid Studio のソースを結合する小さなビルドスクリプト。

ソースの役割:
- engine-lib.js        : 共通の小さな道具箱（隠線の許容量・線の重複よけ・clamp）
- engine-core.js       : 共有状態・投影・基本図形
- engine-gizmo.js      : ギズモ・当たり判定・ドラッグ・アセットの寸法
- engine-render.js     : 書き出し範囲・隠れ線・線画レイヤー・グリッド・描画
- engine-input.js      : ポインター・ピンチ・消しゴム・モード切替
- engine-io.js         : 画像書き出し・参考写真・保存/読み込み・起動
- asset.js             : アセット形状・正規化
- asset-kit.js         : アセットを1つの記述から作る道具箱（線と面を同時に）
- asset-kit-parts.js    : 部品カタログ（窓・扉・室外機など、使い回す小物）
- asset-kit-assets.js  : ASSET_KIT で作ったアセットの定義
- asset-controller.js  : アセット配置・JSON・棚UI
- studio-lib.js        : studio-ui.js と studio-floorplan.js が共有する小さな道具箱
- studio-floorplan.js : 間取りモード（選択・移動・回転・寸法編集）
- studio-canvas-controls.js : キャンバス上の共通アセット操作
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

    既定で、コメントと空行を落とした軽量版（cyberpunk-city-studio.min.html）も
    書き出す（配布用の軽い版が古いまま残るのを防ぐため）。
    `--no-min` を付けると軽量版を作らない。中身の動作は同じ。
    """
    want_min = "--no-min" not in sys.argv[1:]
    lib = read("engine-lib.js")
    core = read("engine-core.js")
    tools = "\n".join(
        read(name)
        for name in ("engine-gizmo.js", "engine-render.js", "engine-input.js", "engine-io.js")
    )
    # ASSET_KIT（アセットの道具箱）と、それで作ったアセットは asset.js の直後。
    asset = (
        read("asset.js")
        + "\n" + read("asset-kit.js")
        + "\n" + read("asset-kit-parts.js")
        + "\n" + read("asset-kit-assets.js")
    )
    controller = read("asset-controller.js")
    # 読み込み順は index.html と同じ（lib → ui → floorplan）。
    ui = read("studio-lib.js") + "\n" + read("studio-canvas-controls.js") + "\n" + read("studio-ui.js") + "\n" + read("studio-floorplan.js")

    # 単体HTMLの「engine」ブロック＝コア＋入力／描画ツール。
    engine = lib + "\n" + core + "\n" + tools

    # 単体HTMLは、engineとstudio-uiの2ブロックへ同じソースを埋め込む。
    html = read("cyberpunk-city-studio.html")
    # 標準ビューのボタンは開発版 index.html を正本とし、配布版にも同期する。
    # 旧ビルドはHTML本体を保持するため、新しいボタンだけ置き去りになる。
    marker = '<div class="barGroup" id="standardViews">'
    source = read("index.html")
    # 左上のロゴ表示も index.html と同じ内容にする。
    brand = '<div class="brand">'
    brand_start, brand_target = source.index(brand), html.index(brand)
    brand_end = source.index('</div>\n                <div class="barGroup">', brand_start) + 6
    brand_target_end = html.index('</div>\n                <div class="barGroup">', brand_target) + 6
    html = html[:brand_target] + source[brand_start:brand_end] + html[brand_target_end:]
    source_start, target_start = source.index(marker), html.index(marker)
    source_end, target_end = source.index("</div>", source_start) + 6, html.index("</div>", target_start) + 6
    html = html[:target_start] + source[source_start:source_end] + html[target_end:]
    # 上部の表示切替ボタンも開発版を正本にする（初回はビューの前へ挿入）。
    marker = '<div class="barGroup" id="visibilityTools">'
    source_start = source.index(marker)
    source_end = source.index("</div>", source_start) + 6
    block = source[source_start:source_end]
    if marker in html:
        target_start = html.index(marker)
        target_end = html.index("</div>", target_start) + 6
        html = html[:target_start] + block + html[target_end:]
    else:
        target_start = html.index('<div class="barGroup" id="standardViews">')
        html = html[:target_start] + block + "\n                " + html[target_start:]
    # Three.js比較UIは撤去済み。開発版の既存テンプレートに残っていたボタンも除去する。
    import re
    html = re.sub(r"<button\s+id=\"threePreviewToggle\"[^>]*>.*?</button>", "", html, flags=re.S)
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
