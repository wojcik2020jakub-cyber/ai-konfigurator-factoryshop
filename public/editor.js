(function () {
  'use strict';

  let canvas, ctx, selCanvas, selCtx;
  let originalImageData = null;
  let history = [];
  let currentTool = 'erase';
  let tolerance = 30;
  let selection = null;
  let isSelecting = false;
  let selStart = null;
  let resolveEditor = null;

  /* ── Init ─────────────────────────────────────────────────────────────── */
  function init() {
    canvas    = document.getElementById('editorCanvas');
    ctx       = canvas.getContext('2d', { willReadFrequently: true });
    selCanvas = document.getElementById('editorSelCanvas');
    selCtx    = selCanvas.getContext('2d');

    document.getElementById('toolErase') .addEventListener('click', () => setTool('erase'));
    document.getElementById('toolSelect').addEventListener('click', () => setTool('select'));

    const slider = document.getElementById('toleranceSlider');
    const valEl  = document.getElementById('toleranceValue');
    slider.addEventListener('input', () => { tolerance = +slider.value; valEl.textContent = tolerance; });

    document.getElementById('undoBtn')        .addEventListener('click', undo);
    document.getElementById('resetBtn')       .addEventListener('click', reset);
    document.getElementById('cropBtn')        .addEventListener('click', cropSelection);
    document.getElementById('applyEditorBtn') .addEventListener('click', applyEditor);
    document.getElementById('cancelEditorBtn').addEventListener('click', cancelEditor);
    document.getElementById('editorBackdrop') .addEventListener('click', cancelEditor);

    canvas.addEventListener('click',     onCanvasClick);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup',   onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchend',   onTouchEnd,   { passive: false });
  }

  /* ── Open / close ─────────────────────────────────────────────────────── */
  function openEditor(dataUrl) {
    return new Promise(resolve => {
      resolveEditor = resolve;
      history = []; selection = null; isSelecting = false; currentTool = 'erase';

      const modal = document.getElementById('imageEditorModal');
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');

      const img = new Image();
      img.onload = () => {
        const maxW = Math.min(window.innerWidth  * 0.78, 1000);
        const maxH = window.innerHeight * 0.56;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);

        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        selCanvas.width  = canvas.width;
        selCanvas.height = canvas.height;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        updateToolUI();
        document.getElementById('undoBtn').disabled = true;
        document.getElementById('cropBtn').style.display = 'none';
      };
      img.src = dataUrl;
    });
  }

  function closeEditor() {
    document.getElementById('imageEditorModal').classList.remove('active');
    document.getElementById('imageEditorModal').setAttribute('aria-hidden', 'true');
    clearSel();
  }

  function applyEditor() {
    const url = canvas.toDataURL('image/png');
    closeEditor();
    if (resolveEditor) resolveEditor(url);
  }

  function cancelEditor() {
    closeEditor();
    if (resolveEditor) resolveEditor(null);
  }

  /* ── Tools ────────────────────────────────────────────────────────────── */
  function setTool(tool) {
    currentTool = tool;
    updateToolUI();
    clearSel();
  }

  function updateToolUI() {
    document.getElementById('toolErase') .classList.toggle('active', currentTool === 'erase');
    document.getElementById('toolSelect').classList.toggle('active', currentTool === 'select');
    canvas.style.cursor = currentTool === 'erase' ? 'crosshair' : 'default';
    const toleranceRow = document.getElementById('toleranceRow');
    if (toleranceRow) toleranceRow.style.display = currentTool === 'erase' ? '' : 'none';
  }

  /* ── Magic wand / flood fill ──────────────────────────────────────────── */
  function onCanvasClick(e) {
    if (currentTool !== 'erase') return;
    const [x, y] = canvasCoords(e);
    saveHistory();
    const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
    floodFillErase(id, x, y, tolerance);
    ctx.putImageData(id, 0, 0);
  }

  function onTouchStart(e) {
    e.preventDefault();
    if (currentTool !== 'erase') return;
    const t = e.touches[0];
    const [x, y] = canvasCoordsFromXY(t.clientX, t.clientY);
    saveHistory();
    const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
    floodFillErase(id, x, y, tolerance);
    ctx.putImageData(id, 0, 0);
  }
  function onTouchEnd(e) { e.preventDefault(); }

  function floodFillErase(imageData, startX, startY, tol) {
    const { data, width, height } = imageData;
    if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;

    const si = (startY * width + startX) * 4;
    if (data[si + 3] === 0) return;

    const tR = data[si], tG = data[si + 1], tB = data[si + 2];
    const t = tol * 2.55;

    const visited = new Uint8Array(width * height);
    const stack = [startY * width + startX];

    while (stack.length) {
      const pos = stack.pop();
      if (visited[pos]) continue;
      visited[pos] = 1;
      const pi = pos * 4;
      if (data[pi + 3] === 0) continue;
      if (
        Math.abs(data[pi]     - tR) <= t &&
        Math.abs(data[pi + 1] - tG) <= t &&
        Math.abs(data[pi + 2] - tB) <= t
      ) {
        data[pi + 3] = 0;
        const x = pos % width, y = (pos / width) | 0;
        if (x > 0)         stack.push(pos - 1);
        if (x < width - 1) stack.push(pos + 1);
        if (y > 0)         stack.push(pos - width);
        if (y < height - 1)stack.push(pos + width);
      }
    }
  }

  /* ── Rectangle selection / crop ───────────────────────────────────────── */
  function onMouseDown(e) {
    if (currentTool !== 'select') return;
    const [x, y] = canvasCoords(e);
    selStart = { x, y };
    isSelecting = true;
    selection = null;
    document.getElementById('cropBtn').style.display = 'none';
    selCtx.clearRect(0, 0, selCanvas.width, selCanvas.height);
  }

  function onMouseMove(e) {
    if (!isSelecting || currentTool !== 'select') return;
    const [x, y] = canvasCoords(e);
    selCtx.clearRect(0, 0, selCanvas.width, selCanvas.height);
    selCtx.save();
    selCtx.setLineDash([6, 3]);
    selCtx.strokeStyle = '#c41e3a';
    selCtx.lineWidth = 1.5;
    selCtx.fillStyle = 'rgba(196,30,58,0.06)';
    const rx = selStart.x, ry = selStart.y, rw = x - rx, rh = y - ry;
    selCtx.fillRect(rx, ry, rw, rh);
    selCtx.strokeRect(rx, ry, rw, rh);
    selCtx.restore();
  }

  function onMouseUp(e) {
    if (!isSelecting || currentTool !== 'select') return;
    isSelecting = false;
    const [x, y] = canvasCoords(e);
    selection = {
      x: Math.round(Math.min(selStart.x, x)),
      y: Math.round(Math.min(selStart.y, y)),
      w: Math.round(Math.abs(x - selStart.x)),
      h: Math.round(Math.abs(y - selStart.y)),
    };
    if (selection.w > 5 && selection.h > 5) {
      document.getElementById('cropBtn').style.display = '';
    }
  }

  function cropSelection() {
    if (!selection || selection.w < 1 || selection.h < 1) return;
    saveHistory();
    const id = ctx.getImageData(selection.x, selection.y, selection.w, selection.h);
    canvas.width  = selection.w;
    canvas.height = selection.h;
    selCanvas.width  = selection.w;
    selCanvas.height = selection.h;
    ctx.putImageData(id, 0, 0);
    clearSel();
    setTool('erase');
  }

  /* ── History ──────────────────────────────────────────────────────────── */
  function saveHistory() {
    history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (history.length > 20) history.shift();
    document.getElementById('undoBtn').disabled = false;
  }

  function undo() {
    if (!history.length) return;
    const id = history.pop();
    if (canvas.width !== id.width || canvas.height !== id.height) {
      canvas.width = id.width; canvas.height = id.height;
      selCanvas.width = id.width; selCanvas.height = id.height;
    }
    ctx.putImageData(id, 0, 0);
    document.getElementById('undoBtn').disabled = !history.length;
    clearSel();
  }

  function reset() {
    if (!originalImageData) return;
    history = [];
    canvas.width  = originalImageData.width;
    canvas.height = originalImageData.height;
    selCanvas.width  = originalImageData.width;
    selCanvas.height = originalImageData.height;
    ctx.putImageData(originalImageData, 0, 0);
    clearSel();
    document.getElementById('undoBtn').disabled = true;
  }

  /* ── Helpers ──────────────────────────────────────────────────────────── */
  function canvasCoords(e) {
    const r = canvas.getBoundingClientRect();
    return [
      Math.round((e.clientX - r.left) * (canvas.width  / r.width)),
      Math.round((e.clientY - r.top)  * (canvas.height / r.height)),
    ];
  }
  function canvasCoordsFromXY(cx, cy) {
    const r = canvas.getBoundingClientRect();
    return [
      Math.round((cx - r.left) * (canvas.width  / r.width)),
      Math.round((cy - r.top)  * (canvas.height / r.height)),
    ];
  }
  function clearSel() {
    selection = null; isSelecting = false;
    if (selCtx) selCtx.clearRect(0, 0, selCanvas.width, selCanvas.height);
    const b = document.getElementById('cropBtn');
    if (b) b.style.display = 'none';
  }

  /* ── Public API ───────────────────────────────────────────────────────── */
  window.ImageEditor = { open: openEditor };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
