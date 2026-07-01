const express = require('express');
const multer = require('multer');
const router = express.Router();
const { pdfToImages } = require('../services/pdfSplitter');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

router.post('/split', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Žádný soubor nebyl nahrán.' });
    }

    const mime = req.file.mimetype;
    const name = (req.file.originalname || '').toLowerCase();
    if (mime !== 'application/pdf' && !name.endsWith('.pdf')) {
      return res.status(400).json({ error: 'Soubor musí být ve formátu PDF.' });
    }

    const result = await pdfToImages(req.file.buffer);

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, numPages: result.numPages, pages: result.images });
  } catch (err) {
    const msg = err?.message || String(err);
    if (/ENOENT|pdftoppm|pdftops/i.test(msg)) {
      return res.status(500).json({ error: 'PDF převod není dostupný – nainstalujte poppler-utils.' });
    }
    console.error('PDF split error:', err);
    res.status(500).json({ error: 'Chyba při zpracování PDF.' });
  }
});

module.exports = router;
