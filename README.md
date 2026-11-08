# CITY GRID compact studio（作業用ファイル一覧）

街づくり用のパース定規アプリ。**配布するのは単体HTML 1本**（`cyberpunk-city-studio.html`）。
それ以外は開発用のソースと、ビルド／点検の道具。

## よく使うコマンド

```bash
./build.sh                 # 構文チェック → 単体HTML生成（軽量版も）→ ドキュメントHTML生成
node check-all-assets.js   # 全アセットの自己点検（失敗すると exit=1）
```

`node check-all-assets.js` は実ブラウザ（Playwright の Chromium）でHTMLを開く。
ライブラリの場所が環境依存で見つからないときは、先に環境変数を通す:

```bash
export PLAYWRIGHT_BROWSERS_PATH=<chromium を入れた所>
export NODE_PATH=<node_modules の親>
export LD_LIBRARY_PATH=<libnspr4.so などがある所>
```

## ファイル

| ファイル | 役割 |
|---|---|
| `cyberpunk-city-studio.html` | **配布物**。ソース5本とCSSを1枚にまとめたもの（手で編集しない） |
| `index.html` / `style.css` / `studio.css` | 開発用の骨組み（`build-city-grid.py` がこれを元に単体HTMLを作る） |
| `engine-lib.js` | どのファイルにも依存しない小さな道具（`CG.depthEps` 隠線の許容量／`CG.lineDedup` 同じ線を2回描かない印） |
| `engine-core.js` | 投影・カメラ・線の描画・図形の生成（`genShape` / `L2W` / `strokeW` など） |
| `engine-gizmo.js` | ハンドル（軸・面・回転リング・アセット専用）とドラッグ処理 |
| `engine-render.js` | 描画ループ・深度バッファ・隠線・面の塗り・床グリッド（`render` / `buildExportDepth` / `lineLayer`） |
| `engine-input.js` | ポインター・ピンチ・消しゴム・モード切替 |
| `engine-io.js` | 透過PNG書き出し・参考写真・保存/読み込み・起動 |
| `asset.js` | アセットの形（`linesStall` / `linesStool` / `linesSphere` …）＋登録の入口 `registerAsset()` |
| `asset-controller.js` | アセットの追加・既定値・一覧 |
| `studio-lib.js` | `studio-ui.js` と `studio-floorplan.js` が共有する道具（最初に読み込む） |
| `studio-ui.js` | 画面上のUI（アセット棚・数値パネル・プリセット・初期化） |
| `studio-floorplan.js` | 間取りモード（正面・横・上の選択、移動・回転・寸法編集） |
| `build-city-grid.py` | ソース（`engine-*.js` ほか）＋CSS → 単体HTML |
| `build-guide.py` | Markdown → ドキュメントHTML |
| `check-all-assets.js` | 全アセットの点検（線画が出る・回転に追従する・正円・ハンドル・屋台28本・エラー0） |
| `CITY_GRID_STUDIO.md` | 仕様と経緯（**いちばん詳しい**。直した所・つまずいた所はここ） |
| `OBJECT_GEOMETRY_GUIDE.md` | 図形の作り方の説明 |
| `ASSET_JS_GUIDE.md` | `asset.js` の関数ごとの説明 |
| `ASSET_KIT_GUIDE.md` | 新しいアセットの作り方（`asset-kit.js` の使い方） |
| `asset-kit.js` / `asset-kit-assets.js` | アセットを1つの記述から作る道具箱と、それで作ったアセット |
| `tests/kit-assets.js` | キット製アセットの点検（棚・線・面・固有値・回転・JSON） |
| `tests/fixtures/` | 回帰テスト用の場面データ（`bevel-corner.json`＝ベベルの角の不具合が出た場面の抜粋） |

## 決めごと

- **確認用のスクリーンショットは作らない**（画像ファイルは残さない）。
- 形が変わっていないことは、機械的な比較で確かめる
  （深度バッファ・線画の画素数・`check-all-assets.js`）。
- スクリプトを触ったら `./build.sh` と `node check-all-assets.js` の両方を通す。
- 画面まわりの実測・画素比較は `tests/` に置いてある（初回だけ `tests/setup.sh`）。
  例：`tests/run.sh tests/perf.js`、`tests/run.sh tests/pixel-surfaces.js`
