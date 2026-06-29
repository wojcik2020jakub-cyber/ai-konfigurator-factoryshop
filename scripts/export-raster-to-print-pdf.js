/**
 * Tisková data z rastrového obrázku: PDF ve fyzickém rozměru při zadaném DPI.
 * Použití:
 *   node scripts/export-raster-to-print-pdf.js <vstup.png|jpg> <šířka_cm> <výška_cm> [výstupní_složka]
 *
 * Volitelné proměnné prostředí: PRINT_DPI (výchozí 300), FIT=contain|fill
 * - contain: zachová poměr stran, doplní okraje černě (vhodné pro bannery na černém podkladu)
 * - fill: vyplní celou plochu (může mírně deformovat)
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');

const DPI = parseInt(process.env.PRINT_DPI, 10) || 300;
const PNG_COMPRESSION = Math.min(9, Math.max(1, parseInt(process.env.PRINT_PNG_COMPRESSION, 10) || 1));
const FIT = (process.env.FIT || 'contain').toLowerCase() === 'fill' ? 'fill' : 'contain';

function cmToPixels(cm) {
  return Math.round(cm * (DPI / 2.54));
}

async function main() {
  const [, , inputPath, wStr, hStr, outDirArg] = process.argv;
  if (!inputPath || !wStr || !hStr) {
    console.error('Použití: node scripts/export-raster-to-print-pdf.js <obrázek> <šířka_cm> <výška_cm> [výstupní_složka]');
    process.exit(1);
  }
  const widthCm = Number(wStr);
  const heightCm = Number(hStr);
  if (!Number.isFinite(widthCm) || !Number.isFinite(heightCm) || widthCm <= 0 || heightCm <= 0) {
    console.error('Neplatné rozměry v cm.');
    process.exit(1);
  }
  const resolved = path.resolve(inputPath);
  if (!fs.existsSync(resolved)) {
    console.error('Soubor neexistuje:', resolved);
    process.exit(1);
  }

  const targetW = cmToPixels(widthCm);
  const targetH = cmToPixels(heightCm);
  const outDir = path.resolve(outDirArg || path.join(__dirname, '..', 'output'));
  fs.mkdirSync(outDir, { recursive: true });

  const base = path.basename(resolved, path.extname(resolved)).replace(/[^\w\-]+/g, '_');
  const outPdf = path.join(outDir, `${base}_${widthCm}x${heightCm}cm_${DPI}dpi.pdf`);
  const outPng = path.join(outDir, `${base}_${widthCm}x${heightCm}cm_${DPI}dpi.png`);

  const resizeOpts =
    FIT === 'fill'
      ? { fit: 'fill', kernel: sharp.kernel.lanczos3 }
      : {
          fit: 'contain',
          kernel: sharp.kernel.lanczos3,
          background: { r: 0, g: 0, b: 0, alpha: 1 },
        };

  const processed = await sharp(resolved)
    .resize(targetW, targetH, resizeOpts)
    .png({ compressionLevel: PNG_COMPRESSION })
    .toBuffer();

  fs.writeFileSync(outPng, processed);

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([widthCm * 28.35, heightCm * 28.35]);
  const image = await pdfDoc.embedPng(processed);
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: page.getWidth(),
    height: page.getHeight(),
  });
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outPdf, pdfBytes);

  console.log('DPI:', DPI, '| pixely:', targetW, '×', targetH, '| fit:', FIT);
  console.log('PDF:', outPdf);
  console.log('PNG:', outPng);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
