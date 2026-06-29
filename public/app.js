const API_BASE = window.location.origin;
const DEFAULT_SHOP_URL = 'https://www.factoryshop.cz';

const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const widthInput = document.getElementById('widthInput');
const heightInput = document.getElementById('heightInput');
const previewArea = document.getElementById('previewArea');
const previewPlaceholder = document.getElementById('previewPlaceholder');
const previewImage = document.getElementById('previewImage');
const approveBtn = document.getElementById('approveBtn');
const downloadResult = document.getElementById('downloadResult');
const downloadLink = document.getElementById('downloadLink');
const downloadLinkSvg = document.getElementById('downloadLinkSvg');
const downloadResultSvg = document.getElementById('downloadResultSvg');
const fileInput = document.getElementById('fileInput');
const generationModal = document.getElementById('generationModal');
const returnModal = document.getElementById('returnModal');
const returnModalTitle = document.getElementById('returnModalTitle');
const returnModalYes = document.getElementById('returnModalYes');
const returnModalNo = document.getElementById('returnModalNo');
const newBannerBtn = document.getElementById('newBannerBtn');

let returnToShopUrl = null;
function getReturnToShopUrl() {
  if (returnToShopUrl !== null) return returnToShopUrl;
  const params = new URLSearchParams(location.search);
  const fromParam = params.get('returnTo') || params.get('return_to') || params.get('from');
  if (fromParam) {
    try {
      const url = new URL(fromParam, location.origin);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        returnToShopUrl = url.href;
        return returnToShopUrl;
      }
    } catch {}
  }
  if (document.referrer && document.referrer.length > 0) {
    try {
      new URL(document.referrer);
      returnToShopUrl = document.referrer;
      return returnToShopUrl;
    } catch {}
  }
  returnToShopUrl = DEFAULT_SHOP_URL;
  return returnToShopUrl;
}

const DEFAULT_WELCOME = `Ahoj! Jsem tu, abych ti pomohl navrhnout produkt pro tisk. Popiš mi, jak má vypadat – barvy, text, obrázky. Rozměry zvolíš výše. Výstup bude v tiskové kvalitě (PDF).`;

let initialWelcomeHtml = '';
function getInitialWelcomeHtml() {
  if (initialWelcomeHtml) return initialWelcomeHtml;
  const existing = document.querySelector('.msg-ai .msg-content');
  initialWelcomeHtml = existing
    ? `<div class="msg-avatar">AI</div><div class="msg-content">${existing.innerHTML}</div>`
    : `<div class="msg-avatar">AI</div><div class="msg-content">${DEFAULT_WELCOME}</div>`;
  return initialWelcomeHtml;
}

let currentImageDataUrl = null;

function setGenerationModalContent(title, status, hint) {
  const titleEl = generationModal?.querySelector('.generation-modal-title');
  const statusEl = generationModal?.querySelector('.generation-modal-status');
  const hintEl = generationModal?.querySelector('.generation-modal-hint');
  if (titleEl) titleEl.textContent = title;
  if (statusEl) statusEl.textContent = status;
  if (hintEl) {
    hintEl.textContent = hint || '';
    hintEl.style.display = hint ? 'block' : 'none';
  }
}

function showGenerationModal(title, status, hint) {
  if (!generationModal) return;
  setGenerationModalContent(title || 'Připravuji váš návrh', status || 'Pracuji na náhledu…', hint);
  generationModal.classList.add('is-visible');
  generationModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function hideGenerationModal() {
  if (!generationModal) return;
  generationModal.classList.remove('is-visible');
  generationModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function showReturnModal(message) {
  if (!returnModal || !returnModalTitle) return;
  returnModalTitle.textContent = message;
  returnModal.classList.add('is-visible');
  returnModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function hideReturnModal() {
  if (!returnModal) return;
  returnModal.classList.remove('is-visible');
  returnModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}
let currentImageBase64 = null;
let currentPrompt = null;
let attachedFile = null;

function dataUrlToBlob(dataUrl) {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
  const binary = atob(parts[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function getSessionId() {
  let id = localStorage.getItem('konfigurator_session');
  if (!id) {
    id = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
    localStorage.setItem('konfigurator_session', id);
  }
  return id;
}

function updatePreviewAspectRatio() {
  const w = Math.max(1, parseInt(widthInput.value) || 100);
  const h = Math.max(1, parseInt(heightInput.value) || 150);
  previewArea.style.aspectRatio = `${w} / ${h}`;
}

function addMessage(role, content, imageDataUrl = null, isHtml = false) {
  const msg = document.createElement('div');
  msg.className = `msg msg-${role}`;
  msg.dataset.role = role;
  const avatar = role === 'user' ? 'Vy' : 'AI';
  let imgHtml = '';
  if (imageDataUrl) imgHtml = `<img class="msg-image" src="${imageDataUrl}" alt="Návrh">`;
  msg.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div class="msg-content">${isHtml ? content : escapeHtml(content)}${imgHtml}</div>
  `;
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function setLoading(loading) {
  sendBtn.disabled = loading;
  chatInput.disabled = loading;
  sendBtn.textContent = loading ? 'Generuji...' : 'Odeslat';
}

function resetToNewBanner() {
  currentImageDataUrl = null;
  currentImageBase64 = null;
  currentPrompt = null;
  attachedFile = null;
  chatInput.value = '';
  document.getElementById('chatAttachment').innerHTML = '';
  if (fileInput) fileInput.value = '';
  previewPlaceholder.style.display = '';
  previewImage.style.display = 'none';
  previewImage.src = '';
  approveBtn.disabled = true;
  downloadResult.style.display = 'none';
  safeZoneOverlay?.classList.remove('is-visible');
  if (safeZoneBtn) safeZoneBtn.textContent = 'Zobrazit bezpečnou zónu';
  chatMessages.innerHTML = '';
  const welcomeMsg = document.createElement('div');
  welcomeMsg.className = 'msg msg-ai';
  welcomeMsg.dataset.role = 'ai';
  welcomeMsg.innerHTML = getInitialWelcomeHtml();
  chatMessages.appendChild(welcomeMsg);
  setLoading(false);
}

const MAX_ATTACHMENT_DIMENSION = 800;
const ATTACHMENT_JPEG_QUALITY = 0.75;

function resizeImageFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width;
      let h = img.height;
      const scale = Math.min(1, MAX_ATTACHMENT_DIMENSION / Math.max(w, h));
      w = Math.round(w * scale);
      h = Math.round(h * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const usePng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
      canvas.toBlob(
        (blob) => {
          if (blob.size > 2 * 1024 * 1024) {
            canvas.toBlob(
              (smallBlob) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(new Error('Chyba při zpracování obrázku'));
                reader.readAsDataURL(smallBlob);
              },
              'image/jpeg',
              0.6
            );
            return;
          }
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('Chyba při zpracování obrázku'));
          reader.readAsDataURL(blob);
        },
        usePng ? 'image/png' : 'image/jpeg',
        usePng ? 0.85 : ATTACHMENT_JPEG_QUALITY
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Nepodařilo se načíst obrázek'));
    };
    img.src = url;
  });
}

function showAttachmentPreview(dataUrl, fileName) {
  const container = document.getElementById('chatAttachment');
  container.innerHTML = `
    <div class="chat-attachment-preview">
      <img src="${dataUrl}" alt="Příloha">
      <span>${escapeHtml(fileName)}</span>
      <span class="chat-attachment-remove" id="removeAttachment">×</span>
    </div>
  `;
  document.getElementById('removeAttachment').onclick = () => {
    attachedFile = null;
    container.innerHTML = '';
    fileInput.value = '';
  };
}

async function sendMessage() {
  const prompt = chatInput.value.trim();
  if (!prompt) return;

  const w = parseInt(widthInput.value) || 100;
  const h = parseInt(heightInput.value) || 150;

  let userContent = escapeHtml(prompt);
  if (attachedFile) {
    userContent += `<img class="msg-image" src="${attachedFile.dataUrl}" alt="Příloha" style="max-height:80px">`;
  }

  addMessage('user', userContent, null, true);
  const prevAttachment = attachedFile;
  chatInput.value = '';
  attachedFile = null;
  document.getElementById('chatAttachment').innerHTML = '';
  fileInput.value = '';
  setLoading(true);
  showGenerationModal();

  addMessage('ai', 'Generuji návrh podle tvého popisu...', null);
  const aiMsg = chatMessages.lastElementChild;

  const isRefinement = !!currentImageDataUrl;
  const payload = { prompt, widthCm: w, heightCm: h, sessionId: getSessionId() };
  if (isRefinement) payload.previousImage = currentImageDataUrl;

  try {
    let res;
    if (prevAttachment) {
      const fd = new FormData();
      fd.append('prompt', prompt);
      fd.append('widthCm', String(w));
      fd.append('heightCm', String(h));
      fd.append('sessionId', getSessionId());
      fd.append('meta', JSON.stringify(payload));
      if (isRefinement) fd.append('previousImage', currentImageDataUrl);
      const blob = dataUrlToBlob(prevAttachment.dataUrl);
      const ext = prevAttachment.dataUrl.startsWith('data:image/png') ? 'png' : 'jpg';
      fd.append('logo', blob, `logo.${ext}`);
      res = await fetch(`${API_BASE}/api/chat/generate`, { method: 'POST', body: fd });
    } else {
      res = await fetch(`${API_BASE}/api/chat/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
      });
    }
    const text = await res.text();
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(res.status === 413
        ? 'Příloha je příliš velká. Zkuste menší obrázek.'
        : 'Server vrátil neočekávanou odpověď. Zkontrolujte, zda server běží na ' + API_BASE);
    }
    let data;
    try { data = JSON.parse(text); } catch {
      throw new Error('Neplatná odpověď serveru.');
    }
    if (!res.ok) throw new Error(data.error || 'Chyba při generování');

    const dataUrl = data.image;
    currentImageDataUrl = dataUrl;
    currentImageBase64 = dataUrl.split(',')[1];
    currentPrompt = prompt;
    updatePreviewImage(dataUrl);

    aiMsg.querySelector('.msg-content').innerHTML =
      'Tady je tvůj návrh. Zkontroluj rozměry výše a pokud ti vyhovuje, klikni na „Schválit a získat tisková data“.';
    aiMsg.querySelector('.msg-content').insertAdjacentHTML('beforeend', `<img class="msg-image" src="${dataUrl}" alt="Návrh">`);
    aiMsg.dataset.prompt = prompt;
    aiMsg.querySelector('.msg-content').insertAdjacentHTML('beforeend',
      '<button class="btn btn-regenerate">Znovu vygenerovat</button>');

    approveBtn.disabled = false;
    downloadResult.style.display = 'none';
  } catch (err) {
    aiMsg.querySelector('.msg-content').textContent = 'Omlouvám se, generování selhalo: ' + err.message;
    aiMsg.querySelector('.msg-content').classList.add('error-msg');
  } finally {
    hideGenerationModal();
    setLoading(false);
  }
}

function updatePreviewImage(dataUrl) {
  previewPlaceholder.style.display = 'none';
  previewImage.src = dataUrl;
  previewImage.style.display = 'block';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function approveAndGetPrintData() {
  if (!currentImageBase64) return;
  approveBtn.disabled = true;

  const w = parseInt(widthInput.value) || 100;
  const h = parseInt(heightInput.value) || 150;

  showGenerationModal(
    'Připravuji tisková data',
    'Generuji PDF a SVG (křivky)… může to trvat až minutu.',
    'U mobilních zařízení doporučujeme pouze zkopírovat odkaz a vložit ho do poznámky objednávky – ušetříte data. Přímé stažení nedoporučujeme při slabém Wi‑Fi nebo mobilním internetu kvůli velikosti souborů.'
  );

  try {
    const res = await fetch(`${API_BASE}/api/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        imageBase64: currentImageDataUrl,
        widthCm: w,
        heightCm: h,
        prompt: currentPrompt,
        sessionId: getSessionId(),
      }),
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch {
      throw new Error(res.status === 413 ? 'Obrázek je příliš velký.' : 'Server neodpovídá správně.');
    }
    if (!res.ok) throw new Error(data.error || 'Chyba při zpracování');

    downloadResult.style.display = 'block';
    const pdfUrl = data.downloadUrl.startsWith('http')
      ? data.downloadUrl
      : `${API_BASE}${data.downloadUrl}`;
    downloadLink.href = pdfUrl;
    downloadLink.download = data.filename;
    downloadResult.dataset.printDataPdfUrl = pdfUrl;

    if (downloadResultSvg && data.svgDownloadUrl && data.svgFilename) {
      downloadResultSvg.style.display = '';
      const svgUrl = data.svgDownloadUrl.startsWith('http')
        ? data.svgDownloadUrl
        : `${API_BASE}${data.svgDownloadUrl}`;
      if (downloadLinkSvg) {
        downloadLinkSvg.href = svgUrl;
        downloadLinkSvg.download = data.svgFilename;
      }
      downloadResult.dataset.printDataSvgUrl = svgUrl;
    } else if (downloadResultSvg) {
      downloadResultSvg.style.display = 'none';
      delete downloadResult.dataset.printDataSvgUrl;
    }
  } catch (err) {
    alert('Chyba: ' + err.message);
  } finally {
    hideGenerationModal();
  }
  approveBtn.disabled = false;
}

widthInput.addEventListener('input', updatePreviewAspectRatio);
widthInput.addEventListener('change', updatePreviewAspectRatio);
heightInput.addEventListener('input', updatePreviewAspectRatio);
heightInput.addEventListener('change', updatePreviewAspectRatio);

sendBtn.addEventListener('click', sendMessage);
if (newBannerBtn) newBannerBtn.addEventListener('click', resetToNewBanner);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

approveBtn.addEventListener('click', approveAndGetPrintData);

if (downloadResult) {
  downloadResult.addEventListener('click', async (e) => {
  const copyBtn = e.target.closest('.btn-copy');
  if (!copyBtn) return;
  const type = copyBtn.dataset.type;
  const url = type === 'svg'
    ? downloadResult?.dataset?.printDataSvgUrl
    : downloadResult?.dataset?.printDataPdfUrl;
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    const origText = copyBtn.textContent;
    copyBtn.textContent = 'Odkaz zkopírován!';
    copyBtn.classList.add('copy-success');
    setTimeout(() => {
      copyBtn.textContent = origText;
      copyBtn.classList.remove('copy-success');
    }, 2000);
    showReturnModal('URL adresu máte zkopírovanou.');
  } catch {
    prompt('Zkopírujte odkaz:', url);
    showReturnModal('URL adresu máte zkopírovanou.');
  }
  });
}

[downloadLink, downloadLinkSvg].filter(Boolean).forEach((link) => {
  link.addEventListener('click', () => {
    showReturnModal('Data máte stažená.');
  });
});

if (returnModalYes) {
  returnModalYes.addEventListener('click', () => {
    hideReturnModal();
    const targetUrl = getReturnToShopUrl();
    try {
      if (window.top && window.top !== window) {
        window.top.location.href = targetUrl;
      } else {
        window.location.href = targetUrl;
      }
    } catch {
      window.location.href = targetUrl;
    }
  });
}

if (returnModalNo) {
  returnModalNo.addEventListener('click', () => {
    hideReturnModal();
  });
}

chatMessages.addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-regenerate');
  if (!btn) return;
  const aiMsg = btn.closest('.msg-ai');
  const prompt = aiMsg?.dataset.prompt;
  if (!prompt) return;

  btn.disabled = true;
  btn.textContent = 'Generuji...';
  const contentEl = aiMsg.querySelector('.msg-content');
  const imgEl = contentEl?.querySelector('.msg-image');
  if (imgEl) imgEl.style.opacity = '0.5';
  showGenerationModal();

  const w = parseInt(widthInput.value) || 100;
  const h = parseInt(heightInput.value) || 150;
  const payload = { prompt, widthCm: w, heightCm: h, sessionId: getSessionId() };
  if (currentImageDataUrl) payload.previousImage = currentImageDataUrl;

  try {
    const res = await fetch(`${API_BASE}/api/chat/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch {
      throw new Error('Server neodpovídá správně. Zkontrolujte, zda běží.');
    }
    if (!res.ok) throw new Error(data.error || 'Chyba při generování');

    const dataUrl = data.image;
    currentImageDataUrl = dataUrl;
    currentImageBase64 = dataUrl.split(',')[1];
    currentPrompt = prompt;
    updatePreviewImage(dataUrl);

    if (imgEl) imgEl.src = dataUrl;
    if (imgEl) imgEl.style.opacity = '1';
  } catch (err) {
    alert('Chyba: ' + err.message);
  } finally {
    hideGenerationModal();
  }
  btn.disabled = false;
  btn.textContent = 'Znovu vygenerovat';
});

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file || !file.type.startsWith('image/')) return;
  try {
    const dataUrl = await resizeImageFile(file);
    attachedFile = { dataUrl, fileName: file.name };
    showAttachmentPreview(dataUrl, file.name);
  } catch (err) {
    alert('Chyba při zpracování obrázku: ' + err.message);
    fileInput.value = '';
  }
});

const safeZoneBtn = document.getElementById('safeZoneBtn');
const safeZoneOverlay = document.getElementById('safeZoneOverlay');
const safeZoneFrame = document.getElementById('safeZoneFrame');
const SAFE_ZONE_CM = 5;

function updateSafeZoneOverlay() {
  if (!safeZoneOverlay || !safeZoneFrame) return;
  const w = Math.max(10, parseInt(widthInput.value) || 100);
  const h = Math.max(10, parseInt(heightInput.value) || 150);
  const leftPct = (SAFE_ZONE_CM / w) * 100;
  const topPct = (SAFE_ZONE_CM / h) * 100;
  const widthPct = Math.max(10, ((w - SAFE_ZONE_CM * 2) / w) * 100);
  const heightPct = Math.max(10, ((h - SAFE_ZONE_CM * 2) / h) * 100);
  safeZoneFrame.style.left = leftPct + '%';
  safeZoneFrame.style.top = topPct + '%';
  safeZoneFrame.style.width = widthPct + '%';
  safeZoneFrame.style.height = heightPct + '%';
}

function toggleSafeZone() {
  if (!safeZoneOverlay || !safeZoneBtn) return;
  const isVisible = safeZoneOverlay.classList.toggle('is-visible');
  safeZoneOverlay.setAttribute('aria-hidden', String(!isVisible));
  if (isVisible) {
    updateSafeZoneOverlay();
    safeZoneBtn.textContent = 'Skrýt bezpečnou zónu';
  } else {
    safeZoneBtn.textContent = 'Zobrazit bezpečnou zónu';
  }
}

if (safeZoneBtn) safeZoneBtn.addEventListener('click', toggleSafeZone);
widthInput?.addEventListener('input', () => { if (safeZoneOverlay?.classList.contains('is-visible')) updateSafeZoneOverlay(); });
heightInput?.addEventListener('input', () => { if (safeZoneOverlay?.classList.contains('is-visible')) updateSafeZoneOverlay(); });

updatePreviewAspectRatio();
getInitialWelcomeHtml(); // cache welcome message for "Nový banner" reset
