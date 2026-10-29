#!/usr/bin/env python3
"""Markdown を「参考書風」の HTML へ変換する小さなビルドスクリプト。

    python3 build-guide.py ASSET_JS_GUIDE.md      -> ASSET_JS_GUIDE.html
    python3 build-guide.py CITY_GRID_STUDIO.md    -> CITY_GRID_STUDIO.html
    python3 build-guide.py *.md                   -> まとめて変換

・外部CSS/JS/フォントは読み込まない（プレビューでもそのまま表示できる）
・見出し・表・コード・引用（呼び出しボックス）を参考書風に整える
・キーワードは自動でマーカー／赤字／青字にする（HIGHLIGHTS の表で調整）
"""

import html
import re
import sys
from pathlib import Path

# --- 強調したい語句（本文中のみ。コードの中には効かない） -------------------
# (正規表現, 種類, 文書内で強調する上限回数)  種類: mk=マーカー / rd=赤字 / bl=青字 / gr=緑字
HIGHLIGHTS = [
    # いちばん大事な結論（マーカー）
    (r"板厚は斜面に直角で一定", "mk", 3),
    (r"斜面に直角な距離", "mk", 2),
    (r"1形状 ?= ?1関数", "mk", 3),
    (r"ra・rb が「半分」", "mk", 1),
    (r"同じ寸法計算[^。]*共有", "mk", 2),
    (r"エラー0", "gr", 3),
    (r"検算", "gr", 4),
    # 注意（赤）
    (r"必ず専用の点列", "rd", 2),
    (r"必ず専用の三角形分割が必要", "rd", 1),
    (r"包絡箱", "rd", 5),
    (r"捨てられます", "rd", 1),
    (r"めり込", "rd", 2),
    (r"事故", "rd", 2),
    (r"塗り替え", "rd", 1),
    (r"壊れ", "rd", 2),
    # 用語（青）
    (r"ローカル座標", "bl", 3),
    (r"ワールド座標", "bl", 3),
    (r"外接範囲", "bl", 3),
    (r"法線方向", "bl", 4),
    (r"マイター", "bl", 2),
    (r"耳切り法", "bl", 2),
    (r"正規化", "bl", 2),
]

_count = {}

CALLOUT_KINDS = [
    ("**ポイント**", "point", "ポイント"),
    ("**注意**", "warn", "注意"),
    ("**用語**", "term", "用語"),
    ("**計算**", "calc", "計算"),
    ("**重要**", "warn", "重要"),
]

CSS = """
:root{
  --ink:#20272f; --sub:#5b6672; --line:#dbe2ea; --bg:#ffffff; --tint:#f5f8fc;
  --navy:#12304f; --blue:#1565c0; --red:#d32f2f; --green:#2e7d32; --amber:#ffd54f;
}
*{box-sizing:border-box}
body{
  margin:0; background:#eef2f7; color:var(--ink);
  font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",
              "Meiryo",system-ui,-apple-system,sans-serif;
  line-height:1.95; font-size:16px; letter-spacing:.01em;
}
.page{max-width:940px; margin:0 auto; background:var(--bg);
  padding:54px 62px 90px; box-shadow:0 2px 24px rgba(20,40,70,.10);}
@media (max-width:700px){ .page{padding:28px 20px 60px} body{font-size:15px} }

/* ---- 見出し ---- */
h1{
  font-size:2.0em; line-height:1.5; margin:0 0 .2em; letter-spacing:.02em; color:var(--navy);
  border-bottom:4px solid var(--navy); padding-bottom:.35em;
}
h1::before{
  content:var(--kicker, "REFERENCE"); display:block; font-size:.34em; letter-spacing:.28em;
  color:var(--blue); font-weight:700; margin-bottom:.9em;
}
h2{
  font-size:1.42em; margin:2.6em 0 .9em; padding:.42em .0em .42em .6em; color:#fff;
  background:linear-gradient(90deg,var(--navy),#2f6f9e 70%,#4b93c0);
  border-radius:6px; letter-spacing:.02em;
}
h3{
  font-size:1.14em; margin:2.0em 0 .7em; padding:.1em 0 .3em .55em;
  color:var(--navy); border-left:7px solid var(--blue); border-bottom:1px dotted var(--line);
}
h4{ font-size:1.02em; margin:1.5em 0 .5em; color:var(--blue); }
h2+*, h3+*, h4+*{ margin-top:.2em }

p{ margin:.75em 0; text-align:justify; }
strong{ color:var(--navy); }
a{ color:var(--blue); text-decoration:none; border-bottom:1px solid #b8d4f0; }

/* ---- マーカー・色文字 ---- */
.mk{ background:linear-gradient(transparent 58%, var(--amber) 58%, #ffe680 96%, transparent 96%);
     font-weight:700; padding:0 .06em; }
.rd{ color:var(--red); font-weight:700; }
.bl{ color:var(--blue); font-weight:700; }
.gr{ color:var(--green); font-weight:700; }

/* ---- コード ---- */
code{
  background:#fdf0f3; color:#b3135a; border:1px solid #f6d3dd; border-radius:4px;
  padding:.06em .38em; font-size:.9em; font-weight:600; white-space:nowrap;
  font-family:"SFMono-Regular",Consolas,"Courier New",monospace;
}
pre{
  background:#10192b; color:#e6edf6; border-radius:8px; padding:16px 20px;
  overflow-x:auto; line-height:1.65; border-left:6px solid var(--blue);
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.06); margin:1em 0;
}
pre code{ background:none; border:0; color:inherit; padding:0; font-weight:400; white-space:pre;
  font-size:.86em; }

/* ---- 表 ---- */
table{ width:100%; border-collapse:separate; border-spacing:0; margin:1.1em 0;
  font-size:.9em; background:#fff; border:1px solid var(--line); border-radius:8px;
  overflow:hidden; }
thead th{ background:var(--navy); color:#fff; text-align:left; padding:10px 12px;
  font-weight:700; font-size:.95em; letter-spacing:.02em; border-right:1px solid rgba(255,255,255,.15); }
thead th:last-child{ border-right:0 }
tbody td{ padding:9px 12px; border-top:1px solid var(--line); vertical-align:top; }
tbody tr:nth-child(even){ background:#f7fafd; }
tbody tr:hover{ background:#eef6ff; }
td code{ white-space:normal; word-break:break-word }

/* ---- 引用＝呼び出しボックス ---- */
blockquote{
  margin:1.1em 0; padding:14px 18px 14px 46px; position:relative;
  background:var(--tint); border-left:6px solid var(--blue); border-radius:6px;
  color:#33404e;
}
blockquote::before{
  content:"▶"; position:absolute; left:16px; top:13px; color:var(--blue); font-size:.9em;
}
blockquote p{ margin:.3em 0 }
blockquote.warn{ background:#fff5f5; border-left-color:var(--red) }
blockquote.warn::before{ content:"!"; font-weight:900; color:var(--red); left:20px;
  border:2px solid var(--red); border-radius:50%; width:15px; height:15px; line-height:14px;
  text-align:center; font-size:.7em; top:17px; }
blockquote.point{ background:#fffdf0; border-left-color:#e0a800 }
blockquote.point::before{ content:"★"; color:#e0a800 }
blockquote.term{ background:#f2f6ff; border-left-color:#5c6bc0 }
blockquote.term::before{ content:"?"; font-weight:900; color:#3949ab }
blockquote.calc{ background:#f4fbf6; border-left-color:var(--green) }
blockquote.calc::before{ content:"f(x)"; font-weight:700; color:var(--green); font-size:.72em }

/* ---- リスト ---- */
ul,ol{ margin:.7em 0 .9em; padding-left:1.6em }
li{ margin:.32em 0 }
li::marker{ color:var(--blue); font-weight:700 }
ul ul,ol ol,ul ol,ol ul{ margin:.25em 0 }

hr{ border:0; border-top:2px dashed #cfd9e4; margin:2.4em 0 }

/* ---- 目次 ---- */
.toc{ background:var(--tint); border:1px solid var(--line); border-radius:10px;
  padding:18px 26px 22px; margin:1.6em 0 2.4em; }
.toc h2{ background:none; color:var(--navy); font-size:1.05em; padding:0;
  border-bottom:2px solid var(--blue); border-radius:0; margin:.1em 0 .8em; }
.toc ul{ margin:.2em 0 .4em; padding-left:1.35em; line-height:1.7 }
.toc li{ margin:.12em 0 }
.toc > ul > li{ margin:.3em 0 }
.toc ul ul{ margin:.1em 0 .3em }
.toc a{ border-bottom:none }
.toc a:hover{ text-decoration:underline }

/* ---- ページ先頭の小物 ---- */
.lead{ color:var(--sub); font-size:.95em }
.badge{ display:inline-block; background:var(--navy); color:#fff; font-size:.72em;
  padding:.1em .6em; border-radius:99px; margin-right:.5em; letter-spacing:.08em }

@media print{
  body{ background:#fff } .page{ box-shadow:none; max-width:none; padding:0 }
  pre{ box-shadow:none } h2{ -webkit-print-color-adjust:exact; print-color-adjust:exact }
}
"""


def esc(s: str) -> str:
    return html.escape(s, quote=False)


def slug(text: str) -> str:
    """見出しから目次用のIDを作る（日本語はそのまま、記号は落とす）。"""
    t = re.sub(r"`", "", text)
    t = re.sub(r"[^\w\u3040-\u30ff\u4e00-\u9fff\uff66-\uff9f\- ]", "", t)
    return t.strip().replace(" ", "-").lower() or "section"


def inline(text: str) -> str:
    """行内の書式（コード・太字・リンク・強調色）を処理する。

    コード `...` を先に退避しておくことで、**`code` を含む太字**のような
    入れ子も正しく変換できる。
    """
    codes = []

    def keep_code(m):
        codes.append(m.group(1))
        return "\x01%d\x01" % (len(codes) - 1)

    t = re.sub(r"`([^`]+)`", keep_code, text)
    t = esc(t)

    # リンクの飛び先 (#...) は強調色の対象から外す（href を壊さないため）
    targets = []

    def keep_target(m):
        targets.append(m.group(1))
        return "]\x00%d\x00" % (len(targets) - 1)

    t = re.sub(r"\]\(([^)]+)\)", keep_target, t)

    # 強調色（マーカー・赤字・青字・緑字）
    for pattern, kind, limit in HIGHLIGHTS:
        if _count.get(pattern, 0) >= limit:
            continue

        def repl(m, k=kind, pat=pattern):
            if _count.get(pat, 0) >= limit:
                return m.group(0)
            _count[pat] = _count.get(pat, 0) + 1
            return f'<span class="{k}">{m.group(0)}</span>'

        t = re.sub(pattern, repl, t)

    # 太字・斜体
    t = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", t)

    # リンク
    t = re.sub(r"\[([^\]]+)\]\x00(\d+)\x00",
               lambda m: f'<a href="{targets[int(m.group(2))]}">{m.group(1)}</a>', t)

    # コードを戻す
    t = re.sub(r"\x01(\d+)\x01", lambda m: f"<code>{esc(codes[int(m.group(1))])}</code>", t)
    return t


def convert(md: str) -> str:
    _count.clear()
    lines = md.split("\n")
    out = []
    i = 0
    title = "ドキュメント"
    list_stack = []      # {"tag": "ul"/"ol", "li": li を開いているか} の入れ子
    toc_open = False
    in_para = False
    first_h1_done = False

    def close_para():
        nonlocal in_para
        if in_para:
            out.append("</p>")
            in_para = False

    def close_lists():
        nonlocal list_stack
        while list_stack:
            top = list_stack.pop()
            if top["li"]:
                out.append("</li>")
            out.append(f"</{top['tag']}>")

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        def close_toc():
            nonlocal toc_open
            if toc_open:
                close_lists()
                out.append("</div>")
                toc_open = False

        # --- コードブロック ---
        if stripped.startswith("```"):
            close_toc(); close_para(); close_lists()
            lang = stripped[3:].strip()
            i += 1
            body = []
            while i < len(lines) and not lines[i].strip().startswith("```"):
                body.append(lines[i]); i += 1
            i += 1
            code = "\n".join(body)
            cls = f' class="language-{lang}"' if lang else ""
            out.append(f"<pre><code{cls}>{esc(code)}</code></pre>")
            continue

        # --- 見出し ---
        m = re.match(r"^(#{1,6})\s+(.*)$", line)
        if m:
            if not (len(m.group(1)) == 2 and re.sub(r"[\s`]", "", m.group(2)) == "目次"):
                close_toc()
            close_para(); close_lists()
            level, text = len(m.group(1)), m.group(2).strip()
            text_html = inline(text)
            sid = slug(text)
            if level == 2 and re.sub(r"[\s`]", "", text) == "目次":
                out.append('<div class="toc">')
                out.append(f'<h2 id="{sid}">{text_html}</h2>')
                toc_open = True
                i += 1
                continue
            if level == 1 and not first_h1_done:
                title = re.sub(r"`", "", text)
                out.append(f'<h1 id="{sid}">{text_html}</h1>')
                first_h1_done = True
            else:
                out.append(f'<h{level} id="{sid}">{text_html}</h{level}>')
            i += 1
            continue

        # --- 水平線 ---
        if re.match(r"^-{3,}$", stripped):
            close_toc(); close_para(); close_lists()
            out.append("<hr>")
            i += 1
            continue

        # --- 表 ---
        if stripped.startswith("|") and i + 1 < len(lines) and re.match(r"^\|[\s:\-|]+\|$", lines[i + 1].strip()):
            close_toc(); close_para(); close_lists()
            header = [c.strip() for c in stripped.strip("|").split("|")]
            i += 2
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")])
                i += 1
            out.append("<table><thead><tr>" +
                       "".join(f"<th>{inline(c)}</th>" for c in header) +
                       "</tr></thead><tbody>")
            for r in rows:
                out.append("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>")
            out.append("</tbody></table>")
            continue

        # --- 引用（呼び出しボックス）---
        if stripped.startswith(">"):
            close_toc(); close_para(); close_lists()
            buf = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                buf.append(lines[i].strip()[1:].strip())
                i += 1
            text = " ".join(buf)
            kind = ""
            for marker, k, label in CALLOUT_KINDS:
                if text.startswith(marker):
                    text = text[len(marker):].lstrip("：: ").strip()
                    kind = k
                    text = f"{label}：{text}"
                    break
            cls = f' class="{kind}"' if kind else ""
            out.append(f"<blockquote{cls}><p>{inline(text)}</p></blockquote>")
            continue

        # --- リスト ---
        m = re.match(r"^(\s*)([-*+]|\d+\.)\s+(.*)$", line)
        if m:
            close_para()
            indent = len(m.group(1)) // 2
            ordered = bool(re.match(r"\d+\.", m.group(2)))
            want = "ol" if ordered else "ul"
            depth = indent + 1  # この項目が入るべき入れ子の深さ
            while len(list_stack) > depth:
                top = list_stack.pop()
                if top["li"]:
                    out.append("</li>")
                out.append(f"</{top['tag']}>")
            if len(list_stack) == depth:
                # 同じ深さに別の種類のリストが来たら、いったん閉じて開き直す
                if list_stack[-1]["tag"] != want:
                    top = list_stack.pop()
                    if top["li"]:
                        out.append("</li>")
                    out.append(f"</{top['tag']}>")
                    out.append(f"<{want}>")
                    list_stack.append({"tag": want, "li": False})
            else:
                num = re.match(r"(\d+)\.", m.group(2))
                start_attr = f' start="{num.group(1)}"' if (want == "ol" and num and int(num.group(1)) != 1) else ""
                out.append(f"<{want}{start_attr}>")
                list_stack.append({"tag": want, "li": False})
            if list_stack[-1]["li"]:
                out.append("</li>")
            out.append(f"<li>{inline(m.group(3))}")
            list_stack[-1]["li"] = True
            i += 1
            continue

        # --- 空行 ---
        if not stripped:
            close_para(); close_lists()
            i += 1
            continue

        # --- 箇条書きの続き行（インデントされた補足）---
        if list_stack and list_stack[-1]["li"] and re.match(r"^\s{2,}\S", line):
            out.append("<br>")
            out.append(inline(stripped))
            i += 1
            continue

        # --- 段落 ---
        close_toc(); close_lists()
        if not in_para:
            out.append("<p>")
            in_para = True
        else:
            out.append("<br>")
        out.append(inline(stripped))
        i += 1

    close_para(); close_lists()
    return title, "\n".join(out)


def main(paths):
    for p in paths:
        src = Path(p)
        md = src.read_text(encoding="utf-8")
        title, body = convert(md)
        kicker = "ASSET.JS REFERENCE" if "asset" in src.name.lower() else "STUDIO DOCUMENT"
        doc = f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<style>{CSS}</style>
</head>
<body>
<div class="page" style="--kicker:'{kicker}';">
{body}
</div>
</body>
</html>
"""
        dst = src.with_suffix(".html")
        dst.write_text(doc, encoding="utf-8")
        print(f"{src} -> {dst}  ({len(doc):,} bytes)")


if __name__ == "__main__":
    main(sys.argv[1:] or ["ASSET_JS_GUIDE.md"])
