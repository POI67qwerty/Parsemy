/* Cached world-space Three.js line/depth renderer; Canvas remains the reliable default. */
(() => {
    let renderer, renderCanvas, cachedScene=null, cacheRefs=[], cacheSurfaceMode=null, cacheLineWidth=null, lastSceneKey="",cacheBuildCount=0;
    let enabled=false;
    const colorFor=value=>{try{return new THREE.Color(value||"#e7fff4");}catch(_){return new THREE.Color("#e7fff4");}};
    function ensureRenderer(){if(renderer)return;renderCanvas=document.createElement("canvas");renderer=new THREE.WebGLRenderer({canvas:renderCanvas,alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setClearColor(0x000000,0);}
    function invalidate(){
        if(cachedScene)cachedScene.traverse(n=>{n.geometry?.dispose();if(Array.isArray(n.material))n.material.forEach(m=>m.dispose());else n.material?.dispose();});
        cachedScene=null;cacheRefs=[];
    }
    function sceneChanged(){
        const relevant=S.filter(s=>s?.ob&&(s.d3||s.p)&&objectVisible(s.ob));
        if(cacheSurfaceMode!==(!!P.surfaceMode||!!$("bin")?.checked)||cacheLineWidth!==P.pw||relevant.length!==cacheRefs.length)return true;
        for(let i=0;i<relevant.length;i++){const s=relevant[i],r=cacheRefs[i];if(s!==r.s||s.p!==r.p||s.ob!==r.ob||objectVisible(s.ob)!==r.visible)return true;}
        return false;
    }
    function makeScene(){
        cacheBuildCount++;invalidate();const scene=cachedScene=new THREE.Scene(),depthMode=!!P.surfaceMode||!!$("bin")?.checked,seen=new Set(),linePos=[],otherPos=[],sides=[],widths=[],colors=[],facePos=[];
        for(const s of S){
            const o=s?.ob;if(!o||!objectVisible(o))continue;
            if(s.d3&&s.p){
                const col=colorFor(s.c),halfWidth=Math.max(.8,effectiveLineWidth(s)*1.5);
                for(let i=1;i<s.p.length;i++){
                    const a=s.p[i-1],b=s.p[i];if(!a||!b||a.length<3||b.length<3)continue;
                    const verts=[ [a,b,-1],[a,b,1],[b,a,1],[a,b,-1],[b,a,1],[b,a,-1] ];
                    for(const [p,q,side] of verts){linePos.push(...p);otherPos.push(...q);sides.push(side);widths.push(halfWidth);colors.push(col.r,col.g,col.b);}
                }
            }
            if(depthMode&&!seen.has(o.id)){
                seen.add(o.id);for(const tri of surfaceTriangles(o)||[])for(const p of tri)facePos.push(...p);
            }
            cacheRefs.push({s,p:s.p,ob:o,visible:true});
        }
        if(facePos.length){const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(facePos,3));const m=new THREE.MeshBasicMaterial({side:THREE.DoubleSide,colorWrite:false,depthTest:true,depthWrite:true});scene.add(new THREE.Mesh(g,m));}
        if(linePos.length){
            const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(linePos,3));g.setAttribute("other",new THREE.Float32BufferAttribute(otherPos,3));g.setAttribute("side",new THREE.Float32BufferAttribute(sides,1));g.setAttribute("lineWidthPx",new THREE.Float32BufferAttribute(widths,1));g.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
            const m=new THREE.ShaderMaterial({transparent:true,depthTest:true,depthWrite:false,vertexColors:true,uniforms:{resolution:{value:new THREE.Vector2(W,H)},depthBiasNdc:{value:0.00001}},vertexShader:`attribute vec3 other;attribute float side;attribute float lineWidthPx;uniform vec2 resolution;uniform float depthBiasNdc;varying vec3 vColor;void main(){vec4 clip=projectionMatrix*modelViewMatrix*vec4(position,1.0);vec4 otherClip=projectionMatrix*modelViewMatrix*vec4(other,1.0);vec2 a=clip.xy/clip.w;vec2 b=otherClip.xy/otherClip.w;vec2 dir=normalize((b-a)*resolution);vec2 normal=vec2(-dir.y,dir.x);clip.xy+=normal*side*lineWidthPx/resolution*clip.w;clip.z-=clip.w*depthBiasNdc;gl_Position=clip;vColor=color;}`,fragmentShader:`varying vec3 vColor;void main(){gl_FragColor=vec4(vColor,1.0);}`,side:THREE.DoubleSide,toneMapped:false});scene.add(new THREE.Mesh(g,m));
        }
        cacheSurfaceMode=depthMode;cacheLineWidth=P.pw;
    }
    function updateCamera(camera){
        camera.matrixAutoUpdate=false;
        if(orthView){
            const basis=orthBasis(),st=orthSetup(),d=basis.depth,position=d.map(v=>-v*10000);
            camera.matrixWorld.set(basis.right[0],basis.up[0],d[0],position[0],basis.right[1],basis.up[1],d[1],position[1],basis.right[2],basis.up[2],d[2],position[2],0,0,0,1);
            camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
            const near=1,far=20001,sx=2*st.sc/W,sy=2*st.sc/H,tx=2*st.ax/W-1,ty=1-2*st.ay/H;
            camera.projectionMatrix.set(sx,0,0,tx,0,sy,0,ty,0,0,2/(far-near),-(far+near)/(far-near),0,0,0,1);
        }else{
            const m=camMatrix(),position=[P.cx,P.ch-1,P.cz];
            camera.matrixWorld.set(m[0],m[3],m[6],position[0],m[1],m[4],m[7],position[1],m[2],m[5],m[8],position[2],0,0,0,1);
            camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
            const near=.1,far=2000,f=W*P.lens/36,m00=P.lens/18,m11=2*f/H,offsetY=1-2*P.hz/100;
            camera.projectionMatrix.set(m00,0,0,0,0,m11,offsetY,0,0,0,(far+near)/(far-near),-2*far*near/(far-near),0,0,1,0);
        }
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();camera.matrixWorldNeedsUpdate=false;camera.matrixWorldAutoUpdate=false;
        const bias=orthView?0.0000005:0.00001;cachedScene.traverse(n=>{if(n.material?.uniforms?.depthBiasNdc)n.material.uniforms.depthBiasNdc.value=bias;});
    }
    function drawMainLines(context){
        if(!enabled||!window.THREE||!context)return false;
        // Equisolid fish-eye is nonlinear. Keep its established Canvas projection until a dedicated shader path is ready.
        if(T==="f")return false;
        try{
            ensureRenderer();if(sceneChanged())makeScene();
            if(renderCanvas.width!==Math.round(W*renderer.getPixelRatio())||renderCanvas.height!==Math.round(H*renderer.getPixelRatio()))renderer.setSize(W,H,false);
            const camera=new THREE.Camera();updateCamera(camera);
            renderer.render(cachedScene,camera);context.drawImage(renderCanvas,0,0,W,H);
            lastSceneKey=`${S.length}|${W}|${H}|${P.surfaceMode}|${orthView||T}`;return true;
        }catch(error){enabled=false;window.cityThreeMainEnabled=false;const button=document.getElementById("threePreviewToggle");if(button){button.setAttribute("aria-pressed","false");button.classList.remove("active");button.textContent="Canvas線画";}console.warn("Three.js line renderer failed; using Canvas fallback",error);return false;}
    }
    window.cityDrawThreeMainLines=drawMainLines;window.cityThreeMainEnabled=false;
    window.cityThreePreview=on=>{enabled=!!on;window.cityThreeMainEnabled=enabled;const b=document.getElementById("threePreviewToggle");if(b){b.setAttribute("aria-pressed",String(enabled));b.classList.toggle("active",enabled);b.textContent=enabled?"Three.js線画":"Canvas線画";}if(typeof window.render==="function")window.render();return enabled;};
    window.cityThreePreviewStatus=()=>{const gl=renderer?.getContext(),ext=gl?.getExtension("WEBGL_debug_renderer_info"),gpu=gl?gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER):null;return{available:!!window.THREE,enabled,sceneKey:lastSceneKey,renderer:renderer?.info?.render||null,gpu,cacheBuildCount,cacheRefs:cacheRefs.length,activeProjection:T==="f"?"Canvas魚眼":enabled?"Three.js GPU":"Canvas"};};
    const button=document.getElementById("threePreviewToggle");if(button){button.textContent="Canvas線画";button.setAttribute("aria-pressed","false");button.classList.remove("active");button.addEventListener("click",()=>window.cityThreePreview(!enabled));}
    // ハードウェアGPUが確認できた環境だけThree.jsを標準にする。SwiftShader等はCanvasを維持。
    requestAnimationFrame(()=>{
        try{
            ensureRenderer();const gl=renderer.getContext(),ext=gl.getExtension("WEBGL_debug_renderer_info"),gpu=gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER)||"";
            const software=/(swiftshader|llvmpipe|softpipe|lavapipe|software)/i.test(gpu);
            const knownGPU=/(nvidia|geforce|amd|radeon|intel|apple|adreno|mali|powervr)/i.test(gpu);
            if(!software&&knownGPU){enabled=true;window.cityThreeMainEnabled=true;if(button){button.textContent="Three.js線画";button.setAttribute("aria-pressed","true");button.classList.add("active");}if(typeof window.render==="function")window.render();}
            else {renderer.dispose();renderer=null;renderCanvas=null;}
        }catch(_){enabled=false;window.cityThreeMainEnabled=false;if(renderer){renderer.dispose();renderer=null;renderCanvas=null;}}
    });
})();
