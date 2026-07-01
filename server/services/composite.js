const sharp = require('sharp');

async function compositeLogo(baseBuffer, overlayDataUrl) {
  const base64 = overlayDataUrl.replace(/^data:image\/\w+;base64,/, '');
  const overlayBuffer = Buffer.from(base64, 'base64');

  const baseMeta = await sharp(baseBuffer).metadata();
  const baseW = baseMeta.width;
  const baseH = baseMeta.height;

  const overlayMeta = await sharp(overlayBuffer).metadata();
  const overlayW = overlayMeta.width;
  const overlayH = overlayMeta.height;

  const safeMargin = Math.min(baseW, baseH) * 0.1;
  const maxLogoW = baseW - safeMargin * 2;
  const maxLogoH = baseH - safeMargin * 2;

  let logoW = overlayW;
  let logoH = overlayH;
  if (logoW > maxLogoW || logoH > maxLogoH) {
    const scale = Math.min(maxLogoW / logoW, maxLogoH / logoH);
    logoW = Math.round(logoW * scale);
    logoH = Math.round(logoH * scale);
  }

  const logoX = Math.round((baseW - logoW) / 2);
  const logoY = Math.round((baseH - logoH) / 2);

  const resizedLogo = await sharp(overlayBuffer)
    .resize(logoW, logoH, { fit: 'contain' })
    .png()
    .toBuffer();

  return sharp(baseBuffer)
    .composite([{
      input: resizedLogo,
      left: logoX,
      top: logoY,
    }])
    .png()
    .toBuffer();
}

module.exports = { compositeLogo };
