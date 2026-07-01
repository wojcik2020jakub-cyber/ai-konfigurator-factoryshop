const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const execFileAsync = promisify(execFile);

/**
 * Převede PDF buffer na pole PNG dataUrl (jedna za stránku).
 * Vyžaduje poppler-utils (pdftoppm) nainstalovaný v systému.
 */
async function pdfToImages(pdfBuffer, options = {}) {
  const { dpi = 150, maxPages = parseInt(process.env.PDF_SPLIT_MAX_PAGES, 10) || 20 } = options;

  const tmpId = crypto.randomBytes(4).toString('hex');
  const tmpDir = path.join(os.tmpdir(), `pdfsp-${tmpId}`);
  const pdfPath = path.join(tmpDir, 'input.pdf');
  const outputPrefix = path.join(tmpDir, 'page');

  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    fs.writeFileSync(pdfPath, pdfBuffer);

    // Zjisti počet stran pomocí pdfinfo
    let totalPages = 0;
    try {
      const { stdout } = await execFileAsync('pdfinfo', [pdfPath], { timeout: 10000 });
      const match = stdout.match(/Pages:\s+(\d+)/i);
      if (match) totalPages = parseInt(match[1], 10);
    } catch {
      // pdfinfo není k dispozici, pokračujeme bez kontroly
    }

    if (totalPages > maxPages) {
      return { error: `PDF má ${totalPages} stran, maximum je ${maxPages}.` };
    }

    // Převeď stránky na PNG pomocí pdftoppm
    await execFileAsync('pdftoppm', [
      '-png',
      '-r', String(dpi),
      '-l', String(maxPages),
      pdfPath,
      outputPrefix,
    ], { timeout: 60000 });

    const files = fs.readdirSync(tmpDir)
      .filter(f => f.startsWith('page') && f.endsWith('.png'))
      .sort();

    const images = files.map((file, index) => {
      const buffer = fs.readFileSync(path.join(tmpDir, file));
      return {
        page: index + 1,
        dataUrl: `data:image/png;base64,${buffer.toString('base64')}`,
      };
    });

    return { numPages: images.length, images };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

module.exports = { pdfToImages };
