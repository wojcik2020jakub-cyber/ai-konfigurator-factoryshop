const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const DPI = parseInt(process.env.PRINT_DPI, 10) || 300;
const PNG_COMPRESSION = Math.min(9, Math.max(1, parseInt(process.env.PRINT_PNG_COMPRESSION, 10) || 1));
const UPSCALE_AI_ENABLED = process.env.UPSCALE_AI_ENABLED === 'true' || process.env.UPSCALE_AI_ENABLED === '1';
function cmToPixels(cm, dpi = DPI) {
  return Math.round(cm * (dpi / 2.54));
}

async function aiUpscale(inputBuffer) {
  if (!UPSCALE_AI_ENABLED || !process.env.REPLICATE_API_TOKEN) return null;
  try {
    const pkg = require('replicate');
    const Replicate = pkg.default || pkg;
    if (!Replicate) return null;
    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
    const model = 'nightmareai/real-esrgan:42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b';
    const dataUrl = `data:image/png;base64,${inputBuffer.toString('base64')}`;
    const output = await replicate.run(model, { input: { image: dataUrl, scale: 2 } });
    let urlOrFile = Array.isArray(output) ? output[0] : output;
    if (urlOrFile && typeof urlOrFile.url === 'function') urlOrFile = urlOrFile.url();
    const fetchUrl = typeof urlOrFile === 'string' ? urlOrFile : (urlOrFile?.href || urlOrFile);
    if (fetchUrl) {
      const res = await fetch(fetchUrl);
      const buf = Buffer.from(await res.arrayBuffer());
      return buf.length > 0 ? buf : null;
    }
  } catch (err) {
    console.warn('AI upscale skip:', err?.message || err);
  }
  return null;
}

async function vectorizeViaReplicate(pngBuffer) {
  if (!process.env.REPLICATE_API_TOKEN) return null;
  try {
    const pkg = require('replicate');
    const Replicate = pkg.default || pkg;
    if (!Replicate) return null;
    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
    const model = 'merahburam/vectorizer-v2:710ceb70bc468d7ee6f252a16a7d9b60e9fbe24786965dbc2e808c2de38a5a32';
    const dataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`;
    const output = await replicate.run(model, {
      input: {
        image: dataUrl,
        vectorizer: 'vtracer',
        color_count: 12,
        optimize_svg: true,
      },
    });
    let urlOrFile = Array.isArray(output) ? output[0] : output;
    if (urlOrFile && typeof urlOrFile?.url === 'function') urlOrFile = await urlOrFile.url();
    if (typeof urlOrFile === 'string' && urlOrFile.startsWith('<')) {
      return Buffer.from(urlOrFile, 'utf-8');
    }
    const fetchUrl = typeof urlOrFile === 'string' ? urlOrFile : (urlOrFile?.href || urlOrFile);
    if (fetchUrl) {
      const res = await fetch(fetchUrl);
      const svg = await res.text();
      return Buffer.from(svg, 'utf-8');
    }
  } catch (err) {
    console.warn('AI vectorize skip:', err?.message || err);
  }
  return null;
}

const IMAGETRACER_MAX_DIM = parseInt(process.env.SVG_TRACE_MAX_DIM, 10) || 6000;

async function vectorizeViaImagetracer(pngBuffer) {
  try {
    const ImageTracer = require('imagetracerjs');
    let toTrace = pngBuffer;
    const meta = await sharp(pngBuffer).metadata();
    if (meta.width > IMAGETRACER_MAX_DIM || meta.height > IMAGETRACER_MAX_DIM) {
      const scale = Math.min(IMAGETRACER_MAX_DIM / meta.width, IMAGETRACER_MAX_DIM / meta.height);
      toTrace = await sharp(pngBuffer)
        .resize(Math.round(meta.width * scale), Math.round(meta.height * scale))
        .png()
        .toBuffer();
    }
    const { data, info } = await sharp(toTrace)
      .raw()
      .toBuffer({ resolveWithObject: true });
    const imagedata = {
      width: info.width,
      height: info.height,
      data: new Uint8ClampedArray(data),
    };
    const svgString = ImageTracer.imagedataToSVG(imagedata, {
      colorsampling: 2,
      numberofcolors: 16,
      mincolorratio: 0.02,
      scale: 1,
      roundcoords: 1,
      blurradius: 0,
      blurdelta: 20,
      pathomit: 4,
    });
    return Buffer.from(svgString, 'utf-8');
  } catch (err) {
    console.warn('Imagetracer vectorize skip:', err?.message || err);
    return null;
  }
}

async function vectorizeToSvg(pngBuffer) {
  let svgBuffer = await vectorizeViaReplicate(pngBuffer);
  if (!svgBuffer || svgBuffer.length === 0) {
    svgBuffer = await vectorizeViaImagetracer(pngBuffer);
  }
  return svgBuffer;
}

function addSvgPrintDimensions(svgBuffer, widthCm, heightCm) {
  const svg = svgBuffer.toString('utf-8');
  const widthMm = Math.round(widthCm * 10);
  const heightMm = Math.round(heightCm * 10);
  // CorelDRAW a další DTP programy berou width/height jako fyzický rozměr.
  // Vektorizéry (imagetracer, Replicate) přidávají width="N" height="M" v pixelech.
  // Bez odstranění duplicit by Corel použil pixelové rozměry (cca 96 DPI) → špatná velikost.
  const match = svg.match(/<svg\s+([^>]*)>/);
  if (!match) return Buffer.from(svg, 'utf-8');
  const attrs = match[1];
  let origW = null;
  let origH = null;
  const wPixel = attrs.match(/\bwidth=["']?(\d+)(?!mm|em|pt|px|\d)/i);
  const hPixel = attrs.match(/\bheight=["']?(\d+)(?!mm|em|pt|px|\d)/i);
  if (wPixel) origW = parseInt(wPixel[1], 10);
  if (hPixel) origH = parseInt(hPixel[1], 10);
  let newAttrs = attrs
    .replace(/\bwidth=["'][^"']*["']/gi, '')
    .replace(/\bheight=["'][^"']*["']/gi, '')
    .replace(/\bviewBox=["'][^"']*["']/gi, '');
  newAttrs = newAttrs.replace(/\s{2,}/g, ' ').trim();
  const viewBoxStr = origW != null && origH != null ? ` viewBox="0 0 ${origW} ${origH}"` : '';
  const dims = ` width="${widthMm}mm" height="${heightMm}mm"${viewBoxStr}`;
  const newTag = `<svg${dims}${newAttrs ? ' ' + newAttrs : ''}>`.replace(/\s{2,}/g, ' ');
  const result = svg.replace(/<svg\s+[^>]*>/, newTag);
  return Buffer.from(result, 'utf-8');
}

async function stepUpscale(buffer, targetW, targetH) {
  const { width: w, height: h } = await sharp(buffer).metadata();
  let current = buffer;
  let cw = w;
  let ch = h;
  while (cw < targetW / 2 && ch < targetH / 2) {
    const nw = Math.min(cw * 2, targetW);
    const nh = Math.min(ch * 2, targetH);
    current = await sharp(current).resize(nw, nh, { fit: 'fill', kernel: sharp.kernel.lanczos3 }).toBuffer();
    cw = nw;
    ch = nh;
  }
  return current;
}

async function processForPrint(inputBuffer, widthCm, heightCm, outputDir) {
  const targetWidth = cmToPixels(widthCm, DPI);
  const targetHeight = cmToPixels(heightCm, DPI);
  let toResize = inputBuffer;
  const upscaled = await aiUpscale(inputBuffer);
  if (upscaled && upscaled.length > 0) toResize = upscaled;
  else toResize = await stepUpscale(toResize, targetWidth, targetHeight);

  const processed = await sharp(toResize)
    .resize(targetWidth, targetHeight, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: PNG_COMPRESSION })
    .toBuffer();

  const randomId = require('crypto').randomBytes(4).toString('hex');
  const baseName = `Data z Factoryshop.cz-${randomId}`;
  const filename = `${baseName}.pdf`;
  const filepath = path.join(outputDir, filename);

  fs.mkdirSync(outputDir, { recursive: true });

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
  fs.writeFileSync(filepath, pdfBytes);

  let svgFilepath = null;
  let svgFilename = null;
  const svgBuffer = await vectorizeToSvg(processed);
  if (svgBuffer && svgBuffer.length > 0) {
    svgFilename = `${baseName}.svg`;
    svgFilepath = path.join(outputDir, svgFilename);
    const svgWithDims = addSvgPrintDimensions(svgBuffer, widthCm, heightCm);
    fs.writeFileSync(svgFilepath, svgWithDims);
  }

  return { filepath, filename, svgFilepath, svgFilename };
}

module.exports = { processForPrint, cmToPixels };
