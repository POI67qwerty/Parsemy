/* City Grid Studio studio-lib — studio-ui.js と studio-floorplan.js が共有する小さな道具箱。

   もとは studio-ui.js（1つの IIFE・6,101行）の中に全部入っていたが、
   間取り（正面・横・上の選択とドラッグ編集。2,718行）を別ファイルへ出すために、
   両方から使う関数と要素だけをここへ移した。公開は `window.CityGridStudio`。

   - `el` / `side` / `stage`      : DOM の取得と、左右パネルの要素
   - `capturePointer`             : ドラッグ中にポインタを捕まえる（失敗しても続行）
   - `orthHandleGap`              : 正投影ビューで寸法ハンドルを形の外へ離す距離

   ここには UI の状態を置かない（選択中のオブジェクトなどは engine-core.js が持つ）。 */
(function () {
    "use strict";
    const SH = (window.CityGridStudio = window.CityGridStudio || {});
    SH.el = (id) => document.getElementById(id);
    SH.side = SH.el("side");
    SH.stage = SH.el("stage");
    // ポインタを捕まえてドラッグを継続する。未対応ブラウザでも操作は続けたいので、
    // 失敗しても例外は投げない（各ドラッグ処理で共通に使う）。
    SH.capturePointer = (pointerId) => {
        try {
            document.getElementById("cv").setPointerCapture(pointerId);
        } catch (err) {}
    };
    // 正投影ビューで、オブジェクトの外側へ寸法ハンドルを離す距離。
    // 形の大きさに比例させつつ、画面のピクセル基準で上下限を決める。
    SH.orthHandleGap = (span, factor = 0.35) =>
        Math.max(48 / Z, Math.min(88 / Z, Math.max(0, span) * orthScale() * factor));
})();
