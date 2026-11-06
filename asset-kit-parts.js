// ============================================================
// 部品カタログ（asset-kit-parts.js）
// ------------------------------------------------------------
// 「よく使う小物」を部品として登録しておき、アセットはそれを並べて作る。
//
//   ASSET_KIT.define("shopFront", { label: "店先" }, (o, K) => [
//       ...K.part("window", { w: 0.9, h: 0.6, at: [-0.6, 0, 1.05] }),
//       ...K.part("door",   { w: 0.55, h: 1.0, at: [0.3, 0, 0.5] }),
//   ]);
//
// 決まりごと
//   ・部品は原点を中心に、正面を -Y に向けて作る（アセットの向きに合わせる）
//   ・at: [x, y, z] でその場へ置ける（省略時は原点）
//   ・寸法は m。迷ったら w（幅）・h（高さ）・d（奥行き）・t（板厚）
//
// 部品を足すときは registerPart を1つ増やすだけでよい。
// 並べる道具（K.repeat / K.grid）と組み合わせると、窓の列も数行で書ける。
// ============================================================
(function () {
    const K = typeof ASSET_KIT === "undefined" ? null : ASSET_KIT;
    if (!K || typeof K.registerPart !== "function") return;

    // 0 は「未指定」として扱う（寸法に 0 が来ることはない）。
    const num = (v, dflt) => (Number.isFinite(Number(v)) && Number(v) !== 0 ? Number(v) : dflt);

    // ---- 窓：枠（穴あきの板）＋ガラス＋縦の桟 ----
    // axis は「枠を置く壁の向き」。既定の "y" は正面（-Y）を向いた壁。
    K.registerPart("window", (o) => {
        const w = num(o.w, 0.9),
            h = num(o.h, 0.7),
            t = num(o.frame, Math.min(w, h) * 0.07),
            d = num(o.d, 0.08),
            axis = o.axis || "y",
            hole = K.rectPath(Math.max(0.02, w - 2 * t), Math.max(0.02, h - 2 * t)),
            parts = [K.box(K.rectPath(w, h), -d / 2, d / 2, { axis, holes: [hole], holeSides: true })];
        if (o.glass !== false) parts.push(K.sheet(hole, -0.006, 0.006, { axis, color: o.glassColor, width: o.width }));
        // 幅があるときは縦の桟を1本入れる（ガラスが1枚板に見えないように）。
        if (o.mullion !== false && (o.mullion === true || w - 2 * t > 0.45))
            parts.push(K.box(K.rectPath(Math.min(0.03, (w - 2 * t) * 0.25), h - 2 * t), -d / 4, d / 4, { axis }));
        return parts;
    });

    // ---- 扉：枠＋扉板＋取っ手 ----
    K.registerPart("door", (o) => {
        const w = num(o.w, 0.55),
            h = num(o.h, 1.0),
            t = num(o.frame, 0.05),
            d = num(o.d, 0.08),
            axis = o.axis || "y",
            hole = K.rectPath(Math.max(0.02, w - 2 * t), Math.max(0.02, h - 2 * t)),
            parts = [
                K.box(K.rectPath(w, h), -d / 2, d / 2, { axis, holes: [hole], holeSides: true }), // 枠
                K.box(hole, -d / 2 + 0.012, d / 2 - 0.012, { axis }), // 扉板
            ];
        if (o.handle !== false) {
            // 取っ手は扉の右寄りに、手前（-Y）へ突き出す短い円柱。
            const hx = (w - 2 * t) * 0.34,
                hz = o.handleZ === undefined ? 0 : Number(o.handleZ);
            parts.push(...K.moveParts([K.cylinder(0.018, -d / 2 - 0.07, -d / 2 - 0.01, { axis: "y", seg: 10 })], hx, 0, hz));
        }
        return parts;
    });

    // ---- 室外機：本体＋ファン＋ガラリ＋脚 ----
    K.registerPart("acUnit", (o) => {
        const w = num(o.w, 0.78),
            h = num(o.h, 0.56),
            d = num(o.d, 0.3),
            fan = Math.min(w, h) * 0.3,
            fy = -d / 2, // 正面（-Y）の位置
            fx = -w * 0.16, // ファンの中心（左寄り）
            fz = h * 0.58,
            parts = [K.box(K.rectPath(w, d), 0, h)]; // 本体（箱）
        // ファン（正面の円い凹み）と羽根の十字。
        parts.push(...K.moveParts([K.cylinder(fan, fy - 0.02, fy + 0.02, { axis: "y", seg: 18 })], fx, 0, fz));
        parts.push(...K.moveParts([K.box(K.rectPath(0.04, fan * 1.7), fy - 0.03, fy - 0.02, { axis: "y" })], fx, 0, fz));
        parts.push(...K.moveParts([K.box(K.rectPath(fan * 1.7, 0.04), fy - 0.03, fy - 0.02, { axis: "y" })], fx, 0, fz));
        // ガラリ（右側の横桟3本）。
        for (let i = 0; i < 3; i++)
            parts.push(
                ...K.moveParts(
                    [K.box(K.rectPath(w * 0.3, 0.022), fy - 0.015, fy + 0.005, { axis: "y" })],
                    w * 0.22,
                    0,
                    h * (0.74 - i * 0.16),
                ),
            );
        // 脚（2本。本体の下へ少しだけ出す）。
        [-w * 0.34, w * 0.34].forEach((x) => parts.push(...K.moveParts([K.box(K.rectPath(0.09, d * 0.85), -0.06, 0.005)], x, 0, 0)));
        return parts;
    });

    // ---- ベンチ：座面＋背もたれ＋脚 ----
    K.registerPart("bench", (o) => {
        const w = num(o.w, 1.6),
            h = num(o.h, 0.45),
            d = num(o.d, 0.42),
            t = num(o.t, 0.05),
            parts = [K.box(K.rectPath(w, d), h - t, h)]; // 座面
        [-w * 0.4, w * 0.4].forEach((x) =>
            parts.push(...K.moveParts([K.box(K.rectPath(t * 1.4, d * 0.8), 0, h - t)], x, 0, 0)),
        );
        if (o.back !== false) {
            const bh = num(o.backH, h * 1.1);
            parts.push(...K.moveParts([K.box(K.rectPath(w, t), h, h + bh)], 0, d / 2 - t / 2, 0));
        }
        return parts;
    });

    // ---- 画面用ひさし：上・下・左右を囲む、前後が開いた枠 ----
    // 上側は正面(-Y)に張り出し、左右の折れ点から下は短い直線部分になる。
    // 四隅の断面と輪郭候補はベベル直方体と同じ4分割・seam方式。
    K.registerPart("screenHood", (o) => {
        const read=(v,f)=>v!==null && v!==undefined && Number.isFinite(Number(v)) ? Number(v) : f,
            minSize=o.group ? .03 : .1,
            w=Math.max(minSize,Math.abs(read(o.w,1.1))), h=Math.max(minSize,Math.abs(read(o.h,.8))),
            oldLength=Math.max(.02,Math.abs(read(o.length,.4))),
            frameDepth=Math.max(.005,read(o.frameDepth,oldLength*.25)),
            brimLength=Math.max(0,read(o.brimLength,oldLength-frameDepth)),
            length=frameDepth+brimLength,
            t=Math.max(.005,Math.min(read(o.t,.04),w*.4,h*.28)),
            b=o.circular ? 0 : Math.max(0,Math.min(read(o.bevel,.1),w*.45,h*.45)),
            pad=Math.max(t,b)+Math.min(.001,h*.02), knee=Math.max(pad,Math.min(h-pad,read(o.knee,h*.55))),
            innerB=Math.max(0,b-t), back=length/2,
            // 枠の奥行きと、枠より手前へ張り出すつばは独立した実寸。
            front=z=>back-(frameDepth+brimLength*Math.max(0,Math.min(1,(z-knee)/(h-knee))));
        // 対応する内外の点を同じ順番にそろえる。内角が直角の場合は角頂点を繰り返し、
        // 零面積三角形と重複線を出さない（外側のベベルを維持）。
        const count=b>1e-6 ? 20 : 4, seg=count===20 ? 4 : 1;
        function contour(width,height,radius) {
            if(o.circular){
                const cseg=24,out=[];
                for(let i=0;i<cseg;i++){
                    const a=2*Math.PI*i/cseg;
                    out.push({x:width/2*Math.cos(a),z:h/2+height/2*Math.sin(a),corner:i});
                }
                return out;
            }
            let p=beveledBoxFootprint(width,height,radius,4);
            if(count===20 && p.length===4)p=p.flatMap(v=>Array.from({length:5},()=>v.slice()));
            const out=[];
            p.forEach(([x,z],i)=>{
                out.push({x,z:z+h/2,corner:i});
                const n=count===20?5:1;
                if(i===n*2-1)out.push({x:width/2,z:knee,corner:null});
                if(i===n*4-1)out.push({x:-width/2,z:knee,corner:null});
            });
            return out;
        }
        const outer=contour(w,h,b), inner=contour(w-2*t,h-2*t,innerB),
            point=(v,y)=>[v.x,y,v.z], pfront=v=>point(v,front(v.z)), pback=v=>point(v,back),
            triangles=[], edges=[], marks=[];
        const area=(a,c,d)=>{const u=c.map((x,i)=>x-a[i]),v=d.map((x,i)=>x-a[i]);return Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]);};
        const tri=(a,c,d)=>{if(area(a,c,d)>1e-12)triangles.push([a,c,d]);};
        const quad=(a,c,d,e)=>{tri(a,c,d);tri(a,d,e);};
        for(let i=0;i<outer.length;i++){
            const j=(i+1)%outer.length, a=outer[i],c=outer[j],u=inner[i],v=inner[j],
                af=pfront(a),cf=pfront(c),uf=pfront(u),vf=pfront(v),
                ab=pback(a),cb=pback(c),ub=pback(u),vb=pback(v);
            quad(af,ab,cb,cf); // 外側
            quad(uf,vf,vb,ub); // 開口の内側
            quad(ab,ub,vb,cb); // 背面の縁
            quad(af,cf,vf,uf); // 前面の縁
        }
        const same=(a,c)=>Math.hypot(...a.map((v,i)=>v-c[i]))<1e-10;
        const addEdge=(e,mark=null)=>{if(e.length>=2&&!e.every(p=>same(p,e[0]))){edges.push(e);marks.push(mark);}};
        const loop=(list,fn)=>{const p=list.map(fn).filter((v,i,a)=>i===0||!same(v,a[i-1]));if(p.length>2)addEdge([...p,p[0]]);};
        const prefix=o.group ? String(o.group)+"-" : "";
        loop(outer,pfront);loop(inner,pfront);loop(outer,pback);if(!o.noBackInner)loop(inner,pback);
        const circularBaseEdges=edges.length;
        if(o.circular){
            outer.forEach((v)=>{
                addEdge([pfront(v),pback(v)],null);
            });
        } else {
            const sideLists=o.noInnerSeam ? [[outer,b,prefix+'hoodOuter']] : [[outer,b,prefix+'hoodOuter'],[inner,innerB,prefix+'hoodInner']];
            for(const [list,radius,group] of sideLists){
                let prior=null;
                for(const v of list){
                    if(v.corner===null)continue;
                    const a=pfront(v),c=pback(v);if(prior && same(a,prior))continue;prior=a;
                    const mark=radius>1e-6 ? beveledEdgeMark(v.corner,radius,seg,group) : null;
                    addEdge([a,c],mark);
                }
            }
        }
        return [{meshTriangles:triangles,meshEdges:edges,seamMarks:marks,circularHood:!!o.circular,circularBaseEdges,onFace:true,preciseTubeEdge:true,color:o.color,width:o.width}];
    });

    // ---- 日よけ（オーニング）：斜めの幕＋手前の垂れ＋腕 ----
    // 断面（Y-Z）を左右（X）へ押し出すので、勾配がそのまま立体になる。
    K.registerPart("awning", (o) => {
        const w = num(o.w, 2.2),
            d = num(o.d, 0.7),
            drop = num(o.drop, 0.28), // 手前へ行くほど下がる量
            t = num(o.t, 0.04),
            zBack = num(o.z, 0), // 壁側の上端の高さ
            valanceH = num(o.valanceH, 0.14),
            armBelow = num(o.armBelow, 0.055),
            armAbove = num(o.armAbove, 0.01),
            zFront = zBack - drop,
            canopy = [
                [-d / 2, zFront],
                [d / 2, zBack],
                [d / 2, zBack - t],
                [-d / 2, zFront - t],
            ],
            parts = [K.box(canopy, -w / 2, w / 2, { axis: "x" })];
        // 手前の垂れ（幕）。板厚のぶんだけ手前へ出す。
        parts.push(K.box(K.offsetPath(K.rectPath(w, valanceH), 0, zFront - valanceH / 2), -d / 2 - t, -d / 2, { axis: "y" }));
        // 腕（下からの支え）。
        if (o.arms !== false) [-w * 0.42, w * 0.42].forEach((x) =>
            parts.push(...K.moveParts([K.box(K.rectPath(t, d), zFront - armBelow, zFront + armAbove)], x, 0, 0)),
        );
        return parts;
    });

    // ---- 車輪：タイヤ＋ハブ＋スポーク ----
    K.registerPart("wheel", (o) => {
        const r = num(o.r, 0.3),
            t = num(o.t, 0.16),
            hub = r * 0.3,
            parts = [K.cylinder(r, -t / 2, t / 2, { axis: "y", seg: 20 })];
        parts.push(K.cylinder(hub, -t / 2 - 0.02, t / 2 + 0.02, { axis: "y", seg: 10 }));
        for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI,
                c = Math.cos(a),
                s = Math.sin(a),
                w = 0.03;
            parts.push(
                K.box(
                    [
                        [c * hub, s * hub],
                        [c * r * 0.9, s * r * 0.9],
                        [c * r * 0.9 - s * w, s * r * 0.9 + c * w],
                        [c * hub - s * w, s * hub + c * w],
                    ],
                    -t / 2 - 0.005,
                    t / 2 + 0.005,
                    { axis: "y" },
                ),
            );
        }
        return parts;
    });

    // ---- 配管：管＋フランジ2枚 ----
    K.registerPart("pipeRun", (o) => {
        const len = num(o.len, 1.2),
            r = num(o.r, 0.05),
            axis = o.axis || "x",
            at = (s) => [axis === "x" ? s : 0, axis === "y" ? s : 0, axis === "z" ? s : 0],
            parts = [K.cylinder(r, -len / 2, len / 2, { axis, seg: 14 })];
        [-len * 0.42, len * 0.42].forEach((s) =>
            parts.push(...K.moveParts([K.cylinder(r * 1.5, -0.02, 0.02, { axis, seg: 14 })], ...at(s))),
        );
        return parts;
    });

    // ---- 五角形の立体（車のキャブ・上端を斜めに落とした塊）----
    // 「前の面 → 斜め → 上面 → 背面」の五角形を、左右（x）へ押し出した立体。
    //   w      … 幅（左右）。押し出す長さ
    //   frontY / backY … 前の面・背面の y（正面は -Y）
    //   edgeH  … 前の面の上端（＝「下がってる線」の高さ）
    //   roofH  … 上面の高さ
    //   slant  … 斜めの面が前後へ走る長さ（上面の始まり）
    // 前の面・上面・背面が四角形になるので、軽トラのキャブも建物の塊もこれ1つで作れる。
    K.registerPart("pentaPrism", (o) => {
        const w = num(o.w, 1.6),
            L = num(o.L, 2),
            backY = num(o.backY, L / 2),
            frontY = num(o.frontY, backY - L),
            roofH = num(o.roofH, 1.6),
            edgeH = Math.max(0.02, Math.min(num(o.edgeH, roofH * 0.45), roofH - 0.02)),
            slant = Math.max(
                0.01,
                Math.min(num(o.slant, (roofH - edgeH) * 0.9), Math.max(0.01, backY - frontY - 0.02)),
            ),
            profile = [
                [frontY, 0],
                [frontY, edgeH],
                [frontY + slant, roofH],
                [backY, roofH],
                [backY, 0],
            ],
            // 面を貼る側（三角形の向き）をそろえるため、反時計回りに直す。
            path = K.area2(profile) < 0 ? profile.slice().reverse() : profile;
        return [K.box(path, -w / 2, w / 2, { axis: "x" })];
    });

    // ---- タイヤ：円柱の左右の輪と少数の側面の母線 ----
    K.registerPart("tire", (o) => {
        const r = num(o.r, 0.3), t = num(o.t, 0.16), x = num(o.x, 0),
            axleY = num(o.axleY, 0),
            z = Number.isFinite(Number(o.z)) ? Number(o.z) : 0,
            seg = Math.max(8, Math.round(num(o.seg, 16))),
            verts = Number.isFinite(Number(o.verts)) ? Math.max(0, Math.round(Number(o.verts))) : 4;
        return K.moveParts([K.cylinder(r, x - t / 2, x + t / 2, { axis: "x", seg, cy: r + z, verts })], 0, axleY, 0);
    });

    // ---- 看板：板＋文字 ----
    K.registerPart("signBoard", (o) => {
        const w = num(o.w, 1.2),
            h = num(o.h, 0.35),
            t = num(o.t, 0.06),
            text = String(o.text || "SHOP"),
            parts = [K.box(K.rectPath(w, h), -t / 2, t / 2, { axis: "y" })];
        // 文字は板の手前（-Y）から少し出して貼る（板に隠されないように）。
        // text が空なら板だけ（無地の看板）になる。
        if (text.trim())
            parts.push(...K.textPart(text, { face: "front", plane: -t / 2, height: h * num(o.textScale, 0.5), stroke: h * 0.07, proud: 0.012 }));
        return parts;
    });
})();
