'use strict';

const express = require('express');
const router  = express.Router();
const { removeBg, isAvailable } = require('../services/bgRemover');

// Zjistíme dostupnost asynchronně při startu serveru
let available = null;
isAvailable().then(v => {
  available = v;
  if (v) {
    console.log('✓ AI odebrání pozadí (rembg) dostupné');
  } else {
    console.warn('⚠  rembg není nainstalovaný – AI odebrání pozadí nedostupné');
    console.warn('   Spusťte aplikaci přes Docker (viz Dockerfile).');
  }
});

/** GET /api/image/status – vrátí zda je AI dostupné */
router.get('/status', (_req, res) => {
  res.json({ available: available === true });
});

/** POST /api/image/remove – přijme base64 PNG, vrátí PNG bez pozadí */
router.post('/remove', express.json({ limit: '50mb' }), async (req, res) => {
  if (!available) {
    return res.status(503).json({
      error: 'AI odebrání pozadí není dostupné. Nainstalujte rembg v Dockeru.',
    });
  }

  const { image } = req.body || {};
  if (!image) {
    return res.status(400).json({ error: 'Chybí parametr image (base64 PNG).' });
  }

  try {
    const result = await removeBg(image);
    res.json({ success: true, result });
  } catch (err) {
    console.error('bgRemove error:', err.message);
    res.status(500).json({ error: 'AI zpracování selhalo: ' + err.message });
  }
});

module.exports = router;
