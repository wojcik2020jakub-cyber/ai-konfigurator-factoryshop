/**
 * Programatické skládání banneru – přesné vykreslení textu bez chyb AI modelů.
 * Text se renderuje přes SVG, zachovává diakritiku a správný layout.
 */
const sharp = require('sharp');
const QRCode = require('qrcode');

const FONT_FAMILY = 'Arial, Helvetica, sans-serif';

function escapeXml(s) {
  if (s == null || s === '') return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function generateQrBuffer(url, size = 120) {
  const opts = { width: size, margin: 1, color: { dark: '#000000', light: '#ffffff' } };
  const dataUrl = await QRCode.toDataURL(url, opts);
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64, 'base64');
}

/**
 * Skládá banner ze strukturovaných dat.
 * @param {Object} data - { slogan?, products?: string[], phone?, email?, website?, backgroundColor?, ctaAsButtons?: boolean }
 * @param {number} widthPx - šířka v px
 * @param {number} heightPx - výška v px
 * @param {Buffer|null} logoBuffer - volitelné logo
 * @returns {Promise<Buffer>} PNG buffer
 */
async function composeBanner(data, widthPx, heightPx, logoBuffer = null) {
  const bg = data.backgroundColor || '#ffffff';
  const margin = Math.min(widthPx, heightPx) * 0.05;
  const fontSize = Math.min(widthPx, heightPx) / 25;
  const smallSize = fontSize * 0.6;

  const elements = [];

  let logoW = 0;
  let logoH = 0;
  let logoX = margin;
  let logoY = margin;
  const leftColW = widthPx * 0.35;

  if (logoBuffer && logoBuffer.length > 0) {
    const meta = await sharp(logoBuffer).metadata();
    const maxL = Math.min(leftColW - margin * 2, heightPx * 0.15);
    const scale = Math.min(1, maxL / Math.max(meta.width || 1, meta.height || 1));
    logoW = Math.round((meta.width || 100) * scale);
    logoH = Math.round((meta.height || 100) * scale);
  }

  const contentX = leftColW + margin;
  const contentW = widthPx - contentX - margin;
  const centerX = widthPx / 2;
  let y = margin + (logoH || 0) + margin;

  if (data.slogan) {
    elements.push(
      `<text x="${centerX}" y="${y + fontSize}" font-family="${FONT_FAMILY}" font-size="${fontSize}" font-weight="bold" fill="#1a1a1a" text-anchor="middle">${escapeXml(data.slogan)}</text>`
    );
    y += fontSize * 1.8;
  }

  if (data.products && data.products.length > 0) {
    const btnH = Math.min(fontSize * 1.2, 32);
    const btnGap = 8;
    const asButtons = data.ctaAsButtons !== false;
    const count = data.products.length;
    const cols = count <= 3 ? count : 3;
    const rows = Math.ceil(count / cols);
    const btnW = (contentW - (cols - 1) * btnGap) / cols;

    if (asButtons) {
      data.products.forEach((name, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const bx = contentX + col * (btnW + btnGap);
        const by = y + row * (btnH + btnGap);
        elements.push(
          `<rect x="${bx}" y="${by}" width="${btnW}" height="${btnH}" rx="6" fill="#1a1a1a"/>`,
          `<text x="${bx + btnW / 2}" y="${by + btnH * 0.72}" font-family="${FONT_FAMILY}" font-size="${Math.min(smallSize, btnH * 0.4)}" font-weight="600" fill="#ffffff" text-anchor="middle">${escapeXml(name)}</text>`
        );
      });
      y += rows * (btnH + btnGap) + margin;
    } else {
      data.products.forEach((name) => {
        elements.push(
          `<text x="${contentX}" y="${y + smallSize}" font-family="${FONT_FAMILY}" font-size="${smallSize}" fill="#333">${escapeXml(name)}</text>`
        );
        y += smallSize + btnGap;
      });
      y += margin;
    }
  }

  const contactParts = [];
  if (data.phone) contactParts.push(`Tel. ${data.phone}`);
  if (data.email) contactParts.push(data.email);
  if (data.website) contactParts.push(data.website);

  if (contactParts.length > 0) {
    const contactY = y;
    contactParts.forEach((line, i) => {
      elements.push(
        `<text x="${contentX}" y="${contactY + (i + 1) * smallSize * 1.3}" font-family="${FONT_FAMILY}" font-size="${smallSize}" fill="#333">${escapeXml(line)}</text>`
      );
    });
    y += contactParts.length * smallSize * 1.3 + margin;
  }

  let qrBuffer = null;
  if (data.website || data.qrUrl) {
    let qrUrl = data.qrUrl || data.website || '';
    if (!qrUrl.startsWith('http')) qrUrl = 'https://' + qrUrl.replace(/^\/+/, '');
    if (qrUrl.startsWith('http')) {
      const qrSize = Math.min(100, heightPx * 0.2);
      qrBuffer = await generateQrBuffer(qrUrl, qrSize);
    }
  }

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="0 0 ${widthPx} ${heightPx}">
  <rect width="100%" height="100%" fill="${escapeXml(bg)}"/>
  <g id="content">${elements.join('\n  ')}</g>
</svg>`;

  const composites = [];
  if (logoBuffer && logoBuffer.length > 0) {
    const resizedLogo = await sharp(logoBuffer)
      .resize(logoW, logoH, { fit: 'contain' })
      .png()
      .toBuffer();
    composites.push({ input: resizedLogo, left: logoX, top: logoY });
  }
  if (qrBuffer) {
    const qrSize = Math.min(100, heightPx * 0.2);
    const resizedQr = await sharp(qrBuffer).resize(qrSize, qrSize).png().toBuffer();
    composites.push({
      input: resizedQr,
      left: widthPx - margin - qrSize,
      top: heightPx - margin - qrSize,
    });
  }

  let result = await sharp(Buffer.from(svg)).png().toBuffer();
  if (composites.length > 0) {
    result = await sharp(result).composite(composites).png().toBuffer();
  }

  return result;
}

module.exports = { composeBanner };
