(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────────
  let canvas, ctx, selCanvas, selCtx;
  let originalImageData = null;
  let history = [];
  let currentTool = 'erase';
  let tolerance  = 30;
  let brushSize  = 20;
  let selection  = null;
  let isSelecting = false, selStart = null;
  let isPainting  = false, lastPaintPt = null;
  let zoomLevel  = 1;
  let resolveEditor = null;

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    canvas    = document.getElementById('editorCanvas');
    if (!canvas) return;
    ctx       = canvas.getContext('2d', { willReadFrequently: true });
    selCanvas = document.getElementById('editorSelCanvas');
    selCtx    = selCanvas.getContext('2d');

    id('toolErase') ?.addEventListener('click', () => setTool('erase'));
    id('toolBrush') ?.addEventListener('click', () => setTool('brush'));
    id('toolSelect')?.addEventListener('click', () => setTool('select'));

    wireSlider('toleranceSlider',  'toleranceValue',  v => { tolerance = v; });
    wireSlider('brushSizeSlider',  'brushSizeValue',  v => { brushSize = v; });
    wireSlider('brightnessSlider', 'brightnessValue', () => {});
    wireSlider('contrastSlider',   'contrastValue',   () => {});
    wireSlider('saturationSlider', 'saturationValue', () => {});

    id('rotateCCW')?.addEventListener('click', () => rotate(-90));
    id('rotateCW') ?.addEventListener('click', () => rotate(90));
    id('flipH')    ?.addEventListener('click', () => flip('h'));
    id('flipV')    ?.addEventListener('click', () => flip('v'));

    id('smoothBtn')    ?.addEventListener('click', smoothEdges);
    id('applyAdjBtn')  ?.addEventListener('click', applyAdjustments);
    id('cropBtn')      ?.addEventListener('click', cropSelection);
    id('undoBtn')      ?.addEventListener('click', undo);
    id('resetBtn')     ?.addEventListener('click', reset);
    id('applyEditorBtn') ?.addEventListener('click', applyEditor);
    id('cancelEditorBtn')?.addEventListener('click', cancelEditor);
    id('editorBackdrop') ?.addEventListener('click', cancelEditor);

    id('zoomIn') ?.addEventListener('click', () => changeZoom( 0.25));
    id('zoomOut')?.addEventListener('click', () => changeZoom(-0.25));
    id('zoom100')?.addEventListener('click', () => setZoom(1));

    id('editorCanvasWrap')?.addEventListener('wheel', onWheel, { passive: false });

    canvas.addEventListener('mousedown',  onMouseDown);
    canvas.addEventListener('mousemove',  onMouseMove);
    canvas.addEventListener('mouseup',    onMouseUp);
    canvas.addEventListener('mouseleave', () => { if (isPainting) finishPaint(); });
    canvas.addEventListener('click',      onCanvasClick);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
    canvas.addEventListener('touchend',   onTouchEnd,   { passive: false });
  }

  function wireSlider(sliderId, valueId, cb) {
    const s = id(sliderId), v = id(valueId);
    if (!s) return;
    s.addEventListener('input', () => { const n = +s.value; if (v) v.textContent = n; cb(n); });
  }

  // ── Open / Close ───────────────────────────────────────────────────────────
  function openEditor(dataUrl) {
    return new Promise(resolve => {
      resolveEditor = resolve;
      history = []; selection = null; isSelecting = isPainting = false; zoomLevel = 1;

      const modal = id('imageEditorModal');
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');

      const img = new Image();
      img.onload = () => {
        const maxW = Math.min(window.innerWidth  * 0.84, 1100);
        const maxH = Math.max(window.innerHeight * 0.50, 280);
        const sc = Math.min(maxW / img.width, maxH / img.height, 1);
        canvas.width  = Math.round(img.width  * sc);
        canvas.height = Math.round(img.height * sc);
        syncSelCanvas();
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setTool('erase'); setZoom(1); resetAdjSliders();
        setBtn('undoBtn', true);
        id('cropBtn').style.display = 'none';
      };
      img.src = dataUrl;
    });
  }

  function closeEditor() {
    id('imageEditorModal').classList.remove('active');
    id('imageEditorModal').setAttribute('aria-hidden', 'true');
    clearSel();
  }
  function applyEditor()  { const u = canvas.toDataURL('image/png'); closeEditor(); resolveEditor?.(u); }
  function cancelEditor() { closeEditor(); resolveEditor?.(null); }

  // ── Tool ───────────────────────────────────────────────────────────────────
  function setTool(tool) {
    currentTool = tool;
    ['Erase','Brush','Select'].forEach(t => id('tool'+t)?.classList.remove('active'));
    id('tool' + tool[0].toUpperCase() + tool.slice(1))?.classList.add('active');
    show('toleranceRow',  tool === 'erase');
    show('brushSizeRow',  tool === 'brush');
    canvas.style.cursor = tool === 'erase' ? 'crosshair' : tool === 'brush' ? 'cell' : 'default';
    clearSel();
  }

  // ── Magic wand ─────────────────────────────────────────────────────────────
  function onCanvasClick(e) {
    if (currentTool !== 'erase' || e._handled) return;
    const [x, y] = cc(e);
    saveHistory();
    const im = ctx.getImageData(0, 0, canvas.width, canvas.height);
    floodFill(im, x, y, tolerance);
    ctx.putImageData(im, 0, 0);
  }

  function floodFill(imageData, sx, sy, tol) {
    const { data, width, height } = imageData;
    if (sx < 0 || sx >= width || sy < 0 || sy >= height) return;
    const si = (sy * width + sx) * 4;
    if (data[si+3] === 0) return;
    const [tR, tG, tB] = [data[si], data[si+1], data[si+2]];
    const t = tol * 2.55;
    const vis = new Uint8Array(width * height);
    const stk = [sy * width + sx];
    while (stk.length) {
      const p = stk.pop(); if (vis[p]) continue; vis[p] = 1;
      const i = p * 4; if (data[i+3] === 0) continue;
      if (Math.abs(data[i]-tR) <= t && Math.abs(data[i+1]-tG) <= t && Math.abs(data[i+2]-tB) <= t) {
        data[i+3] = 0;
        const x = p % width, y = (p / width) | 0;
        if (x > 0)        stk.push(p - 1);
        if (x < width-1)  stk.push(p + 1);
        if (y > 0)        stk.push(p - width);
        if (y < height-1) stk.push(p + width);
      }
    }
  }

  // ── Brush eraser ───────────────────────────────────────────────────────────
  function onMouseDown(e) {
    if (currentTool === 'brush') {
      isPainting = true; lastPaintPt = cc(e);
      e._handled = true;
      saveHistory(); paintAt(...lastPaintPt);
      return;
    }
    if (currentTool === 'select') {
      selStart = { x: cc(e)[0], y: cc(e)[1] };
      isSelecting = true; selection = null;
      id('cropBtn').style.display = 'none';
      selCtx.clearRect(0, 0, selCanvas.width, selCanvas.height);
    }
  }

  function onMouseMove(e) {
    if (isPainting && currentTool === 'brush') {
      const [x, y] = cc(e);
      if (lastPaintPt) {
        const [lx, ly] = lastPaintPt;
        const steps = Math.max(1, Math.floor(Math.hypot(x-lx, y-ly) / 2));
        for (let i = 0; i <= steps; i++) paintAt(lx + (x-lx)*i/steps, ly + (y-ly)*i/steps);
      }
      lastPaintPt = [x, y]; return;
    }
    if (isSelecting && currentTool === 'select') {
      const [x, y] = cc(e);
      selCtx.clearRect(0, 0, selCanvas.width, selCanvas.height);
      selCtx.save();
      selCtx.setLineDash([6,3]); selCtx.strokeStyle = '#c41e3a';
      selCtx.lineWidth = 1.5; selCtx.fillStyle = 'rgba(196,30,58,0.06)';
      selCtx.fillRect(selStart.x, selStart.y, x-selStart.x, y-selStart.y);
      selCtx.strokeRect(selStart.x, selStart.y, x-selStart.x, y-selStart.y);
      selCtx.restore();
    }
  }

  function onMouseUp(e) {
    if (isPainting) { finishPaint(); return; }
    if (isSelecting && currentTool === 'select') {
      isSelecting = false;
      const [x, y] = cc(e);
      selection = { x: Math.round(Math.min(selStart.x,x)), y: Math.round(Math.min(selStart.y,y)),
                    w: Math.round(Math.abs(x-selStart.x)), h: Math.round(Math.abs(y-selStart.y)) };
      if (selection.w > 5 && selection.h > 5) id('cropBtn').style.display = '';
    }
  }

  function finishPaint() { isPainting = false; lastPaintPt = null; }

  function paintAt(x, y) {
    const im = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = im;
    const r = brushSize / 2;
    for (let py = Math.max(0,y-r|0); py <= Math.min(height-1,(y+r+1)|0); py++) {
      for (let px = Math.max(0,x-r|0); px <= Math.min(width-1,(x+r+1)|0); px++) {
        const d = Math.hypot(px-x, py-y);
        if (d <= r) {
          const i = (py*width+px)*4;
          const falloff = Math.max(0, 1 - (d/r)**2);
          data[i+3] = Math.round(data[i+3] * (1-falloff));
        }
      }
    }
    ctx.putImageData(im, 0, 0);
  }

  // ── Touch ──────────────────────────────────────────────────────────────────
  function onTouchStart(e) {
    e.preventDefault();
    const t = e.touches[0]; const [x,y] = ccXY(t.clientX, t.clientY);
    if (currentTool === 'erase') {
      saveHistory();
      const im = ctx.getImageData(0,0,canvas.width,canvas.height);
      floodFill(im, x, y, tolerance); ctx.putImageData(im, 0, 0);
    } else if (currentTool === 'brush') {
      isPainting = true; lastPaintPt = [x,y]; saveHistory(); paintAt(x,y);
    }
  }
  function onTouchMove(e) {
    e.preventDefault();
    if (!isPainting || currentTool !== 'brush') return;
    const t = e.touches[0]; const [x,y] = ccXY(t.clientX, t.clientY);
    if (lastPaintPt) {
      const [lx,ly] = lastPaintPt;
      const steps = Math.max(1, Math.floor(Math.hypot(x-lx,y-ly)/2));
      for (let i=0; i<=steps; i++) paintAt(lx+(x-lx)*i/steps, ly+(y-ly)*i/steps);
    }
    lastPaintPt = [x,y];
  }
  function onTouchEnd(e) { e.preventDefault(); finishPaint(); }

  // ── Crop ───────────────────────────────────────────────────────────────────
  function cropSelection() {
    if (!selection || selection.w < 1 || selection.h < 1) return;
    saveHistory();
    const im = ctx.getImageData(selection.x, selection.y, selection.w, selection.h);
    canvas.width = selection.w; canvas.height = selection.h; syncSelCanvas();
    ctx.putImageData(im, 0, 0); clearSel(); setTool('erase');
  }

  // ── Smooth edges ───────────────────────────────────────────────────────────
  function smoothEdges() {
    saveHistory();
    const im = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = im;
    const alpha = new Float32Array(width * height);
    for (let i = 0; i < width*height; i++) alpha[i] = data[i*4+3];
    const b = blurAlpha(alpha, width, height, 2);
    for (let i = 0; i < width*height; i++) data[i*4+3] = clamp(b[i]);
    ctx.putImageData(im, 0, 0);
  }

  function blurAlpha(a, w, h, r) {
    const out = a.slice(), tmp = new Float32Array(a.length);
    for (let pass = 0; pass < 2; pass++) {
      for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
        let s=0,c=0; for (let d=-r;d<=r;d++) { const nx=x+d; if(nx>=0&&nx<w){s+=out[y*w+nx];c++;} }
        tmp[y*w+x]=s/c;
      }
      for (let x=0;x<w;x++) for (let y=0;y<h;y++) {
        let s=0,c=0; for (let d=-r;d<=r;d++) { const ny=y+d; if(ny>=0&&ny<h){s+=tmp[ny*w+x];c++;} }
        out[y*w+x]=s/c;
      }
    }
    return out;
  }

  // ── Transform ──────────────────────────────────────────────────────────────
  function rotate(deg) {
    saveHistory();
    const rad = deg * Math.PI / 180;
    const nw = (deg % 180 !== 0) ? canvas.height : canvas.width;
    const nh = (deg % 180 !== 0) ? canvas.width  : canvas.height;
    const off = mkCanvas(nw, nh);
    off.ctx.translate(nw/2, nh/2); off.ctx.rotate(rad);
    off.ctx.drawImage(canvas, -canvas.width/2, -canvas.height/2);
    canvas.width = nw; canvas.height = nh; syncSelCanvas();
    ctx.drawImage(off.el, 0, 0); clearSel();
  }

  function flip(dir) {
    saveHistory();
    const off = mkCanvas(canvas.width, canvas.height);
    if (dir === 'h') { off.ctx.translate(canvas.width, 0);  off.ctx.scale(-1, 1); }
    else             { off.ctx.translate(0, canvas.height);  off.ctx.scale(1, -1); }
    off.ctx.drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(off.el, 0, 0);
  }

  function mkCanvas(w, h) {
    const el = document.createElement('canvas'); el.width = w; el.height = h;
    return { el, ctx: el.getContext('2d') };
  }

  // ── Adjustments ────────────────────────────────────────────────────────────
  function applyAdjustments() {
    const bright = +id('brightnessSlider').value;
    const contr  = +id('contrastSlider').value;
    const sat    = +id('saturationSlider').value;
    if (bright===0 && contr===0 && sat===0) return;
    saveHistory();
    const im = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = im;
    const cf = (259*(contr+255)) / (255*(259-contr));
    for (let i=0; i<data.length; i+=4) {
      if (data[i+3]===0) continue;
      let r=data[i], g=data[i+1], b=data[i+2];
      // Brightness
      r+=bright; g+=bright; b+=bright;
      // Contrast
      r=cf*(r-128)+128; g=cf*(g-128)+128; b=cf*(b-128)+128;
      // Saturation
      if (sat!==0) {
        const [h,s,l] = rgb2hsl(clamp(r),clamp(g),clamp(b));
        [r,g,b] = hsl2rgb(h, Math.max(0,Math.min(1, s+sat/100)), l);
      }
      data[i]=clamp(r); data[i+1]=clamp(g); data[i+2]=clamp(b);
    }
    ctx.putImageData(im, 0, 0);
    resetAdjSliders();
  }

  function resetAdjSliders() {
    ['brightness','contrast','saturation'].forEach(n => {
      const s = id(n+'Slider'); if(s) s.value=0;
      const v = id(n+'Value');  if(v) v.textContent='0';
    });
  }

  // ── Zoom ───────────────────────────────────────────────────────────────────
  function onWheel(e) { e.preventDefault(); changeZoom(e.deltaY < 0 ? 0.2 : -0.2); }
  function changeZoom(d) { setZoom(zoomLevel + d); }
  function setZoom(level) {
    zoomLevel = Math.max(0.2, Math.min(4, Math.round(level*100)/100));
    canvas.style.width  = (canvas.width  * zoomLevel) + 'px';
    canvas.style.height = (canvas.height * zoomLevel) + 'px';
    selCanvas.style.width  = canvas.style.width;
    selCanvas.style.height = canvas.style.height;
    const el = id('zoomLabel'); if(el) el.textContent = Math.round(zoomLevel*100)+'%';
  }

  // ── History ────────────────────────────────────────────────────────────────
  function saveHistory() {
    history.push(ctx.getImageData(0,0,canvas.width,canvas.height));
    if (history.length > 25) history.shift();
    setBtn('undoBtn', false);
  }

  function undo() {
    if (!history.length) return;
    const im = history.pop();
    if (canvas.width !== im.width || canvas.height !== im.height) {
      canvas.width = im.width; canvas.height = im.height; syncSelCanvas(); setZoom(zoomLevel);
    }
    ctx.putImageData(im, 0, 0);
    setBtn('undoBtn', !history.length);
    clearSel();
  }

  function reset() {
    if (!originalImageData) return;
    history = [];
    canvas.width = originalImageData.width; canvas.height = originalImageData.height;
    syncSelCanvas();
    ctx.putImageData(originalImageData, 0, 0);
    clearSel(); resetAdjSliders(); setZoom(1); setBtn('undoBtn', true);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function cc(e)        { return ccXY(e.clientX, e.clientY); }
  function ccXY(cx, cy) {
    const r = canvas.getBoundingClientRect();
    return [Math.round((cx-r.left)*(canvas.width/r.width)), Math.round((cy-r.top)*(canvas.height/r.height))];
  }
  function syncSelCanvas() {
    selCanvas.width = canvas.width; selCanvas.height = canvas.height;
    selCanvas.style.width  = canvas.style.width;
    selCanvas.style.height = canvas.style.height;
  }
  function clearSel() {
    selection = null; isSelecting = false;
    selCtx?.clearRect(0, 0, selCanvas.width, selCanvas.height);
    if(id('cropBtn')) id('cropBtn').style.display='none';
  }
  function show(elId, visible) { const e=id(elId); if(e) e.style.display=visible?'':'none'; }
  function setBtn(elId, disabled) { const e=id(elId); if(e) e.disabled=disabled; }
  function id(i) { return document.getElementById(i); }
  function clamp(v) { return Math.max(0, Math.min(255, Math.round(v))); }

  function rgb2hsl(r,g,b) {
    r/=255;g/=255;b/=255;
    const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;
    let h=0,s=0,l=(mx+mn)/2;
    if(d>0){
      s=l>0.5?d/(2-mx-mn):d/(mx+mn);
      if(mx===r)h=(g-b)/d+(g<b?6:0);
      else if(mx===g)h=(b-r)/d+2;
      else h=(r-g)/d+4;
      h/=6;
    }
    return [h,s,l];
  }
  function hsl2rgb(h,s,l) {
    if(s===0){const v=Math.round(l*255);return[v,v,v];}
    const q=l<0.5?l*(1+s):l+s-l*s,p=2*l-q;
    const hue=(p,q,t)=>{t=((t%1)+1)%1;if(t<1/6)return p+(q-p)*6*t;if(t<.5)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;};
    return[Math.round(hue(p,q,h+1/3)*255),Math.round(hue(p,q,h)*255),Math.round(hue(p,q,h-1/3)*255)];
  }

  // ── Public ─────────────────────────────────────────────────────────────────
  window.ImageEditor = { open: openEditor };
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
