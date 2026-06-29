const express = require('express');
const multer = require('multer');
const router = express.Router();
const { generateImage } = require('../services/ai');
const { checkRateLimit, logGeneration } = require('../services/designsDb');
const { compositeLogo } = require('../services/composite');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.post('/generate', upload.single('logo'), async (req, res) => {
  try {
    const body = req.body || {};
    let prompt, widthCm, heightCm, sessionId;
    if (body.meta) {
      try {
        const meta = JSON.parse(body.meta);
        prompt = meta.prompt;
        widthCm = meta.widthCm;
        heightCm = meta.heightCm;
        sessionId = meta.sessionId;
      } catch (e) { /* fallback */ }
    }
    if (!prompt) prompt = body.prompt;
    if (widthCm == null) widthCm = body.widthCm;
    if (heightCm == null) heightCm = body.heightCm;
    if (!sessionId) sessionId = body.sessionId;

    let logoDataUrl = null;
    let logoBuffer = null;
    let previousImageBuffer = null;
    if (req.file?.buffer) {
      logoBuffer = req.file.buffer;
      logoDataUrl = `data:${req.file.mimetype};base64,${logoBuffer.toString('base64')}`;
    } else if (body.referenceImage && !body.previousImage) {
      logoDataUrl = body.referenceImage;
      const base64 = (body.referenceImage || '').replace(/^data:image\/\w+;base64,/, '');
      if (base64) logoBuffer = Buffer.from(base64, 'base64');
    }
    if (body.previousImage) {
      const data = typeof body.previousImage === 'string' ? body.previousImage : '';
      const base64 = data.replace(/^data:image\/\w+;base64,/, '');
      if (base64) previousImageBuffer = Buffer.from(base64, 'base64');
    }

    if (!prompt || widthCm == null || widthCm === '' || heightCm == null || heightCm === '') {
      return res.status(400).json({ error: 'Chybí prompt, widthCm nebo heightCm' });
    }

    const w = Number(widthCm);
    const h = Number(heightCm);
    if (w <= 0 || h <= 0 || !Number.isFinite(w) || !Number.isFinite(h)) {
      return res.status(400).json({ error: 'Rozměry musí být kladná čísla' });
    }

    const rateLimit = await checkRateLimit(sessionId);
    if (rateLimit && !rateLimit.allowed) {
      return res.status(429).json({
        error: `Denní limit ${process.env.MAX_GENERATIONS_PER_DAY || 10} generací vyčerpán. Zkuste to zítra.`,
      });
    }

    let { buffer: imageBuffer, skipLogoComposite } = await generateImage(prompt, w, h, { logoBuffer, previousImageBuffer });

    if (logoDataUrl && !skipLogoComposite) {
      imageBuffer = await compositeLogo(imageBuffer, logoDataUrl);
    }

    const dataUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;

    await logGeneration(sessionId);

    res.json({
      success: true,
      image: dataUrl,
      dimensions: { widthCm: w, heightCm: h },
      remaining: rateLimit?.remaining,
    });
  } catch (err) {
    const raw = err?.message || String(err);
    const status = err?.status ?? err?.statusCode ?? err?.response?.status;
    console.error('Chat generate error:', { message: raw, status, code: err?.code });
    let msg = raw;
    if (status === 401 || /API key|invalid|INVALID|API_KEY_INVALID/i.test(msg)) {
      msg = 'Neplatný API klíč. Vytvořte nový klíč na https://aistudio.google.com/apikey';
    } else if (status === 429 || /quota|rate limit/i.test(msg)) {
      msg = 'Překročen limit požadavků. Zkuste to později.';
    } else if (status === 403 || /permission|not enabled|403/i.test(msg)) {
      msg = 'Klíč nemá oprávnění k Gemini. Vytvořte nový klíč na https://aistudio.google.com/apikey';
    }
    res.status(500).json({ error: msg });
  }
});

module.exports = router;
