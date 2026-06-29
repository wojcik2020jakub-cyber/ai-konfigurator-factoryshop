const express = require('express');
const path = require('path');
const router = express.Router();
const { processForPrint } = require('../services/imageProcessor');
const { uploadToFtp } = require('../services/ftp');
const { saveDesign } = require('../services/designsDb');

const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(__dirname, '../../output');

router.post('/', async (req, res) => {
  try {
    const { imageBase64, widthCm, heightCm, prompt, sessionId, productId } = req.body;
    if (!imageBase64 || !widthCm || !heightCm) {
      return res.status(400).json({ error: 'Chybí imageBase64, widthCm nebo heightCm' });
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const w = Number(widthCm);
    const h = Number(heightCm);
    if (w <= 0 || h <= 0 || !Number.isFinite(w) || !Number.isFinite(h)) {
      return res.status(400).json({ error: 'Rozměry musí být kladná čísla' });
    }

    const { filepath, filename, svgFilepath, svgFilename } = await processForPrint(imageBuffer, w, h, OUTPUT_DIR);

    let downloadUrl = null;
    let svgDownloadUrl = null;
    const ftpPdfUrl = await uploadToFtp(filepath, filename);
    if (ftpPdfUrl) {
      downloadUrl = ftpPdfUrl;
    } else {
      downloadUrl = `/api/approve/output/${encodeURIComponent(filename)}`;
    }

    if (svgFilepath && svgFilename) {
      const ftpSvgUrl = await uploadToFtp(svgFilepath, svgFilename);
      if (ftpSvgUrl) {
        svgDownloadUrl = ftpSvgUrl;
      } else {
        svgDownloadUrl = `/api/approve/output/${encodeURIComponent(svgFilename)}`;
      }
    }

    await saveDesign({
      prompt: prompt || '',
      widthCm: w,
      heightCm: h,
      pdfFilename: filename,
      imageUrl: downloadUrl.startsWith('http') ? downloadUrl : null,
      sessionId: sessionId || null,
      productId: productId || null,
    });

    res.json({
      success: true,
      downloadUrl,
      filename,
      svgDownloadUrl: svgDownloadUrl || null,
      svgFilename: svgFilename || null,
      message: downloadUrl.startsWith('http')
        ? 'Tisková data jsou nahrána. Použijte odkaz pro přílohu objednávky.'
        : 'Stáhněte PDF/SVG a nahrajte do objednávky.',
    });
  } catch (err) {
    console.error('Approve error:', err);
    res.status(500).json({
      error: err.message || 'Chyba při zpracování tiskových dat',
    });
  }
});

router.get('/output/:filename', (req, res) => {
  const fs = require('fs');

  // Bezpečnostní sanitizace: zamezit path traversal útokům (../../.env apod.)
  const name = path.basename(req.params.filename);
  if (!/^[\w\-.]+$/.test(name)) {
    return res.status(400).json({ error: 'Neplatný název souboru' });
  }
  const filepath = path.join(OUTPUT_DIR, name);
  const resolved = path.resolve(filepath);
  if (!resolved.startsWith(path.resolve(OUTPUT_DIR) + path.sep)) {
    return res.status(403).json({ error: 'Přístup zakázán' });
  }

  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Soubor nenalezen' });
  const isSvg = name.toLowerCase().endsWith('.svg');
  res.setHeader('Content-Type', isSvg ? 'image/svg+xml' : 'application/pdf');
  res.download(filepath, name);
});

module.exports = router;
