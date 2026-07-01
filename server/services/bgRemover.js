'use strict';

const { execFile } = require('child_process');
const { writeFile, readFile, unlink } = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const WORKER = path.join(__dirname, '../rembg_worker.py');
let _available = null;

/** Ověří dostupnost rembg – výsledek se cachuje. */
function checkAvailable () {
  return new Promise(resolve => {
    execFile('python3', ['-c', 'import rembg, PIL; print("ok")'],
      { timeout: 15_000 },
      err => resolve(!err));
  });
}

async function isAvailable () {
  if (_available === null) _available = await checkAvailable();
  return _available;
}

/**
 * Odebere pozadí z obrázku pomocí rembg / isnet-general-use.
 * @param {string} base64Data – base64 PNG (s nebo bez data-URL prefixu)
 * @returns {Promise<string>} base64 PNG s průhledným pozadím
 */
async function removeBg (base64Data) {
  const id   = crypto.randomBytes(8).toString('hex');
  const tmpIn  = path.join(os.tmpdir(), `rmbg-in-${id}.png`);
  const tmpOut = path.join(os.tmpdir(), `rmbg-out-${id}.png`);

  const b64 = base64Data.replace(/^data:[^;]+;base64,/, '');
  await writeFile(tmpIn, Buffer.from(b64, 'base64'));

  try {
    await new Promise((resolve, reject) => {
      execFile(
        'python3', [WORKER, tmpIn, tmpOut],
        { timeout: 120_000, env: { ...process.env } },
        (err, _stdout, stderr) => {
          if (err) reject(new Error((stderr || err.message).slice(0, 500)));
          else resolve();
        }
      );
    });

    const buf = await readFile(tmpOut);
    return buf.toString('base64');
  } finally {
    await Promise.allSettled([
      unlink(tmpIn).catch(() => {}),
      unlink(tmpOut).catch(() => {}),
    ]);
  }
}

module.exports = { removeBg, isAvailable };
