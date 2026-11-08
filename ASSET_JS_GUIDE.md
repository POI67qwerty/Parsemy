# asset.js 完全ガイド

`asset.js` は City Grid Studio の **「アセット（3Dの立体物）をどう作るか」だけを担当するファイル**です。
UI のボタンや編集イベントは `studio-ui.js`、3Dギズモや移動処理は `engine-gizmo.js` が持ち、
`asset.js` は **寸法の計算 → 点列の生成 → 線画オブジェクト** という流れに集中しています。

このガイドは「どんな関数があり、何を計算しているか」を上から順に追えるように書いています。
拾い読みしたいときは §3 の巻末にある **関数一覧（早見表）** から入ってください。

> **読み方**：色付き・マーカー付きの読みやすい版は **`ASSET_JS_GUIDE.html`** です
> （`python3 build-guide.py ASSET_JS_GUIDE.md` で再生成できます）。この Markdown は元データなので、
> 内容を直すときはこちらを編集してから HTML を作り直してください。

---

## 目次

- [1. 全体の処理の流れ](#1-全体の処理の流れ)
- [2. 座標系とデータの約束](#2-座標系とデータの約束)
- [3. セクション別リファレンス](#3-セクション別リファレンス)
  - [3.1 アセットのカタログ（ASSETS）](#31-アセットのカタログassets)
  - [3.2 名前とアイコン](#32-名前とアイコン)
  - [3.3 座標変換と線画ヘルパー](#33-座標変換と線画ヘルパー)
  - [3.4 形状パラメータの計算](#34-形状パラメータの計算)
  - [3.5 パスパイプのベクトル計算](#35-パスパイプのベクトル計算)
  - [3.6 実用ヘルパー](#36-実用ヘルパー)
  - [3.6b 新規アセット用の下請け（2026-10-29 追加・20個）](#36b-新規アセット用の下請け2026-10-29-追加20個)
  - [3.7 窓・屋根・スロープ・建物の共通計算](#37-窓屋根スロープ建物の共通計算)
  - [3.8 アセットごとの線画生成](#38-アセットごとの線画生成)
  - [3.9 保存データの正規化](#39-保存データの正規化)
  - [3.10 既存エンジンへの接続と初期化](#310-既存エンジンへの接続と初期化)
- [4. 計算のツボ（数式で理解する）](#4-計算のツボ数式で理解する)
- [5. 新しいアセットを足す手順](#5-新しいアセットを足す手順)
  - [5-2. 写経：共通部品だけでアセットを1個足す](#5-2-写経共通部品だけでアセットを1個足す)
- [6. 関数一覧（全123関数）](#6-関数一覧全123関数)

---

## 1. 全体の処理の流れ

```
ASSETS（定義表）
   │  asset-controller.js が配置時に読み、ra / rb / h などへ変換
   ▼
オブジェクト o  { type:"asset", asset:"gableRoof", ra, rb, h, ... }
   │
   │  ① genAsset(o)            ← 線画を作る入口
   │     normalizedAsset(o)    ← 値を安全な範囲へ整える（§3.9）
   │     assetLines(q)         ← 形ごとの関数へ振り分け（ASSET_LINE_BUILDERS）
   │        linesGableRoof(ctx) など
   │           pt(o,x,y,z)     ← ローカル座標 → ワールド座標
   │           lineA / polyA   ← 折れ線を「線画オブジェクト」に包む
   ▼
[{ c:色, w:太さ, d3:true, p:[ワールドの点列] }, ...]  → engine-core の描画へ
```

もう1本、**外接範囲（バウンディングボックス）** の流れがあります。

```
obBounds(o)  ← asset.js がエンジンの obBounds を包み直している（§3.10）
   → 選択枠 / ボックス選択 / 間取りのヒット判定 / 移動ギズモが全部これを使う
```

> **ポイント**：`asset.js` の仕事は **「線画」と「外接範囲」という2つの出力**を作ることだけです。
> どちらも同じ寸法計算（`*Params()` 系）を共有するのが、このファイルの設計方針です。

---

## 2. 座標系とデータの約束

### 2.1 オブジェクト `o` の主なプロパティ

| 名前 | 意味 | 例 |
| --- | --- | --- |
| `o.asset` | アセット種別キー。`ASSET_LINE_BUILDERS` の引き当てに使う | `"gableRoof"` |
| `o.ra` | **幅の半分**（x方向） | 幅4.2 なら `2.1` |
| `o.rb` | **奥行きの半分**（y方向） | 奥行き3.2 なら `1.6` |
| `o.h` | **高さ**（z方向、そのまま実寸） | `1.35` |
| `o.k` / `o.PL` | 既存エンジンの「面座標系」（どの平面上に置くか） | `k:1` など |
| `o.rot` | 回転角（度） | `30` |
| `o.ca` / `o.cb` / `o.lift` | 移動量（横位置・奥行位置・浮き） | |
| `o.off` | 追加のオフセット `[x,y,z]` | |
| `o.c` / `o.w` | 線の色 / 太さ | `"#222222"` / `2` |

> **用語**：`ra`・`rb` が **「半分」** なのは既存エンジンの慣習です。`w = ra * 2`、`d = rb * 2` として
> 実寸へ直してから計算します。`h` だけは最初から実寸です
> （`assetLines()` の冒頭で `w` `d` `h` に展開しているのが分かりやすい例です）。
>
> **注意**：この2つを混同すると、**すべてのアセットが縦横2倍／半分**になります。

### 2.2 ローカル座標

形を作るときは **アセット自身を原点にしたローカル座標** で考えます。

- `x` … 幅方向（左右）／ `-w/2` 〜 `+w/2`
- `y` … 奥行き方向（手前 −／奥 +）
- `z` … 高さ方向（床 0 〜 天端 h）

そして描画直前に `pt(o, x, y, z)` でワールド座標へ変換します。ローカル座標で書いておけば、
回転・移動・設置面が何であっても同じ形のまま動きます。

> **ポイント**：形を書くときは **必ずローカル座標**で考えます。`ca`・`cb`・`rot`・`lift` を
> 自分で計算に混ぜてはいけません（`pt()` が全部やってくれます）。

### 2.3 線画オブジェクトの形

`lineA()` が返す1本の線は、既存エンジンの `genShape()` と同じ形式です。

```js
{ c: 色, w: 太さ, ob: o, d3: true, cs: 署名, p: [ [x,y,z], ... ] }
```

`d3:true` は「3Dの点列である」という印で、`p` を画面へ投影して折れ線として描きます。
`cs`（`sigNow()`）は再生成のたびに変わる署名で、キャッシュ判定に使われます。

---

## 3. セクション別リファレンス

### 3.1 アセットのカタログ（`ASSETS`）

棚に並ぶアセットの **定義表**。線画はここでは描かず、「初期サイズ・表示名・アイコン・固有の初期値」を持ちます。

```js
gableRoof: {
    label: "切妻屋根", glyph: "⋀",
    w: 4.2, d: 3.2, h: 1.35,
    roofOverhang: 0.18, roofThickness: 0.12, roofRidgeAxis: "x",
    accent: "#e8b86d",
}
```

- `w` / `d` / `h` は配置時の初期寸法。`asset-controller.js` が `ra = w/2`、`rb = d/2` へ変換します。
- 固有キー（`roofOverhang` や `windowRows` など）は **そのままオブジェクトへコピー**され、
  後述の `*Params()` が既定値として読みます。
- `accent` は棚のアイコン色。`glyph` は棚に出す1文字アイコン。

収録キー（32種）:
`rect` `box` `beveledBox` `cornerCutBox` `circle` `cone` `sphere` `triPrism` `triPyramid`
`sign` `wallSign` `wallSideSign` `awning` `balcony` `uWall` `stall` `stool` `railing`
`pathPipe` `person` `stairs`
`building` `buildingAwning` `buildingSign` `stackedBuilding` `recessedStackedBuilding`
`beveledStackedBuilding` `crosswalk` `gableRoof` `shedRoof` `ramp` `windowGrid`

> `uWall`（コの字壁）は 2026-11-01 に追加。コの字（断面）を奥行き方向へ押し出した、
> 屋根＋左右の側壁の3枚。厚さは `uWallThickness` の1本で、床スラブは持ちません。

> `cylinder` は表にありますが棚には出していません（円の押し出しで代用できるため）。

---

### 3.2 名前とアイコン

#### `assetLabel(o) -> string`
棚・選択パネル・アウトライナーに出す **表示名**。

- `buildingAwning`／`buildingSign` のリンク部品は、親か子かで「テント付き建物」「接続テント」のように呼び分けます。
- `o.type === "compound"` は「結合オブジェクト」。
- アセットなら `o.assetName` → `ASSETS[key].label` → `"アセット"` の順でフォールバック。
- 素の図形（`rect`/`circ`/`box`/`cyl`）は「長方形」「円」「箱」「円柱」。

#### `assetGlyph(o) -> string`
棚に出す1文字アイコン。`compound` は `◆`、アセットは `ASSETS[key].glyph`、図形は `□`／`○`／`◇`。

---

### 3.3 座標変換と線画ヘルパー

#### `pt(o, x, y, z)`
**通常アセットのローカル座標 → ワールド座標**。中身は既存エンジンの `L2W(o, x, y, z)` の別名です
（`k`／`PL` の面座標系、回転、`ca`／`cb`／`lift` を全部面倒見てくれます）。

> **ポイント**：「この関数を通した点だけが正しい位置に描かれる」と考えてよい基準点です。
> 逆に言うと、`pt()` を通さずに座標を直接書いた線は、**オブジェクトを動かしてもついてきません**。

#### `customPt(o, x, y, z)`
**作成サイトから読み込んだ任意形状（`asset:"custom"`）専用**の座標変換。
`L2W` の面座標系を使わず、x=左右／y=奥行き／z=高さの素直なワールド座標で組み立てます。

計算内容:

1. 回転 `a = o.rot * DG`（度→ラジアン）で `(x, y)` を回す
   `rx = x·cos a − y·sin a`、`ry = x·sin a + y·cos a`
2. 基準位置 `(ca, cb)` を足す
3. 高さは `baseY = d − d·lift` に `z` を足す（`d` は設置面の高さ）
4. さらに `off` を加算

> 既存アセットの面座標系を壊さないために、custom だけ別関数にしているのがポイントです。

#### `lineA(o, pts, color, width)`
3Dの点列を **1本の線画オブジェクト**へ包みます。`pts.map(q => pt(o, q[0], q[1], q[2]))` のあと
`dens3()`（点を密に補間するエンジン側の処理）を通します。色・太さは省略時 `o.c` / `o.w`。

#### `customLineA(o, pts, color, width)`
`lineA` の custom 版。`pt` の代わりに `customPt` を使います。

#### `polyA(o, pts, color, width)`
`lineA` に **最初の点をもう一度足して閉じた多角形**にしたもの（`[...pts, pts[0]]`）。
四角形・断面の輪郭はほぼこれ。

#### `boxA(o, w, d, z0, z1, color) -> 線画配列`
直方体を **底面・上面の四角＋4本の縦辺**（計6本）で描きます。
中心は原点 `(0,0)`、高さは `z0`〜`z1`。ベランダ・人物の胴体・看板など、
「箱を1個置く」だけの部品は全部これで足ります。

#### `beveledWireBoxA(o, cx, cy, w, d, z0, z1, offset, segments, color)`
**ベベル直方体の線画**。平面輪郭を `beveledBoxFootprint()` で作り、底面・上面の多角形と
押し出し方向の縦辺を足します。`cx` / `cy` で中心をずらせるので、1アセット内に複数置けます。

#### `cornerCutWireBoxA(o, w, d, z0, z1, offset, corner, color, cutColor)`
**隅切り直方体**の本体。`cornerCutFootprint()` の5角形を上下に置き、縦辺で結びます。
**切り口の辺（赤い面）だけ色を変える**（`cutColor`）ことで、どの角をどれだけ落としたかが図面でも読めます。

#### `cornerCutOpeningWireBoxA(o, opening, z1, ...)`
隅切り面に開けた **開口**。切り口を左右へ分割し、開口の左右側面・上面・奥壁を追加します。
「赤い断面に穴が開いている」状態を線で表現するための関数です。

#### `wireBoxA(o, cx, cy, w, d, z0, z1, color)`
中心 `(cx, cy)` を指定できる `boxA`。ベランダの腰壁など、同じアセット内に複数の箱を並べるときの基本部品。

#### `ringA(o, rx, ry, z, n, color)`
高さ `z` に置く **楕円リング**（多角形近似）。円柱・円錐・ランタンの輪郭に使います。
`rx`/`ry` が別々なので、奥行き方向につぶれた楕円も作れます。

#### `spokesA(o, c0, r0, z0, c1, r1, z1, n, color, width)`
2つのリング（半径中心が違ってよい）の対応する頂点を結ぶ **縦の補助線**。
円柱の胴・テーパー部・ランタンの骨に使います。

---

### 3.4 形状パラメータの計算

ここが `asset.js` の **計算の中心**です。「ユーザーが入れた数値 → 描画に使える安全な数値」へ
変換する関数群で、線画・面メッシュ・ギズモ・外接範囲が全部ここを共有します。

> **重要**：数値の計算を線画の中へ直接書かないこと。同じ式を2か所に書くと、
> **片方だけ直して見た目と当たり判定がずれる**事故が起きます。計算は必ず `*Params()` に集約します。

#### `wallSignParams(o)` — 壁付け看板（単体）
| 戻り値 | 計算 |
| --- | --- |
| `width` | `|ra| * 2`（最小0.1） |
| `height` | `|h|`（最小0.1） |
| `thickness` | `|rb| * 2` を 0.02〜2 にクランプ |
| `bracketCount` | 0〜3本（既定3） |
| `bracketLength` | 0.05〜5（既定0.36） |
| `bracketArm` | `min(width, height) * 0.07` を 0.04〜0.16（金具の太さ） |
| `beveled` | `wallSignShape === "beveled"` |
| `bevelOffset` | 既定 `min(width, height) * 0.4`、上限 `bevelMax = min(w,h)*0.45 − 0.001` |
| `bevelSegments` | `beveledBoxSegments()` で 1〜4 |

#### `wallSignFacePoints(params)`
看板の **表裏の輪郭（幅×高さ）**。ベベル無しなら長方形、ベベル有りなら
`beveledBoxFootprint(width, height, bevelOffset, segments)` の角丸多角形。
表・裏・側面・面メッシュ・外接範囲がすべてこの1つの点列を共有します。

#### `wallSignBrackets(params) -> [{x0,x1,y0,y1,z,h}]`
取付金具を **板の左側面（−x）から横へ伸びる単純な直方体**として返します。

- `x1 = −width/2`（板の側面）、`x0 = x1 − bracketLength`（壁側の先端）
- 太さは板厚に収める（`y0 = −thickness/2`, `y1 = +thickness/2`）
- 高さ方向は `z = height·(i+1)/(count+1) − height/2` で **等間隔に振り分け**

#### `beveledBoxSegments(value, legacyValue, fallback)`
ベベル分割数を **1〜4** に丸めます。古い保存データの `bevelEdges` も受け付けます。

#### `beveledBoxFootprint(width, depth, offset, segmentCount)`
ベベル直方体の **平面輪郭**。4つの角を半径 `offset` の円弧で面取りした多角形を返します。
`segmentCount=1` なら1枚の平面取り、`4` なら角ごとに4分割した滑らかなベベル。
この点列が底面・上面・縦辺・外接範囲の共通の元になります。

#### `bevelEdgeKind(index, offset, segments) -> 0 | 1 | 2`
`beveledBoxFootprint()` が返す点の**縦の稜線をどう扱うか**を返します。

| 返り値 | 意味 |
|---|---|
| `0` | 普通に描く（ベベル無し、または分割1の平らな面取り＝輪郭そのもの） |
| `1` | 角のいちばん外側（弧の真ん中）の1本。`line.seam = 1` を付けて、**面ONでは描かない** |
| `2` | 描かない（弧の上の点） |

```js
const kind = bevelEdgeKind(index, offset, segments);
if (kind === 2) return;
const line = lineA(o, [[x, y, z0], [x, y, z1]], c);
if (kind === 1) line.seam = 1; // 面ONでは描かない（面の形で見せる）
out.push(line);
```

面ONではベベルの縦線を1本も描きません。面が表示されていれば角の丸みは面の形で読め、
残した1本は手前を向いた角でだけ見えるため「いちばん手前の角にぽつんと1本」になるからです。
線だけ表示では縦の稜線が無いと箱が上下2枚の板に見えるので、`line.seam` は
`strokeWVisible()` だけが弾き、`strokeW()` はそのまま描きます。

**今後ベベルのあるアセットを足すときも、縦辺を描く前にこの判定を入れること。**

#### `beveledBoxParams(o)`
`{ w, d, max, bevelOffset, bevelSegments }`。`max = min(w,d)/2 − 0.001` がベベルの上限
（両側から削って0にならないようにするため）。

#### `cornerCutFootprint(width, depth, offset, corner)`
隅切り直方体の **5角形の平面輪郭**。基準の `front-left` 角から隣り合う2辺へ `offset` だけ
入った点で角を落とします。`corner` を変えると対称移動で他の3隅にも切り替えられます。

#### `cornerCutBoxParams(o)`
`{ w, d, max, cornerOffset, cornerCutCorner }`。`cornerOffset` の上限は `min(w,d)/2 − 0.001`。

#### `cornerCutOpeningRayDistance(origin, direction, polygon)`
点 `origin` から向き `direction` へ伸ばした **半直線が多角形と最初に交わるまでの距離**。
2Dの線分交差をすべての辺で調べ、最小の正の `t` を返します（交点が無ければ建物寸法から安全な値を返す）。
**「開口をどれだけ深く掘れるか」の上限**を出すのに使います。

#### `cornerCutOpeningParams(o)`
隅切り面の開口を「切り口に沿う幅・高さ・内側への奥行き」へ正規化した、いちばん情報量の多い関数。

1. `cornerCutFootprint()` から **切り口の辺** `cutA → cutB` を取り出す
2. 辺の長さ `cutLength` と **接線** `tangent`、**中点** `midpoint` を計算
3. 多角形の重心を求め、`midpoint → 重心` の向きから **内向き法線 `inward`** を決める
   （法線候補2本のうち内積が正になる側）
4. 幅 `openingW`：既定 `cutLength * 0.62`、上限 `cutLength − 0.08`
5. 高さ `openingH`：既定 `h * 0.66`、上限 `h − 0.1`
6. 奥行き `openingDepth`：上限は `cornerCutOpeningRayDistance() − 0.025`
   ＝ **反対側の壁を突き抜けない最大値**
7. `frontA/frontB`（切り口上の2点）と、`inward * openingDepth` だけ奥へずらした `backA/backB` を返す

#### `stackedOpeningParams(o, f)`
階層建物の1F開口の初期値と上限。
`openingW` 既定は `w * 0.56`（上限 `w − 0.1`）、`openingH` 既定 `h * 0.66`（上限 `h − rimHeight − 0.01`）、
`openingBack` は奥面位置を `−d/2 + 0.025` 〜 `d/2 − 0.025` に収めます。

#### `recessedMaxInset(width, depth)`
凹窓階層建物の凹み上限＝ `min(|w|, |d|) * 0.45`。
ベベル・窓の凹み奥行きの **3か所で同じ式**を使うために関数化しています。

#### `recessedStackedBuildingParams(o)`
凹窓階層建物の全パラメータ。主な計算:

| 値 | 計算 |
| --- | --- |
| `w` / `d` | `|ra|*2` / `|rb|*2`（最小0.5） |
| `floorCount` | 1〜30（既定4） |
| `floorHeight` | 0.5〜30（既定2.1） |
| `firstFloorHeight` | `floorHeight + firstFloorExtra`（既定 +0.35） |
| `floorGap` | 0〜5（既定0.12）＝ **階の接合部の高さ＝窓の高さ** |
| `totalH` | `firstFloorHeight + (floorCount−1)·(floorHeight + floorGap)` |
| `cornerBevel` | 0〜`recessedMaxInset()` |
| `marginLeft` / `marginEnd` | 両端の壁幅。古いデータの `recessedWindowW` から **逆算して引き継ぐ** |
| `windowW` | `w − cornerBevel − marginLeft` |
| `sideWindowW` | `d − cornerBevel − marginEnd` |
| `windowH` | `floorGap`（接合部に収まる高さ） |
| `windowDepth` | 0.025〜`insetMax` |
| `sillHeight` | 0.05〜`floorHeight − windowH − 0.05` |
| `beamHeight` / `beamProjection` | 梁の高さ・張り出し |

#### `recessedStackedBuildingFloors(o, params)`
各階の `{ index, z, h }` を積み上げて返します。1Fだけ `firstFloorHeight`、
階の間には `floorGap` を挟みます。**z は下から積む**のがポイント。

#### `recessedHandlePatch(o, kind, value)`
ハンドルの種類（`recessed-window-count` など）を **オブジェクトの差分** `{...}` に変換。
3Dドラッグと直交ビューのドラッグで同じ対応を使うため、片方だけ反応しない不具合を防ぎます。

- `recessed-first-floor-height` は **実寸**で来るので、`value − floorHeight` の差分だけを保存
- `recessed-floor-gap` は接合部の高さ＝窓の高さを同時に決める

#### `recessedStackedBuildingJunctionWindows(o, params)`
各階の **接合部の中央**に窓帯 `{center, bottom, top}` を置きます。
階が1つだけのときは接合部が無いので、最上階の上端（屋根直下）へ置きます。

#### `recessedStackedBuildingFootprint(params)`
建物の平面輪郭。`cornerBevel` が0なら長方形、あれば右前の角を
`segments` 分割の円弧で丸めた多角形。`b`（ベベル半径）と中心 `(x−b, −y+b)` から
角度 `−π/2 〜 0` までを刻みます。

#### `polygonEarClip(points) -> [[p,p,p], ...]`
**凹んだ多角形の三角形分割（耳切り法）**。

1. 符号付き面積を計算し、反時計回りになるよう頂点順を揃える
2. 「前・現在・次」の3点が凸（外積 > 0）で、かつ他の頂点を内側に含まないものを1つ選ぶ
3. 三角形として採用し、その頂点をリストから外す
4. 頂点が3つになるまで繰り返す

重心から扇状に分割すると凹みをまたいで図形の外へはみ出し、上ビューで「尖り」が見えてしまうため、
この方法を使っています。

#### `recessedStackedBuildingCapPath(params, notch)`
階の接合部をまたぐ窓があるとき、上下のスラブ輪郭から **窓の幅だけを切り欠いた多角形**を返します。
切り欠きが無ければ外周そのまま。外周の折れ線＋奥壁の折れ線を逆順でつないだ形です。

#### `recessedStackedBuildingBeamFootprint(params)`
梁の平面輪郭。`beamProjection` だけ外へ広げ、角は `cornerBevel + projection` の半径で丸めます。

#### `recessedStackedBuildingWindowPaths(params)`
窓帯の **外周 `outer` と奥壁 `inner`** の2本の折れ線を作ります。
正面の壁から右側面まで、角のベベル弧をはさんで **連続した1本の帯**になるのが要点
（正面と横面を別々の窓にしないための実装）。`sideWindows` が false のときは正面部分だけ使います。

#### `recessedStackedBuildingWindowMullionPoints(params)`
窓帯を `windowCount` 等分する **方立（縦桟）の位置**。外周の折れ線の長さで割合を出し、
該当する線分へ線形補間して内外両方の点を返します。

#### `recessedStackedBuildingLines(o)`
凹窓階層建物の線画本体。手前枠・左右側面・上面・奥枠を **同じローカル座標**から作るため、
3Dと直交ビューで奥行きがずれません（このアセットの最重要要件）。

---

### 3.5 パスパイプのベクトル計算

パスパイプは「制御点 → 角丸の中心線 → 円形断面のメッシュ」という流れで作ります。
そのための小さなベクトル関数群です（すべて `[x,y,z]` 配列を返す）。

| 関数 | 計算 |
| --- | --- |
| `pathVecSub(a, b)` | `a − b` |
| `pathVecAdd(a, b, scale = 1)` | `a + b·scale` |
| `pathVecScale(a, s)` | `a·s` |
| `pathVecDot(a, b)` | 内積 |
| `pathVecCross(a, b)` | 外積（面の向き・回転軸に使う） |
| `pathVecLength(a)` | 長さ |
| `pathVecUnit(a, fallback)` | 正規化（長さ0なら `fallback`） |
| `pathRotateAroundAxis(v, axis, angle)` | ロドリゲスの回転公式で `v` を `axis` 回りに回す |

#### `pathPipeDefaultPoints()`
`path` が無い／壊れているときの初期制御点（4点のS字）。

#### `pathPipeControlPoints(o)`
保存データから有効な3D点だけを取り出します。数値でない点は捨て、2点未満なら初期値へ。

#### `pathPipeRoundedPath(o)` — 角を丸めた中心線
各折れ点で円弧を差し込みます。数学的には次のとおりです。

1. 折れ点 `p` から前 `prev`／次 `next` への単位ベクトル `toPrev` `toNext` を作る
2. なす角 `alpha = acos(toPrev·toNext)`、**曲がり角** `turn = π − alpha`
3. 角の二等分方向 `bisector = unit(toPrev + toNext)`
4. 円弧の接点まで `cut = min(cornerRadius·tan(turn/2), lenPrev·0.45, lenNext·0.45)`
   （隣の線分を食いつぶさないよう45%で頭打ち）
5. 実半径 `radius = cut / tan(turn/2)`
6. 円弧の中心は `p + bisector · (radius / sin(alpha/2))`
7. 接点 `start`／`finish` を中心回りに `arcSteps` 回転させて円弧の点を作る

`cornerRadius` が0、曲がりがほぼ0、または折り返し（180°）のときは角のまま通します。

#### `pathPipeMesh(o)` — 円管のメッシュ
中心線の各点に **円形リング**を置き、隣り合うリングを三角形でつなぎます。

- 接線 `tangent` は前後の点の差分から計算
- `tangent` がほぼ真上（`|tz| > 0.92`）なら基準ベクトルを `[0,1,0]` に切り替える
  （真上を向いたときに断面が決まらなくなるのを防ぐ）
- リングは `side = unit(tangent × reference)`、`binormal = unit(tangent × side)` の2軸で作る
- 隣のリングとは `[a,b,c]` と `[a,c,d]` の2三角形でつなぐ
- 両端には中心点から扇状に蓋をする

戻り値 `{ centerline, rings, triangles, radius, sides }` は
線画・外接範囲・ギズモで共有されます。

---

### 3.6 実用ヘルパー

**線画からも UI／ツール側からも呼べる共通計算**です。`（新規）` の印は今回追加したものです。

#### 寸法系

| 関数 | 計算 |
| --- | --- |
| `finiteNumber(value, fallback)` | 数値化できなければ `fallback`。**全関数の安全弁**（29か所で使用） |
| `assetDimensions(o)` | `{ w: |ra|*2, d: |rb|*2, h: |h| }`（すべて0以上） |
| `assetFootprintArea(o)` | `w * d`（床面積） |
| `assetVolume(o)` | `w * d * h`（体積） |
| `scaledAssetProps(o, scale)` | 等比拡大した `{ ra, rb, h }` を返す（複製・拡大の下請け） |

#### 変形系

| 関数 | 計算 |
| --- | --- |
| `translateLocalPoints(pts, dx, dy, dz)` | 点列を平行移動した新しい配列 |
| `mirrorLocalPoints(pts, axis)` | 指定軸で符号反転（左右反転・裏返し） |
| `lerp(a, b, t)（新規）` | 線形補間 `a + (b−a)·t`（`t` は0〜1にクランプ） |
| `inverseLerp(a, b, v)（新規）` | 線形補間の逆算 `(v−a)/(b−a)`。`a≈b` なら0 |
| `snapValue(value, step)（新規）` | グリッドへ丸め `round(v/step)·step`。`step<=0` なら素通し |
| `roundTo(value, digits)（新規）` | 小数 `digits` 桁へ丸め（表示・JSON用） |
| `boundsOfPoints(points)（新規）` | 点列の **AABB** `{lo, hi}`。無限大初期化なので空配列でも安全 |

#### 並べる・衝突

| 関数 | 計算 |
| --- | --- |
| `evenSpaced(count, span)（新規）` | `span` を `count` 等分した **中心揃え**の位置配列（`−span/2 〜 +span/2`） |
| `linearRepeatOffsets(count, spacing, axis)（新規）` | 一定間隔で並べた **オフセット3Dベクトル**の配列（中心揃え） |
| `aabbOverlaps(a, b, pad)` | AABB同士が（`pad` ぶん広げて）重なるか |
| `assetsOverlap(a, b, pad)` | `obBounds` を取って `aabbOverlaps` を呼ぶだけの糖衣 |

> `evenSpaced` は「窓の本数を n 等分」「金具を等間隔」など、
> `linearRepeatOffsets` は「柱を一定間隔で複製」といった用途に使えます。

#### `offsetPolyline2D(points, distance)（新規）` — 折れ線のオフセット

**今回の屋根板厚修正の心臓部**。2Dの折れ線を、進行方向の左手前（zが下向き）へ一定距離ずらした
折れ線を返します。

1. 各線分の法線を作る：線分方向 `(dx, dz)` を **−90°回す**と `(dz/len, −dx/len)` ＝下向きの法線
2. 各頂点を法線方向へ `distance` だけ移動した「直線（点＋方向）」を作る
3. 隣り合う2直線の **交点（マイター）** を新しい折れ点にする
   `t = cross(line.p − prev.p, line.dir) / cross(prev.dir, line.dir)`
4. 両端は移動した点をそのまま使う

マイターで交点を取るので、**折れ点が途切れず・角も尖りすぎない**（折れ線の向きが揃っていれば
どこでも法線距離が `distance` で一定）という性質があります。

> **計算**：頂点 `P`、前の線分の方向 `d1`、次の線分の方向 `d2`、それぞれの法線 `n1` `n2` とすると、
> 新しい折れ点は **2直線 `P + n1·d + t1·d1` と `P + n2·d + t2·d2` の交点**です。
> 交差距離 `t1 = cross(P2 − P1, d2) / cross(d1, d2)` で求まります。
屋根では「外側の面を法線方向へ `thickness` だけずらして内側の面を作る」ために使い、
これにより **勾配が強くても板厚が一定**になります（詳細は §4.1）。

---

### 3.6b 新規アセット用の下請け（2026-10-29 追加・20個）

新しいアセットを足すたびに「同じような点列」「同じような窓の割り付け」「同じような
数値クランプ」を書き写していたので、**asset.js の中へ共通部品として20個**まとめました
（`// ===== 6.2 新しいアセットを作るときの下請け =====`、`asset.js` の関数一覧の
「6.2」の節）。どれも `asset.js` のローカル座標（**x=幅 / y=奥行き / z=高さ**）だけを
扱い、ワールド変換は `lineA` / `polyA` が行います。つまり **genShape・面メッシュ・
当たり判定の仕組みは一切変えていません**（既存アセットの見た目も挙動も変わらない）。

#### A. 値の取り出し（保存データは文字列や undefined が混ざる）

##### `assetNum(o, key, fallback = 0, min = -Infinity, max = Infinity) -> number`

| 項目 | 内容 |
| --- | --- |
| やること | `o[key]` を数値として読み、**有限値でなければ fallback**、`min`〜`max` にクランプ |
| うれしいこと | `"2.5"`（文字列）も `2.5` として読む。`""`・`null`・`"abc"`・`NaN` は fallback。寸法が 0 や負になって線が消える事故を防ぐ |
| 例 | `assetNum(o, "h", 1.8, 0.1, 20)` → 高さを 0.1〜20 に収めて返す |

##### `assetBool(o, key, fallback = false) -> boolean`

`"false"` / `"0"` / `"off"` / `"no"` / `"none"` を **false**、`"true"` / `"1"` / `"on"` /
`"yes"` と数値 `0以外` を **true** として読みます。JSON から戻した設定値
（`windowSides` など）を取りこぼさないため。

##### `snapValue(v, step = 0.1)` / `roundTo(v, digits = 2)`

`snapValue` は **step の倍数へ丸め**（数値スピナーの刻みと同じ）、`roundTo` は小数桁の丸め。
`snapValue(1.234, 0.1) → 1.2`、`snapValue(-0.04, 0.05) → -0.05`。
`0.1` 刻みで `1.2000000000000002` のような汚い値が出ないよう、内部で小数6桁に丸めています。

##### `lerp(a, b, t)` / `inverseLerp(a, b, v)` / `smoothUnit(t)`

- `lerp(0, 10, 0.25) → 2.5`（t は 0..1 に丸めないので外挿もできる）
- `inverseLerp(0, 10, 2.5) → 0.25`（a===b のときは 0）
- `smoothUnit(t)` は **smoothstep** `t²(3−2t)`。両端でなめらかに加減速するので、
  屋根の反り・テーパー・曲線の分割に使う

##### `boundsOfPoints(pts) -> { lo:[x,y,z], hi:[x,y,z] }`

点列（`[x,y]` でも `[x,y,z]` でも可）の軸並行バウンディングボックス。
点が空でも `{lo:[0,0,0], hi:[0,0,0]}` を返し、**NaN を返しません**。
線画を作る前に「どこまで広がるか」を確かめるとき、`obBounds` の下見に使えます。

#### B. 並べる

##### `spanSplit(total, count, gap = 0, minSize = 0) -> { size, gap, centers[], total }`

長さ `total` の区間に、同じ大きさの部品を `count` 個、隙間 `gap` で並べます。
`centers` は **中心が 0 の左右対称**な座標なので、そのまま x（または y）として使えます。

```js
const sp = spanSplit(3.6, 4, 0.2, 0.3);   // 幅3.6に4個、隙間0.2、最小0.3
// sp.size = 0.75, sp.gap = 0.2, sp.centers = [-1.425, -0.475, 0.475, 1.425]
```

`size` が `minSize` を下回る場合は **隙間の方を詰めて** `minSize` を確保します
（`spanSplit(1.0, 5, 0.1, 0.4)` → 隙間0、size 0.2）。窓・横断歩道の縞・柵・梁に。

#### C. 1本で描ける面

##### `rect2DOutlineA(o, cx, cy, w, d, z, color, width)` → 線画1本

水平な長方形の輪郭。中心 `(cx, cy)`・幅 `w`・奥行き `d`・高さ `z`。
「板を1枚」「床・天板・影」など一番よく使う形を1行で書くため。

##### `quadFaceA(o, a, b, c, d, color, width)` → 線画1本

任意の4点（`[x,y,z]`）を閉じた面にします。**斜めの面**（切妻屋根の妻面・スロープの
側面・テントの垂れ）を書きたいとき。

##### `arcPointsA(o, cx, cy, rx, ry, z, a0, a1, segments, color, width)` → 線画1本

円弧（閉じない）の折れ線。`a0→a1` はラジアン、`segments` は分割数（2〜128 にクランプ）。
アーチ窓・ドーム・曲がったパイプ・影に。

##### `discOutlineA(o, cx, cy, rx, ry, z, segments, color)` → 線画1本

**中心を指定できる**円・楕円の輪郭。既存の `ringA` は中心が必ず原点なので、
部品を原点以外へ置くときはこちらを使います（内部は `arcPointsA` を1周ぶん）。

#### D. 立体をまとめて

##### `wireCylinderA(o, cx, cy, r, z0, z1, segments = 12, color)` → 線画 `2+n` 本

下の円・上の円・縦の稜線 `n` 本。`ringA + spokesA` を1回で呼ぶだけの部品ですが、
柱・缶・タンク・街灯など出番が多いので用意しました。

##### `wirePrismA(o, polygon, z0, z1, color)` → 線画 `2+n` 本

2D多角形 `[[x,y], …]` を `z0→z1` へ押し出したワイヤー。**任意の断面**をそのまま
立体にできます（柱・看板の枠・風変わりな建物）。

##### `wirePyramidA(o, polygon, zBase, apexZ, color, apexX = 0, apexY = 0)` → 線画 `1+n` 本

2D多角形を底面にして1点（`apex`）へ集めます。錐・ドーム・尖塔。
頂点を `apexX/apexY` でずらせるので、傾いた尖塔も作れます。

#### E. 建具・部品

##### `stairsRunA(o, { width, depth, steps, baseZ, topZ, color })`

直階段。各段の**踏面（水平）と蹴上げ（垂直）**を幅いっぱいに引き、左右の側面の
階段状の輪郭も描くので、どのビューでも階段だと分かります。奥（+y）へ上がります。

##### `latticePanelA(o, { width, z0, z1, y, cols, rows, color })`

格子パネル（柵・フェンス・窓の桟）。`y` を固定した x-z 平面に、縦棒 `cols` 本と
横棒 `rows` 本を等間隔で引きます。`cols=1` / `rows=1` のときは中央に1本だけ引きます。

#### F. 登録と確認

##### `registerAsset(kind, meta, builder) -> boolean`

**カタログ（`ASSETS`）と線画の表（`ASSET_LINE_BUILDERS`）へ同時に登録**します。
片方に書き忘れて「棚に出るのに形が出ない」事故を防ぐため。既に同じ名前がある場合は
**上書きせず `false`** を返します（既存アセットの保護）。

```js
registerAsset("fence", { label: "フェンス", glyph: "‖", w: 2, d: 0.1, h: 1.2 }, linesFence);
```

##### `describeAsset(o) -> string`

デバッグ用の1行要約。名前・種別・寸法・線画の本数をまとめて出します。
コンソールで `describeAsset(obOf(sel))` と打てば今の寸法が確認できます。

```
直方体 / box / 3.20×2.40×1.80m / 線画6本
```

> **注意**：`describeAsset` は内部で `assetLines()` を呼ぶので、**毎フレーム呼ばない**でください
> （デバッグ用です）。

### 3.7 窓・屋根・スロープ・建物の共通計算

#### `windowGridOptions(o, wallW, wallH)`
窓グリッドの **割り付け設定**を正規化します。

| 値 | 意味 | 既定 / 上限 |
| --- | --- | --- |
| `rows` / `cols` | 行数・列数 | 0〜20 |
| `mx` | 左右の余白 | `wallW * 0.12`（上限 `wallW * 0.45`） |
| `sill` | 窓台（下端の高さ） | `wallH * 0.22`（上限 `wallH * 0.7`） |
| `head` | 上端の余白 | `wallH * 0.12`（上限 `wallH * 0.45`） |
| `gx` / `gz` | 窓どうしの横／縦の間隔 | `wallW * 0.06` / `wallH * 0.1` |
| `ww` / `wh` | **窓1枚の幅・高さ（新規）**。`0` は「セルいっぱい＝自動」 | 0〜壁寸法 |

#### `facadeWindowGridRects(wallW, wallH, options)` — 窓の矩形を並べる
ここが **窓の割り付け計算の本体**です。

```
usableW = wallW − mx*2
usableH = wallH − sill − head
cellW   = (usableW − gx*(cols−1)) / cols        ← 1マスの幅
cellH   = (usableH − gz*(rows−1)) / rows        ← 1マスの高さ
winW    = min(cellW, ww || cellW)               ← 指定があればその寸法（上限はセル）
winH    = min(cellH, wh || cellH)
padX    = (cellW − winW)/2                      ← セル中央へ寄せる
padZ    = (cellH − winH)/2
x = −wallW/2 + mx + col*(cellW + gx) + padX
z = sill        + row*(cellH + gz) + padZ
```

- `ww`/`wh` が `0`（自動）のときは `padX = padZ = 0` になり、**セルいっぱい**に窓が並びます。
- `ww`/`wh` を指定すると、窓が小さくなったぶん **四方の壁が均等に増える**（中央寄せ）ので、
  見た目が破綻しません。
- 指定値がセルより大きい場合はセル寸法で **クランプ**されるので、
  窓どうしが重なったり壁からはみ出したりしません。

> **計算**：窓を小さくしたときの「四方の壁」は、それぞれ
> `(cellW − winW)/2` と `(cellH − winH)/2` ずつです。合計すると
> `winW + 2·padX = cellW` となり、**必ず1マスに収まります**。

#### `windowRectHitsOpening(rect, opening)`
窓の中心が開口（1Fの入口など）の範囲内にあるか。建物の窓が入口に重なるのを避けるための判定。

#### `appendFacadeWindows(o, out, w, d, h, color, opening)`
正面（必要なら裏面・左右側面も）へ窓枠を **線画として追加**します。
`windowRectHitsOpening()` に当たった窓は描きません。

#### `roofParams(o)`
屋根の寸法をまとめます。
`w`,`d`（`|ra|*2`、`|rb|*2`）、`h`（棟の高さ）、`overhang`（軒の出、上限 `min(w,d)*0.45`）、
`thickness`（板厚、`0.02 〜 h*0.5`）、`ridgeAxis`（`"x"` か `"y"`）、`lowZ`（軒の低い側の高さ）。

#### `roofSlab(o, kind)` — 屋根板の断面と押し出し
**今回の板厚修正の本体**。

```js
halfSpan = 棟に直交する方向の半長  // 勾配が走る向き
axis     = 棟に沿って押し出す軸（"x" か "y"）
half     = 押し出す半長
outerPath = 断面の外側（切妻なら 山形の3点／片流れなら 2点）
innerPath = offsetPolyline2D(outerPath, thickness)   ← 法線方向へずらす
cross     = [ ...outerPath, ...innerPath.reverse() ]  ← 閉じた断面
```

`cross` を `axis` 方向へ `±half` 押し出すと屋根板になります。
`cross` が閉じた多角形になっているので、断面の両端が **そのまま板厚の面**になります。

#### `roofFitFromHost(host, kind)` — 下の建物に合わせる
建物の寸法から屋根の寸法を決めます。

- `ridgeAxis` = `w >= d ? "x" : "y"`（長い辺に棟を平行に）
- `h`（棟の高さ）= 切妻 `max(0.5, min(w,d)*0.35)`／片流れ `max(0.4, d*0.28)`
- `roofOverhang: 0.18`、`roofThickness: 0.12`、`liftHint: 建物の高さ`

`liftHint` は「その高さに載せる」ためのヒントで、実際の位置合わせは `studio-ui.js` の
`fitRoofToHost()` が `off` を直接書いて行います。

#### `rampParams(o)`
`{ w, d, h, rail, railH }`。手すりの高さ `railH` は 0.12〜1.8（既定0.42）。

#### `buildingParams(o)`
開口建物の寸法を描画向けに整理。`backY`（奥面）、`sideT = max(0.05, (w − openingW)/2)`（左右の柱幅）、
`topT = max(0.05, h − openingH)`（上の梁の高さ）。

#### `closedBuildingLines(o, w, d, h, color)`
開口OFFの建物を **普通の閉じた箱**として描く（前後の四角＋4本の縦辺）。
`openingEnabled` 未指定の通常建物は従来どおり開口あり扱いです。

---

### 3.8 アセットごとの線画生成

#### `assetLines(o) -> 線画配列`
形ごとの線画を作る **入口**。`w = ra*2`、`d = rb*2`、`h = h` を実寸へ直し、
共通の `ctx` を作って `ASSET_LINE_BUILDERS[kind]` を呼びます。

```js
ctx = { o, kind, w, d, h, c, a, out: [] }
// c = 線の色、a = アセット色（同じ色の別名）、out = 出力先
```

#### `ASSET_LINE_BUILDERS`（振り分け表）
**1形状 = 1関数**。追加・修正するときに触る範囲をその形の中に閉じ込めるための表です。

```js
custom → linesCustom,  box → linesBox,  wallSign → linesWallSign, ...
gableRoof → linesGableRoof,  shedRoof → linesShedRoof,  ramp → linesRamp,  windowGrid → linesWindowGrid
```

`stackedBuilding` と `beveledStackedBuilding` は同じ `linesStackedBuilding` を共有します（内部で分岐）。

以降は各関数の説明です。

#### `linesCustom(ctx)`
作成サイトから読み込んだ任意形状。`geometry.vertices`（点）と `edges`／`loops`（辺・面の並び）を
そのまま3D線画へ変換します。

#### `linesBox(ctx)`
素の直方体。`boxA(o, w, d, 0, h, c)` を呼ぶだけの基準形状（ベベル直方体とは別アセット）。

#### `linesWallSign(ctx)`
壁付け看板（単体）。`wallSignFacePoints()` の輪郭を表（−y）と裏（+y）に置き、
対応する頂点を結んで板厚を出します。取付金具は `wallSignBrackets()` の直方体を1本ずつ描画。

#### `linesCornerCutBox(ctx)`
隅切り直方体。本体は `cornerCutWireBoxA()`、開口は `cornerCutOpeningWireBoxA()`。
切り口は `cutColor`（赤）で描きます。

#### `linesWallSideSign(ctx)`
横壁看板（建物横壁へ接着する専用アセット）。縦長の箱を本体にし、必要なら
壁からの取付金具を0〜3本、看板の裏側へ追加します。

#### `linesBeveledBox(ctx)`
ベベル直方体。`beveledBoxFootprint()` を底面・上面へ複製し、押し出し方向の縦辺を足します。

#### `linesPathPipe(ctx)`
パスパイプ。`pathPipeRoundedPath()` の中心線に沿ってリングを描き、リング間の縦線で
パイプらしさを出します。

#### `linesRecessedStackedBuilding(ctx)`
凹窓階層建物。`recessedStackedBuildingLines()` へ委譲（§3.4 の一連の計算を使用）。

#### `linesStackedBuilding(ctx)`
階層建物／ベベル階層建物。`floors[]` を階ごとに描き、開口は `openingEnabled` が true の **1Fだけ**へ
追加します。縁（rim）は各階の上端に張り出しぶんを足して表現します。

#### `linesBalcony(ctx)`
壁付けベランダ。壁側（+Y）を建物外壁へ合わせ、床を外側（−Y）へ張り出すU字型。
**床スラブ＋コの字の腰壁（前・左・右）を1つの立体**として線を引きます。
`balconyFrontRail`／`balconySideRail` で腰壁の有無を切り替えます。
寸法は `engine-gizmo.js` の `balconyGeometry(o)` から受け取ります（丸めを1か所に集約）。
**床スラブと腰壁の厚さは同じ1つの値** `balconyThickness` です（2026-11-01）。

- 線は **13本**：①床の底面の四角 ②腰壁の上面のリング（外側＋内側を1本の閉じた線で）
  ③床が見えている範囲の縁（腰壁の足元）④縦の稜線（同じ位置の角は1本にまとめる）
  ⑤壁付け面の支持ブラケット2本。
- **箱を3枚重ねて描いてはいけない**（2026-11-01 の指摘で作り直した）。重ねると
  ①角に線が二重に出る ②スラブと腰壁の境に面の継ぎ目が線として出る
  ③重なった面が手前の線を隠して途中で欠ける。
- 外側の面（スラブの側面と腰壁の側面）は同じ平面なので、その境には線を引きません。

#### `linesUWall(ctx)`
コの字壁。コの字（∩の断面）を**奥行き方向（Y軸）へ押し出した1つの立体**として描きます。
上＝屋根板、左右＝側壁が同じ厚さ `uWallThickness` でつながり、正面・背面・下面は開いています。
初期の向きは「壁が立ったコの字」を**X軸まわりに時計回りへ90°回したもの**（＝屋根が上）。

- 断面（XZ平面）の8点を `profile` に並べ、前後の面を `polyA` で1本ずつ、
  各角から奥行き方向の稜線を `lineA` で8本。**合計10本**。
- **箱を3つ重ねて描いてはいけない**。重なった部分は
  ①同じ位置に線が二重に描かれ ②奥行きバッファ（`strokeWVisible`）が
  手前の面で線を隠すため、屋根の前端などの線が途中で欠ける。
  （2026-11-01 の指摘。1つの立体として押し出す形に直した）

#### `linesStairs(ctx)`
階段。`steps` 段ぶん、段板と蹴上げを実際の断面に沿って描きます。
`sd = d/n`（1段の奥行き）、`sh = h/n`（1段の高さ）。

#### `linesCrosswalk(ctx)`
横断歩道。`stripes` 本の白線を `y = −d/2 + gap*(i+1)`、幅 `stripeD = gap*0.6` で並べます。

#### `linesStall(ctx)`
屋台。**コの字の壁（奥＋左右）＋手前下のカウンター箱＋真上の屋根箱**を、
重ならない1つの立体として描きます（線 **28本**）。寸法は `engine-gizmo.js` の
`stallGeometry(o)` から受け取ります。

- ①コの字の手前の縁（U字の断面8点。上端は屋根の下面）
- ②奥の壁の面（全面が閉じている）
- ③奥行き方向の稜線8本（外側4本＋内側4本。床から屋根の下面まで）
- ③b **左右の壁が地面に接する線2本**（`[-hw, hw]` の X 位置で `z = 0`→`d` の線。
  奥の壁の接地線は②の四角の下端がそのまま床になるので描かない）
- ④カウンターの上面・底面の四角と、手前の縦2本（奥の2本は③と同じ位置なので描かない）
- ④b 壁の内側の見えている範囲の床（壁とカウンターで囲まれた所）。
  奥は **`hd` ではなく `hd - t`**（奥の壁の内面）まで。`hd` まで伸ばすと奥の壁の下に
  潜り、内側の接地線が奥の壁の外側の線と重なって「内側に線が無い」ように見える。
- ④c **内側の稜線5本**。奥の縦2本（`x = ±(hw - t)`, `y = hd - t`, `z = 0 → roofBottom`）、
  奥の壁の内面の上端1本、左右の壁の内面の上端2本（`y = -hd → hd - t`, `z = roofBottom`）。
  これが無いと内側から見たときに壁と壁・壁と屋根の境が消え、面が1枚の板に見える。
- ⑤屋根の上面・底面の四角と、前後の縦4本（後ろの2本は③の続き）

**壁の上面は描きません**（屋根の底面に隠れるため）。カウンターの奥の面も
コの字に付いているので、縦の線は③の稜線1本にまとめています。

#### `linesStool(ctx)`
丸椅子。**台座・ポール・座面の3つの円柱**を、ぞれぞれ
「上下の輪（`ringA`）」＋「視線に直角な位置の側面2本（`lineA`）」で描きます（線 **12本**）。
輪だけだと段の境目が分からず、側面の線が無いと筒に見えないためです。

- 寸法は `engine-gizmo.js` の **`stoolGeometry(o)`** から読みます
  （`seatR` / `seatT` / `legR` / `legH` / `baseR` / `baseH` の6つ）。
- シルエットの角度は `stoolSilhouetteAngles(o)` が決めます。カメラの水平方向を
  オブジェクトの面内軸へ落とし、その直角を返すので、`rot`（面内回転）や
  `rotX`/`rotZ`（傾き）を与えても側面の線が本体と一緒に動きます。
- 面（塗り）は `engine-render.js` 側で同じ `stoolGeometry(o)` から円柱を作ります。
  線と面が同じ数を見るので、寸法を変えても食い違いません。

#### `linesRailing(ctx)`

手すり。**柱（両端）＋上下2本の横桟＋縦の棒**を、部材ごとの箱（`wireBoxA`）で描きます。
寸法と棒の位置は `engine-gizmo.js` の **`railingGeometry(o)`** から受け取ります（既定96本／線分1,368本）。

**見えない面の稜線は最初から描かない**（2026-11-02）。横桟と横桟に挟まれた縦の棒の上下の面は
必ず横桟の中に隠れ、柱の上端の四角は横桟の上面と重なる。そこで
- 縦の棒 → `wireBoxVA()`（縦4本だけ）
- 柱 → `wireBoxNoTopA()`（上面を描かない）

を使う。線の本数は 110→96本（線分 1,428→1,368 本）、画素の差は 1台あたり約60px（ほぼ見えない）。
面ONの描画で「同じ場所に線が二重に出る」ことも無くなる。

- ①柱：`post × post` を `z = 0 → h`。足元に少し広い板（`post*1.5`、高さ `footH`）を
  四角＋縦4本で足す。広げすぎると外接箱（`w`×`d`）からはみ出して選択枠とずれる。
- ②区間（`runs`）ごとに、上の横桟 `z = h−t → h`、下の横桟 `z = bottom → bottom+t`。
- ③縦の棒は**上下の横桟の間だけ**（`barT × barT`、`z = 下の横桟の上端 → 上の横桟の下端`）。
  横桟を突き抜けさせないので、重なった線が出ない。
- 形は `railingShape`（`u`／`l`／`line`）、棒の本数は `railingCount`。本数は区間の
  長さで配分し、合計が指定どおりになるよう端数を寄せる（区間ごとに最低1本）。
- 面（塗り）は `engine-render.js` の `exportSurfaceTriangles()` が同じ `railingGeometry(o)`
  から作ります（部材ごとに箱を作り、足元→柱→横桟の順に積んで重ねない）。

#### `linesCylinder(ctx)`
円柱。**上下の輪郭リングだけ**を描き、側面の縦エッジは描きません（線が多くなりすぎるため）。

#### `linesCone(ctx)`
円錐。底面の輪郭と、**現在の視点から見える左右2本のシルエット母線**だけを描きます。
母線の向きはカメラ位置 `camPos()` との関係から計算するので、視点を回すと見える側が入れ替わります。

#### `linesSphere(ctx)`
球。**視点に正対する輪郭円**を3D線として置きます。カメラを回しても画面上で
つぶれず、常に円に見えます。

- 輪郭円は球の表面とちょうど重なるため、そのまま描くと面（塗り）との前後判定で
  破線のように途切れました。**半径の1.04倍の位置へ出し、カメラ側へ半径の1%だけ
  ずらす**ことで、輪郭が必ず全部見えるようにしています。
- 球は回しても見た目が変わらない（対称）ので、**オブジェクトの水平面（ローカルXY面）
  に赤道の線を1本**足しています。`rotX` / `rotZ` の傾きがこの線で分かります。
  輪郭（シルエット）は上の円1本のままです。

#### `linesTriPrism(ctx)` / `linesTriPyramid(ctx)`
三角柱（前後の三角形＋3本の稜線）、三角錐（底面三角形＋頂点への3本）。

#### `linesLantern(ctx)`
ランタン。`0.22h〜0.7h` の胴を八角リング2本＋縦の骨で作り、
上部の絞り・吊り手を追加します。

#### `linesSign(ctx)`
看板。外枠は `boxA()`、内側に **`faceW` / `faceH` で編集できる絵枠**を描きます。
絵枠はボードの範囲を超えないようクランプされます。

#### `personPose(o)` — 人物の骨格を1か所で計算する
人物の「関節の位置」を返す関数。**線画（`linesPerson`）・面メッシュ（`exportSurfaceTriangles`）・
関節ギズモ（`engine-gizmo.js` の `personJointHandles`）がすべてこの1つの結果を使う**ので、
関節を回しても線と面とハンドルが食い違いません。

入力は次のとおり。

| プロパティ | 意味 | 範囲 |
| --- | --- | --- |
| `h` | 身長 | 0.2〜 |
| `bodyScale` / `shoulderScale` / `headScale` / `legSpread` | 体格・肩幅・頭の大きさ・脚の開き | 0.6〜1.8 など |
| `pose` | `stand` / `walk` / `crouch` / `sit` / `custom` | — |
| `poseStride` / `poseCrouch` / `poseLean` / `headTilt` | 歩幅・しゃがみ量・体の傾き・頭の傾き | 0〜0.5 / 0〜1 / ±0.35 / ±25° |
| `personWaist` / `personNeck` | 腰・首の回転 | ±60° / ±40° |
| `personHipL` / `personHipR` | 左右の股関節 | ±80° |
| `personKneeL` / `personKneeR` | 左右の膝（前へは曲がらない） | 0〜120° |

計算の順番は「高さ → 脚 → 腰まわりの回転 → 頭」です。

1. **基本の高さ**…`legTop = (0.47 − 0.16·crouch)·h`、`torso0 = (0.44 − 0.16·crouch)·h`、
   `torso1 = (0.78 − 0.18·crouch)·h`、`head0 = (0.84 − 0.18·crouch)·h`、`head1 = (0.99 − 0.18·crouch)·h`。
   しゃがむと `crouch` の割合だけ全部が下がります。
2. **脚**…股関節 `hip` → 膝 `knee` → 足 `foot` の3点。太ももとすねの長さを先に測り、
   太ももを `personHipL/R` だけ回し、すねをさらに `−personKneeL/R` だけ回して足を出します。
   **回転は長さを保つ**ので、角度を変えても脚が伸び縮みしません。
3. **胴**…`(y, z)` 平面で腰の支点 `(0, torso0)` のまわりに `personWaist` だけ回します。
   胴の上の面（肩の高さ）と首の根元はこの回転に追従します。
4. **頭**…首の根元から `personWaist + personNeck` の方向へ `head0`〜`head1` を積みます。
   `headTilt` は頭の上のリングの横ずれ `headTopX` にだけ効きます。

回転の向きは **正の角度で手前（`−y`）へ振れる**向きに統一しています。
`rot(dy, dz, deg)` が2D回転の実体で、`rotateAbout(py, pz, oy, oz, deg)` は
「点 `(py,pz)` を支点 `(oy,oz)` のまわりに回す」ためのラッパーです。

戻り値は `{ h, bw, bd, legR, headR, legTop, torso0, torso1, head0, head1, bodyY, headY,
headTopX, poseTop, pose, stride, crouch, lean, waistAngle, neckAngle, hipAngles,
kneeAngles, waistPivot, neckBase, headC0, headC1, headAxis, torsoBottom, torsoTop, legs }`。

- `legs` は `[{ hip, knee, foot }, …]`（左右2本）。各点は `{ x, y, z }` のローカル座標
- `torsoBottom`（4点・固定）と `torsoTop`（4点・腰の角度ぶん傾く）は、そのまま胴の六面体になる
- `legR` は脚の半径（線の太さと面メッシュの管の半径の両方に使う）

**線画（`linesPerson`）・面メッシュ（`exportSurfaceTriangles` の `person`）・関節ギズモ
（`engine-gizmo.js` の `personJointHandles`）は、すべてこの1回の計算結果を使います。**
関節を回しても線と面とハンドルが食い違わないのはこのためです。

#### `linesPerson(ctx)`
`personPose(o)` の骨格を線にします。台座（`0.08h` の箱）、脚の折れ線（股→膝→足）、
胴の四角柱（下の面は固定・上の面は腰の角度ぶん傾ける）、肩の線、首の線、
頭のリング2本＋縦の骨、現在の姿勢の高さ目盛り。腕は描きません（既存仕様）。

#### `linesBuilding(ctx)`
開口のある建物。`openingEnabled === false` なら `closedBuildingLines()`＋窓へ切り替え。
true なら外枠を保ったまま、**左右の柱＋上梁**に分けて開口を描き、
奥面（`backY`）までの内側面も作ります。

#### `linesAwning(ctx)`
店舗テント。`awningGeometry()` が返す「手前上辺・奥側・底辺」をつないでテント面を作ります。
手前上辺だけを高さ・奥行き方向へ動かせるのが編集のポイント。

#### `roofSlabLines(ctx, kind)` — 屋根の線画（切妻・片流れ共通）
`roofSlab()` の断面を受け取り、線にします。

- 両端の断面リング（外形＋内形を逆順でつないだ閉じた輪郭）… **板厚が読み取れる線**
- 棟・軒に沿った縦の稜線（外側と内側の両方）
- 軒先の見付け（外側の軒と内側の軒をつなぐ短い線）

`at(u, z, s)` が断面の `(u, z)` を3Dへ持ち上げる関数で、
`axis === "x"` なら `[s, u, z]`、`"y"` なら `[u, s, z]` になります。

#### `linesGableRoof(ctx)` / `linesShedRoof(ctx)`
どちらも `roofSlabLines(ctx, kind)` を呼ぶだけの薄いラッパー。
断面の違い（山形3点／片流れ2点）は `roofSlab()` 側が持っています。

#### `linesRamp(ctx)`
スロープ。手前が床、奥が高さ `h` の楔。上面・底面・左右の側面を描き、
`handrail` が true なら左右に手すり（傾斜した梁＋4本の支柱）を追加します。

#### `linesWindowGrid(ctx)`
窓グリッド。厚み `d` の板の表裏（`y0 = −d/2`／`y1 = +d/2`）に外枠を描き、
`appendFacadeWindows()` で行×列の窓を並べます。
`windowRows`/`windowCols` は最低1、`windowBack` は既定 true（板なので裏表とも窓）。

---

### 3.9 保存データの正規化

#### `normalizedAsset(o) -> q`
描画前に、**寸法の下限・ベベル値・階数・パス値などを整える**関数。
見た目は作らず、後段の `assetLines()` が安全に読める形へ変換します。

- 頭で `syncAttachedPart(o)`：建物へ接着している部品（テント・看板）は親の寸法へ追従させる

> **注意**：`normalizedAsset()` は **値を整えるだけで、形は作らない**関数です。
> ここで線画を作り始めると、`genAsset()` と二重に描画されて線が倍になります。
- アセット別に分岐し、**`*Params()` の結果をオブジェクトへ書き戻す**
  - `cornerCutBox` … 開口3値を再計算して保存
  - `beveledBox` … `bevelOffset` / `bevelSegments` を 1〜4 に
  - `wallSign` … `ra`/`rb`/`h` を板の寸法へ、ベベル設定を保存
  - `recessedStackedBuilding` … 全パラメータを書き戻し `h = totalH`
  - `balcony`（厚さ1本＋手すり高さ）、`uWall`（壁の厚さ）、`sphere`（必ず真球へ）、`awning`、`building`、`box`
  - `gableRoof`/`shedRoof` … `roofParams()` を書き戻し
  - `ramp` … `rampParams()` を書き戻し
  - `windowGrid` … 行/列を最低1、`h` は最低0.2、`windowBack` 既定 true、`normalizedWindowFields()` を展開
- 該当なしはそのまま返す

#### `genAsset(o) -> 線画配列`
**正規化済みアセットを線画へ変換する入口**。
`assetLines(normalizedAsset(o))` の各線に `ob`・`d3:true`・`cs:sigNow()` を付けて返します。

---

### 3.10 既存エンジンへの接続と初期化

#### `genShape` の差し替え
エンジン本体を書き換えず、**元の関数を退避してからアセットだけ分岐**します。

```js
const baseGenShape = genShape;
genShape = function (o) {
    return o && o.type === "asset" ? genAsset(o) : baseGenShape(o);  // 通常の rect/box/circ は従来処理
};
```

#### `obBounds` の差し替え
アセットの **外接範囲**をここで計算します。選択枠・間取りのヒット判定・ボックス選択・
移動ギズモが全部この値を使うため、形に合わせて正確に返すことが重要です。

分岐ごとの点の取り方:

| アセット | 外接範囲の作り方 |
| --- | --- |
| `custom` | `geometry.vertices` を `customPt()` で変換 |
| `cornerCutBox` | 5角形の輪郭を上下に、開口4点も（有効時のみ） |
| `wallSign` | 表裏の輪郭＋金具の先端まで |
| `wallSideSign` | 看板＋金具ぶんの箱の8点 |
| `pathPipe` | `pathPipeMesh()` の全リング頂点 |
| `recessedStackedBuilding` | 幅・奥行き・梁の張り出しを含む格子点 |
| 階層建物 | 各階の箱＋縁（rim）の張り出し |
| `gableRoof`/`shedRoof` | 軒の出を含む4隅の上下＋棟の点 |
| それ以外 | `±ra, ±rb, 0〜h` の8点（包絡箱） |

最後に全点の `min`/`max` を取って `{ lo, hi }` を返します。

#### `regenObjects()`
起動時に、自動保存されているオブジェクトを **新しい線画で作り直す**ための1行。
保存データの寸法はそのまま、描画だけ最新ロジックへ更新します。

---

## 4. 計算のツボ（数式で理解する）

### 4.1 なぜ屋根の板厚が均一になったのか

**旧実装**は「外側の面を基準に、`z`（鉛直）方向へ `thickness` を足す」方式でした。
斜面の角度を `θ` とすると、鉛直に `t` 足したときの **斜面に直角な距離**は `t·cos θ` になります。
つまり勾配が強いほど板が薄く見え、軒先と棟で厚みが変わってしまっていました。

> **ポイント**：板厚は「高さ方向の寸法」ではなく **斜面に直角な距離**で定義する。
> これが今回の修正の核心です。

**新実装**は法線方向へずらす方式です。

```
外側の断面   outerPath = [ (u0,z0), (u1,z1), ... ]
内向き法線   n_i = normalize(接線を −90°回したもの)
内側の断面   innerPath = offsetPolyline2D(outerPath, thickness)      ← 斜面・棟
             両端だけは鉛直に切る： z_end = z_outer − thickness / cosθ  ← 軒先
断面         cross = outerPath + reverse(innerPath)
```

**端を鉛直に切る理由**：法線方向へずらすだけだと、内側の折れ点が棟方向へずれて屋根の中心が
1〜2cm 移動し、軒先が余計に伸びます。端だけ `t / cosθ`（θ＝勾配角度）だけ下げれば、
小口が垂直になり、しかも斜面上の垂距離は端でも `t` のまま保たれます。

実際、`roofSlab()` の戻り値で確認した断面（幅4.2・奥行3.2・棟高1.35・板厚0.2）:

| 屋根 | 外側 | 内側 |
| --- | --- | --- |
| 切妻 | (−1.78, 0) (0, 1.35) (1.78, 0) | (−1.78, −0.251) (0, 1.099) (1.78, −0.251) |
| 片流れ | (−1.78, 0) (1.78, 1.35) | (−1.78, −0.214) (1.78, 1.136) |

どの点でも斜面までの垂距離はちょうど 0.2 m です。

どの面でも `innerPath` は `outerPath` から **法線距離 `thickness`** だけ離れているので、
勾配・軒の出・棟の高さを変えても板厚は一定です。

**検算結果**（`gableRoof` / `shedRoof`、内側の各点から斜面までの垂距離）:

| thickness | gableRoof | shedRoof |
| --- | --- | --- |
| 0.06 | 0.06 / 0.06 / 0.06 | 0.06 / 0.06 |
| 0.20 | 0.20 / 0.20 / 0.20 | 0.20 / 0.20 |
| 0.35 | 0.35 / 0.35 / 0.35 | 0.35 / 0.35 |

（誤差 0.002 未満。全ケースで `uniform: true`）

### 4.2 窓の「分割数」と「大きさ」はこう効く

- **行・列**を増やす → `cellW = (usableW − gx(cols−1))/cols` が小さくなる
- **窓の幅 `ww`** を指定 → `winW = min(cellW, ww)`、余りは `padX = (cellW−winW)/2` で左右へ均等配分
- `ww = 0` は「セルいっぱい（自動）」

したがって「窓を小さくする」＝「窓のまわりの壁を増やす」という自然な見た目になります。
上限はセル寸法なので、窓どうしが重なることはありません。

### 4.3 角を丸めたパイプの曲がり

`cut = min(cornerRadius·tan(turn/2), lenPrev·0.45, lenNext·0.45)` の
「45%上限」が効いているおかげで、短い線分が続いても円弧が隣の区間を食い潰しません。
`turn` がほぼ0（まっすぐ）や180°（折り返し）のときは円弧を作らず角のまま通します。

### 4.4 凹んだ多角形の分割

耳切り法は「凸の角を1つずつ切り落として三角形にしていく」方法。
重心からの扇状分割と違い、**凹みをまたぐ三角形が作られない**ため、
上ビューでも輪郭からはみ出した尖りが出ません。

---

## 5. 新しいアセットを足す手順

1. **`ASSETS` に定義を追加**
   `label` / `glyph` / `w` / `d` / `h` / 固有の初期値 / `accent`。
2. **`*Params(o)` を書く**（任意だが推奨）
   入力値をクランプし、描画に使う数値を1か所にまとめる。線画・メッシュ・ギズモ・外接範囲で共有する。
3. **`lines<Name>(ctx)` を書く**
   `ctx = { o, kind, w, d, h, c, a, out }`。`lineA` / `polyA` / `boxA` で `out` に積む。
4. **`ASSET_LINE_BUILDERS` に登録**
   `myAsset: linesMyAsset,` を1行追加。
5. **`normalizedAsset()` に分岐を追加**
   `if (q.asset === "myAsset") return { ...q, ...params }` で値を書き戻す。
6. **`obBounds()` に分岐を追加**
   **必ず専用の点列**を返す。汎用フォールバック（包絡箱）は傾斜や張り出しが消えるので、
   斜面・張り出し・開口があるアセットでは使わない。

   > **注意**：`obBounds` が包絡箱のままだと、**選択枠・ボックス選択・間取りの当たり判定**が
   > 実物とずれます。見た目が正しくても「選べない／別の場所で当たる」になります。
7. **`engine-render.js` に面メッシュ**（`exportSurfaceTriangles`）を書く
   新アセットは専用の三角形分割が必要。汎用フォールバックは包絡箱になる。
8. **必要ならギズモ**（`engine-gizmo.js` の `specialGizmo`）と **パネル**（`engine-core.js` / `studio-ui.js`）を追加。
9. `python3 build-city-grid.py` で単体版を再生成し、`node --check` で構文確認。

> **注意**：`assetLines` を分割するときに `return closedBuildingLines(...)` のように
> 戻り値をそのまま返すと、それまでに積んだ線画が捨てられます。`out.push(...)` で受けてください。

---

### 5-2. 写経：共通部品だけでアセットを1個足す

3.6b の部品を使うと、**寸法計算・登録・線画**がこの長さで書けます。
（この例は実際に読み込んで `assetLines()` が 42本・全点が有限値になることを確認済み）

```js
// 1) 形を書く。ctx = { o, kind, w, d, h, c, a, out } が渡ってくる。
function linesBooth(ctx) {
    const { o, w, d, h, c, out } = ctx;

    // 数値は assetNum で「有限値＋範囲内」に寄せる（0除算・NaN 予防）
    const steps = Math.round(assetNum(o, "boothSteps", 4, 1, 12));
    const cols = Math.round(assetNum(o, "boothCols", 3, 1, 8));

    // 床（1本）
    out.push(rect2DOutlineA(o, 0, 0, w, d, 0, c));

    // 柱（円柱のワイヤー）と屋根（多角形を尖らせる）
    out.push(...wireCylinderA(o, -w * 0.35, -d * 0.35, 0.06, 0, h, 8, c));
    out.push(...wireCylinderA(o, w * 0.35, -d * 0.35, 0.06, 0, h, 8, c));
    out.push(...wirePyramidA(o, [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]], h, h + 0.5, c));

    // 奥へ上がる階段（踏面と蹴上げを全部描く）
    out.push(...stairsRunA(o, { width: w * 0.5, depth: d, steps, baseZ: 0, topZ: h * 0.4, color: c }));

    // 手前の柵（格子）。等間隔の座標は spanSplit で作る
    const sp = spanSplit(w, cols, 0.06, 0.08);
    sp.centers.forEach((x) => out.push(rect2DOutlineA(o, x, d / 2, sp.size, 0.08, 0.02, c)));
    out.push(...latticePanelA(o, { width: w, z0: h * 0.2, z1: h * 0.6, y: -d / 2, cols, rows: 2, color: c }));

    // 屋根の下に弧を1本（飾り）。斜めの面は quadFaceA で
    out.push(arcPointsA(o, 0, 0, w * 0.3, d * 0.3, h + 0.02, 0, Math.PI, 24, c, 1));
}

// 2) カタログと線画表へ同時登録（既存名は上書きしない）
registerAsset("booth", { label: "売店", glyph: "▤", w: 1.4, d: 1.0, h: 1.2 }, linesBooth);
```

登録したあと必要になるのが、既存アセットと同じく次の3点です（§5 の 5〜8 と同じ）。

1. `normalizedAsset()` に `if (q.asset === "booth") return { ...q, boothSteps: …, boothCols: … }`
2. `obBounds()` に**専用の点列**（包絡箱にしない）
3. `engine-render.js` の `exportSurfaceTriangles` に面メッシュ

> 逆に言えば、**形（線画）だけならこの3ステップを踏むまで棚に出さない**のが安全です。
> `registerAsset` はあくまで「カタログと線画表の同時登録」までです。

## 6. 関数一覧（全123関数）

`asset.js` の**トップレベル関数・主要な定数関数を全部**載せています（123個）。
「**新規**」は 2026-10-29 に足した共通部品です。引数は `asset.js` の宣言そのままです。


#### 2. 棚・選択パネルに表示する名前とアイコン

| 関数 | 引数 | 説明 |
| --- | --- | --- |
| `assetLabel` | `(o)` | 表示名（接続パーツは役割名）を返す |
| `assetGlyph` | `(o)` | 棚・アウトライナー用のアイコン文字を返す |

#### 3. 座標変換と線画の共通ヘルパー

| 関数 | 引数 | 説明 |
| --- | --- | --- |
| `pt` | `(o, x, y, z)` | ローカル→ワールド変換（既存の k/PL 面座標系） |
| `customPt` | `(o, x, y, z)` | custom アセット専用の座標変換（回転・off・ca/cb 込み） |
| `lineA` | `(o, pts, color = o.c || \"#e7fff4\", width = o.w || 2)` | 3Dの折れ線を線画オブジェクトへ包む（engine の genShape 形式） |
| `customLineA` | `(o, pts, color = o.c || \"#e7fff4\", width = o.w || 2)` | custom アセット用の lineA（customPt を使う） |
| `polyA` | `(o, pts, color, width)` | 折れ線の末尾を先頭へ戻して閉じる |
| `boxA` | `(o, w, d, z0, z1, color = o.c || \"#e7fff4\")` | 直方体の底面・上面・4本の縦辺（6本） |
| `beveledWireBoxA` | `(o, cx, cy, w, d, z0, z1, offset = 0.06, segments = 3, color = o.c || \"#e7fff4\")` | ベベル箱の線画（上下の輪郭＋縦辺） |
| `wireBoxVA` | `(o, cx, cy, w, d, z0, z1, color = o.c || \"#e7fff4\")` | 箱の**縦4本だけ**（上下の面を描かない＝挟まれて見えない部材用） |
| `wireBoxNoTopA` | `(o, cx, cy, w, d, z0, z1, color = o.c || \"#e7fff4\")` | 箱の**上面を描かない**（上面が別部材の面と重なる柱用） |
| `cornerCutWireBoxA` | `(o, w, d, z0, z1, offset, corner, color = o.c || \"#e7fff4\", cutColor = \"#e24b4b\")` | 隅切り箱の線画（切り口の辺だけ赤） |
| `cornerCutOpeningWireBoxA` | `(o, opening, z1, color = o.c || \"#e7fff4\", cutColor = \"#e24b4b\")` | 隅切り面の開口（側面・上面・奥壁） |
| `beveledBoxSegments` | `(value, legacyValue, fallback = 4)` | ベベルの分割数(1〜4)を決める（旧 bevelEdges 互換） |
| `beveledBoxFootprint` | `(width, depth, offset, segmentCount)` | ベベル箱を上から見た輪郭点（面取り付き） |
| `wallSignParams` | `(o)` | 壁付け看板の幅・厚み・高さ・ベベル・金具をクランプ |
| `wallSignFacePoints` | `(params)` | 看板の表裏の輪郭（ベベル時は4隅を丸めた多角形） |
| `wallSignBrackets` | `(params)` | 取付金具1本ぶんの箱 [{x0,x1,y0,y1,z,h}] |
| `beveledBoxParams` | `(o)` | w/d・ベベル最大値・ベベル量・分割数 |
| `cornerCutFootprint` | `(width, depth, offset, corner = \"front-left\")` | 隅切りした5辺の凸多角形（平面輪郭） |
| `cornerCutBoxParams` | `(o)` | w/d・隅切りの最大値・隅切り量・対象の角 |
| `cornerCutOpeningRayDistance` | `(origin, direction, polygon)` | 光線と多角形の交差距離（開口の奥行き用） |
| `cornerCutOpeningParams` | `(o)` | 切り口に沿う開口の幅・高さ・奥行きを正規化 |
| `stackedOpeningParams` | `(o, f = o?.floors?.[0])` | 1F開口の初期値と上限（幅・高さ・奥） |
| `recessedMaxInset` | `(width, depth)` | 凹ませられる最大量（幅・奥行きから決まる） |
| `recessedStackedBuildingParams` | `(o)` | 凹窓階層建物の全パラメータ（階・窓・ベベル・端の壁） |
| `recessedStackedBuildingFloors` | `(o, params = recessedStackedBuildingParams(o)` | 各階の寸法・位置の配列 |
| `recessedHandlePatch` | `(o, kind, value)` | ハンドル種別 → setOb の差分 |
| `recessedStackedBuildingJunctionWindows` | `(o, params = recessedStackedBuildingParams(o)` | 各階の接合部に置く窓帯の指定 |
| `recessedStackedBuildingFootprint` | `(params)` | 建物の平面輪郭（凹み込み） |
| `polygonEarClip` | `(points)` | 凹多角形の耳切り三角形分割 |
| `recessedStackedBuildingCapPath` | `(params, notch)` | スラブ断面（窓帯の切り欠き付き多角形） |
| `recessedStackedBuildingBeamFootprint` | `(params)` | 梁（見附）の平面輪郭 |
| `recessedStackedBuildingWindowPaths` | `(params)` | 窓帯の面パス（手前枠・側面・上面・奥枠） |
| `recessedStackedBuildingWindowMullionPoints` | `(params)` | 窓の桟（方立）の点列 |
| `recessedStackedBuildingLines` | `(o)` | 上記をまとめた凹窓階層建物の線画 |
| `wireBoxA` | `(o, cx, cy, w, d, z0, z1, color = o.c || \"#e7fff4\")` | 中心(cx,cy)指定の箱（1アセット内に複数部品を置く） |

#### 5. パスパイプ用のベクトル計算

| 関数 | 引数 | 説明 |
| --- | --- | --- |
| `pathVecSub` | `(a, b)` | 3Dベクトルの引き算 a-b |
| `pathVecAdd` | `(a, b, scale = 1)` | 3Dベクトルの足し算 a + b*scale |
| `pathVecScale` | `(a, scale)` | 3Dベクトルの定数倍 |
| `pathVecDot` | `(a, b)` | 3Dベクトルの内積 |
| `pathVecCross` | `(a, b)` | 3Dベクトルの外積 |
| `pathVecLength` | `(a)` | 3Dベクトルの長さ |
| `pathVecUnit` | `(a, fallback = [1, 0, 0])` | 3Dベクトルの正規化（ゼロ長は fallback） |
| `pathRotateAroundAxis` | `(v, axis, angle)` | ベクトルを任意軸まわりに回す（パイプ断面の向き） |
| `pathPipeDefaultPoints` | `()` | パスパイプの初期制御点 |
| `pathPipeControlPoints` | `(o)` | 制御点を配列で取得（クランプ付き） |
| `pathPipeRoundedPath` | `(o)` | 角を丸めた中心線（折れ線） |
| `pathPipeMesh` | `(o)` | 円管のメッシュ（断面リングを並べる） |
| `spokesA` | `(o, c0, r0, z0, c1, r1, z1, n = 8, color = o.c, width = o.w || 1)` | 楕円リング2つの対応点を結ぶ縦の骨（円柱・円錐の稜線） |
| `ringA` | `(o, rx, ry, z, n = 8, color = o.c || \"#e7fff4\")` | 原点中心の楕円リング1本 |

#### 6. 実用ヘルパー

| 関数 | 引数 | 説明 |
| --- | --- | --- |
| `finiteNumber` | `(value, fallback = 0)` | Number() の安全弁（NaN/Infinity を fallback に） |
| `assetDimensions` | `(o)` | ra/rb/h から 幅・奥行き・高さ を返す |
| `assetFootprintArea` | `(o)` | 床面積 w*d |
| `assetVolume` | `(o)` | 体積 w*d*h |
| `translateLocalPoints` | `(pts, dx = 0, dy = 0, dz = 0)` | 点列を平行移動 |
| `mirrorLocalPoints` | `(pts, axis = \"x\")` | 点列を軸で反転（左右対称の部品用） |
| `scaledAssetProps` | `(o, scale = 1)` | 寸法を s 倍した ra/rb/h を返す（複製・拡大） |
| `offsetPolyline2D` | `(points, distance)` | 折れ線を法線方向へ一定距離オフセット（マイター処理） |
| `evenSpaced` | `(count, span)` | 区間へ等間隔の座標（count 個） |
| `linearRepeatOffsets` | `(count, spacing, axis = \"x\")` | 原点対称に等間隔の3Dオフセット |
| `aabbOverlaps` | `(a, b, pad = 0)` | AABB同士の重なり判定（pad 付き） |
| `assetsOverlap` | `(a, b, pad = 0)` | アセット同士の重なり判定（obBounds を使う） |
| `windowGridOptions` | `(o, wallW, wallH)` | 窓の行・列・余白・サッシ・隙間・1枚の大きさを正規化 |
| `normalizedWindowFields` | `(q)` | 窓グリッドの値を保存データへ書き戻す |
| `facadeWindowGridRects` | `(wallW, wallH, options)` | 壁面へ窓の矩形を並べる（中心基準） |
| `windowRectHitsOpening` | `(rect, opening)` | 窓が開口（1Fの入口）に重なるか |
| `appendFacadeWindows` | `(o, out, w, d, h, color, opening)` | 壁面の窓を out へ追加（正面・背面・側面） |
| `roofParams` | `(o)` | 屋根の幅・奥行き・棟高・板厚・軒の出・棟の向き |
| `roofSlab` | `(o, kind = o?.asset)` | 屋根板の断面（外側/内側）と押し出し（板厚は斜面に直角で一定） |
| `roofFitFromHost` | `(host, kind = \"gableRoof\")` | 下の建物の寸法に屋根を合わせる（既定値生成） |
| `rampParams` | `(o)` | スロープの傾き・高さ・長さ |
| `buildingParams` | `(o)` | 開口建物の寸法と開口 |
| `closedBuildingLines` | `(o, w, d, h, color = o.c || \"#222222\")` | 箱（閉じた建物）の線画 |

#### 6.2 新しいアセットを作るときの下請け（2026-10-29 追加）

| 関数 | 引数 | 説明 |
| --- | --- | --- |
| `assetNum` | `(o, key, fallback = 0, min = -Infinity, max = Infinity)` | 数値プロパティを有限値＋範囲内で取り出す（**新規**） |
| `assetBool` | `(o, key, fallback = false)` | 真偽プロパティを "false"/0/"off" も含めて読む（**新規**） |
| `snapValue` | `(v, step = 0.1)` | 値を step の倍数へ丸める（**新規**） |
| `roundTo` | `(v, digits = 2)` | 小数桁へ丸める（表示用・**新規**） |
| `lerp` | `(a, b, t)` | 線形補間（**新規**） |
| `inverseLerp` | `(a, b, v)` | 線形補間の逆算（**新規**） |
| `boundsOfPoints` | `(pts)` | 点列のAABB（**新規**） |
| `smoothUnit` | `(t)` | smoothstep 0..1（**新規**） |
| `spanSplit` | `(total, count, gap = 0, minSize = 0)` | 区間へ等間隔に並べる（**新規**） |
| `rect2DOutlineA` | `(o, cx, cy, w, d, z, color, width)` | 水平な長方形1本（**新規**） |
| `quadFaceA` | `(o, a, b, c, d, color, width)` | 任意の4点を閉じた面に（**新規**） |
| `arcPointsA` | `(o, cx, cy, rx, ry, z, a0 = 0, a1 = Math.PI, segments = 16, color, width)` | 円弧の折れ線（**新規**） |
| `discOutlineA` | `(o, cx, cy, rx, ry, z, segments = 16, color)` | 中心指定の円・楕円（**新規**） |
| `wireCylinderA` | `(o, cx, cy, r, z0, z1, segments = 12, color)` | ワイヤー円柱（**新規**） |
| `wirePrismA` | `(o, polygon, z0, z1, color)` | 任意断面の押し出し（**新規**） |
| `wirePyramidA` | `(o, polygon, zBase, apexZ, color, apexX = 0, apexY = 0)` | 任意断面の錐（**新規**） |
| `stairsRunA` | `(o, opt = {})` | 直階段（**新規**） |
| `latticePanelA` | `(o, opt = {})` | 格子パネル＝柵・桟（**新規**） |
| `registerAsset` | `(kind, meta = {}, builder)` | カタログと線画表へ同時登録（**新規**） |
| `describeAsset` | `(o)` | 1行のデバッグ要約（**新規**） |

#### 7. アセットごとの線画生成本体

| 関数 | 引数 | 説明 |
| --- | --- | --- |
| `assetLines` | `(o)` | 形ごとの線画を ASSET_LINE_BUILDERS から呼ぶ入口 |
| `linesCustom` | `(ctx)` | 作成サイトから読み込んだ任意形状 |
| `linesBox` | `(ctx)` | 直方体 |
| `linesWallSign` | `(ctx)` | 壁付け看板（単体） |
| `linesCornerCutBox` | `(ctx)` | 隅切り直方体 |
| `linesWallSideSign` | `(ctx)` | 横壁看板（建物の横壁へ接着） |
| `linesBeveledBox` | `(ctx)` | ベベル直方体 |
| `linesPathPipe` | `(ctx)` | パスパイプ |
| `linesRecessedStackedBuilding` | `(ctx)` | 凹窓階層建物 |
| `linesStackedBuilding` | `(ctx)` | 階層建物／ベベル階層建物（共通） |
| `linesBalcony` | `(ctx)` | 壁付けベランダ |
| `linesStall` | `(ctx)` | 屋台（コの字の壁＋カウンター箱＋屋根箱） |
| `linesStool` | `(ctx)` | 丸椅子（台座・ポール・座面。各段2輪＋シルエット2本） |
| `linesStairs` | `(ctx)` | 階段 |
| `linesCrosswalk` | `(ctx)` | 横断歩道（縞を等間隔に並べる） |
| `linesCylinder` | `(ctx)` | 円柱 |
| `linesCone` | `(ctx)` | 円錐 |
| `linesSphere` | `(ctx)` | 球体（輪郭円＋赤道の線） |
| `linesTriPrism` | `(ctx)` | 三角柱 |
| `linesTriPyramid` | `(ctx)` | 三角錐 |
| `linesLantern` | `(ctx)` | ランタン（上下のリング＋骨） |
| `linesSign` | `(ctx)` | 看板（絵枠付き） |
| `personPose` | `(o)` | 人物の骨格・関節位置を1回で計算（線画とギズモで共有） |
| `linesPerson` | `(ctx)` | 人物（関節角度を反映した骨格の線画） |
| `linesBuilding` | `(ctx)` | 開口のある建物 |
| `linesAwning` | `(ctx)` | 店舗テント |
| `roofSlabLines` | `(ctx, kind)` | 屋根板の線画（切妻・片流れ共通） |
| `linesGableRoof` | `(ctx)` | 切妻屋根 |
| `linesShedRoof` | `(ctx)` | 片流れ屋根 |
| `linesRamp` | `(ctx)` | スロープ |
| `linesWindowGrid` | `(ctx)` | 窓グリッド（壁面の窓パネル） |

#### 8. 保存データ・入力値の正規化

| 関数 | 引数 | 説明 |
| --- | --- | --- |
| `normalizedAsset` | `(o)` | 保存データ・入力値の正規化（1形状=1分岐） |
| `genAsset` | `(o)` | 線画生成の入口（normalizedAsset → assetLines） |

---


| 関数 | 役割 | 主な呼び出し元 |
| --- | --- | --- |
| `assetLabel` / `assetGlyph` | 表示名・アイコン | studio-ui（棚・アウトライナー） |
| `pt` / `customPt` | ローカル→ワールド変換 | lineA ほか全線画 |
| `lineA` / `customLineA` / `polyA` | 線画オブジェクト化 | 各 lines* |
| `boxA` | 直方体6本 | 看板・人物・ベランダ |
| `beveledWireBoxA` | ベベル箱の線画 | 壁横看板・金具 |
| `cornerCutWireBoxA` / `cornerCutOpeningWireBoxA` | 隅切り箱・開口 | linesCornerCutBox |
| `wireBoxA` | 中心指定の箱 | ベランダ |
| `ringA` / `spokesA` | 楕円リング・縦の骨 | 円柱・円錐・ランタン |
| `wallSignParams` / `wallSignFacePoints` / `wallSignBrackets` | 壁付け看板 | linesWallSign・obBounds・ギズモ |
| `beveledBoxSegments` / `beveledBoxFootprint` / `beveledBoxParams` | ベベル形状 | beveledBox・wallSign |
| `cornerCutFootprint` / `cornerCutBoxParams` / `cornerCutOpeningRayDistance` / `cornerCutOpeningParams` | 隅切りと開口 | linesCornerCutBox・normalizedAsset |
| `stackedOpeningParams` | 1F開口の既定/上限 | linesStackedBuilding |
| `recessedMaxInset` / `recessedStackedBuildingParams` / `...Floors` / `...JunctionWindows` / `...Footprint` / `...CapPath` / `...BeamFootprint` / `...WindowPaths` / `...WindowMullionPoints` / `...Lines` | 凹窓階層建物 | linesRecessedStackedBuilding |
| `recessedHandlePatch` | ハンドル→差分 | engine-gizmo・studio-ui |
| `polygonEarClip` | 凹多角形の三角形分割 | 凹窓階層建物の面メッシュ |
| `pathVec*` / `pathRotateAroundAxis` | 3Dベクトル演算 | パスパイプ |
| `pathPipeDefaultPoints` / `pathPipeControlPoints` / `pathPipeRoundedPath` / `pathPipeMesh` | パスパイプの形状 | linesPathPipe・obBounds・ギズモ |
| `finiteNumber` | 数値の安全弁 | ほぼ全体（29か所） |
| `assetDimensions` / `assetFootprintArea` / `assetVolume` | 寸法・面積・体積 | 屋根合わせ・UI |
| `translateLocalPoints` / `mirrorLocalPoints` / `scaledAssetProps` | 変形 | 複製・拡大 |
| `lerp` / `inverseLerp` / `snapValue` / `roundTo` | 補間・丸め（**新規**） | 汎用 |
| `boundsOfPoints` | 点列のAABB（**新規**） | 汎用 |
| `offsetPolyline2D` | 折れ線のオフセット（**新規**） | roofSlab |
| `evenSpaced` / `linearRepeatOffsets` | 等間隔配置（**新規**） | 汎用 |
| `aabbOverlaps` / `assetsOverlap` | 衝突判定 | 配置チェック |
| `windowGridOptions` / `facadeWindowGridRects` / `windowRectHitsOpening` / `appendFacadeWindows` / `normalizedWindowFields` | 窓の割り付け | 建物・窓グリッド |
| `roofParams` / `roofSlab` / `roofFitFromHost` | 屋根（板厚は法線基準） | 屋根アセット |
| `rampParams` | スロープ | linesRamp |
| `buildingParams` / `closedBuildingLines` | 開口建物 | linesBuilding |
| `assetLines` / `ASSET_LINE_BUILDERS` | 線画の振り分け | genAsset |
| `lines*`（27本） | 形ごとの線画 | assetLines |
| `roofSlabLines` | 屋根の共通線画 | linesGableRoof / linesShedRoof |
| `normalizedAsset` | 保存データの正規化 | genAsset・setOb |
| `genAsset` | 線画生成の入口 | genShape |
| `genShape` / `obBounds`（差し替え） | エンジン接続 | engine-core |
| `regenObjects` | 起動時の再生成 | 初期化 |
