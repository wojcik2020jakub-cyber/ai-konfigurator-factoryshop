/**
 * Generování obrázků – Gemini + Nano Banana 2 (stejně jako ChatGPT/Gemini v prohlížeči).
 * Bez Imagen, pouze generateContent s responseModalities: IMAGE.
 */
const OpenAI = require('openai');
const { GoogleGenAI } = require('@google/genai');
const sharp = require('sharp');

// Nano Banana 2 = Gemini 3.1 Flash Image – výchozí model pro generování obrázků
const DEFAULT_GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image-preview';
const FALLBACK_GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';

function getGeminiImageModel() {
  return (process.env.GEMINI_IMAGE_MODEL || '').trim() || DEFAULT_GEMINI_IMAGE_MODEL;
}

function getFallbackGeminiImageModel() {
  return (process.env.GEMINI_IMAGE_FALLBACK || '').trim() || FALLBACK_GEMINI_IMAGE_MODEL;
}

function hasOpenAIKey() {
  const key = process.env.OPENAI_API_KEY;
  return key && key !== 'sk-your-openai-api-key';
}

function hasGeminiKey() {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  return !!key && key !== 'your-gemini-api-key';
}

function isDemoMode() {
  return !hasOpenAIKey() && !hasGeminiKey();
}

function getOpenAIClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY není nastaven v .env');
  return new OpenAI({ apiKey: key });
}

const GEMINI_BANNER_INSTRUCTION = `Pravidla pro vizuální výstup:
- Vytvoř čistý vizuální návrh banneru. Žádné instrukce, poznámky ani meta-popisky nevkládej do obrázku.
- Všechny texty piš PŘESNĚ jak jsou v zadání (včetně diakritiky: č, ř, ž, ě, á, í, ů).
- Nevykresluj části zadání typu "na levé straně bude...", "umísti...", "použij..." – jen skutečný obsah.
- Bílé pozadí = čistě bílá plocha bez jiných motivů.`;

const GEMINI_REFINEMENT_INSTRUCTION = `DŮLEŽITÉ: Vrať POUZE upravený obrázek. Žádný text, žádný popis.
Zachovej celkový styl a rozložení návrhu. Aplikuj pouze požadovanou úpravu.`;

/** Podporované poměry stran Gemini API – mapované na číselný poměr šířka/výška */
const GEMINI_ASPECT_RATIOS = [
  { ratio: '1:1', value: 1 },
  { ratio: '2:3', value: 2 / 3 },
  { ratio: '3:2', value: 3 / 2 },
  { ratio: '3:4', value: 3 / 4 },
  { ratio: '4:3', value: 4 / 3 },
  { ratio: '9:16', value: 9 / 16 },
  { ratio: '16:9', value: 16 / 9 },
  { ratio: '21:9', value: 21 / 9 },
];

function getClosestAspectRatio(widthCm, heightCm) {
  if (!widthCm || !heightCm || heightCm <= 0) return '1:1';
  const target = widthCm / heightCm;
  let best = GEMINI_ASPECT_RATIOS[0];
  let bestDiff = Math.abs(target - best.value);
  for (const r of GEMINI_ASPECT_RATIOS) {
    const diff = Math.abs(target - r.value);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = r;
    }
  }
  return best.ratio;
}

async function buildGeminiContents(prompt, logoBuffer, previousImageBuffer = null) {
  if (previousImageBuffer && previousImageBuffer.length > 0) {
    const parts = [
      { inlineData: { mimeType: 'image/png', data: previousImageBuffer.toString('base64') } },
    ];
    if (logoBuffer && logoBuffer.length > 0) {
      parts.push({ inlineData: { mimeType: 'image/png', data: logoBuffer.toString('base64') } });
      parts.push({ text: `První obrázek je aktuální návrh, druhý je nové logo. ${GEMINI_REFINEMENT_INSTRUCTION}\n\nÚprava: ${prompt}` });
    } else {
      parts.push({ text: `${GEMINI_REFINEMENT_INSTRUCTION}\n\nToto je aktuální návrh. Aplikuj na něj tuto úpravu a vrať upravený obrázek:\n\n${prompt}` });
    }
    return parts;
  }
  const textPart = { text: `${GEMINI_BANNER_INSTRUCTION}\n\nZadání:\n${prompt}` };
  if (!logoBuffer || logoBuffer.length === 0) {
    return textPart;
  }
  const base64 = logoBuffer.toString('base64');
  return [
    { inlineData: { mimeType: 'image/png', data: base64 } },
    { text: `Toto je logo, které máš zahrnout do návrhu (vlevo nahoře).\n\n${GEMINI_BANNER_INSTRUCTION}\n\nZadání:\n${prompt}` },
  ];
}

async function generateImageWithGeminiModel(prompt, widthCm, heightCm, modelName, logoBuffer = null, previousImageBuffer = null) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY není nastaven v .env');
  const ai = new GoogleGenAI({ apiKey });
  const contents = await buildGeminiContents(prompt, logoBuffer, previousImageBuffer);
  const userContent = Array.isArray(contents) ? { role: 'user', parts: contents } : contents;
  const aspectRatio = getClosestAspectRatio(widthCm, heightCm);
  const response = await ai.models.generateContent({
    model: modelName,
    contents: userContent,
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { aspectRatio },
    },
  });
  const parts = response?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      const buf = Buffer.from(part.inlineData.data, 'base64');
      if (buf?.length > 0) return buf;
    }
  }
  const finishReason = response?.candidates?.[0]?.finishReason;
  const blocked = finishReason && !['STOP', 'MAX_TOKENS'].includes(finishReason);
  const errDetail = blocked ? ` (${finishReason})` : '';
  console.warn('Gemini nevrátil obrázek:', { finishReason, partsCount: parts.length });
  throw new Error(`Gemini nevrátil obrázek${errDetail}. Zkuste jiné zadání nebo znovu vygenerovat.`);
}

async function generateImageWithGemini(prompt, widthCm, heightCm, logoBuffer = null, previousImageBuffer = null) {
  const models = [
    getGeminiImageModel(),
    getFallbackGeminiImageModel(),
  ];
  const uniqueModels = [...new Set(models)];
  let lastErr;
  for (const modelName of uniqueModels) {
    try {
      const result = await generateImageWithGeminiModel(prompt, widthCm, heightCm, modelName, logoBuffer, previousImageBuffer);
      return { buffer: result, skipLogoComposite: !!(logoBuffer || previousImageBuffer) };
    } catch (err) {
      lastErr = err;
      const msg = (err?.message || String(err) || '').toLowerCase();
      const code = err?.status ?? err?.statusCode ?? err?.error?.code ?? err?.response?.status;
      const is404 = code === 404 || msg.includes('not found') || msg.includes('404') || msg.includes('not_found');
      if (is404) continue;
      throw err;
    }
  }
  throw lastErr || new Error('Žádný model pro generování obrázků není dostupný.');
}

async function generateDemoImage(prompt, widthCm, heightCm) {
  const w = Math.round(Math.min(widthCm * 4, 1024));
  const h = Math.round(Math.min(heightCm * 4, 1024));
  const escaped = (prompt || '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
  const svg = `
    <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f0f0f0"/>
      <text x="50%" y="50%" font-family="Arial,sans-serif" font-size="24" fill="#333" text-anchor="middle" dominant-baseline="middle">${escaped.slice(0, 50) || 'Demo'}</text>
    </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function generateImage(prompt, widthCm, heightCm, options = {}) {
  const logoBuffer = options.logoBuffer || null;
  const previousImageBuffer = options.previousImageBuffer || null;
  if (isDemoMode()) {
    const buf = await generateDemoImage(prompt, widthCm, heightCm);
    return { buffer: buf, skipLogoComposite: false };
  }
  if (hasGeminiKey()) {
    return generateImageWithGemini(prompt, widthCm, heightCm, logoBuffer, previousImageBuffer);
  }
  const client = getOpenAIClient();
  const aspectRatio = widthCm / heightCm;
  let size;
  if (aspectRatio > 1.5) size = '1792x1024';
  else if (aspectRatio < 0.67) size = '1024x1792';
  else size = '1024x1024';
  const response = await client.images.generate({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size,
    quality: 'hd',
    response_format: 'b64_json',
  });
  const imageData = response.data[0];
  if (!imageData?.b64_json) throw new Error('AI nevrátil obrázek');
  const buf = Buffer.from(imageData.b64_json, 'base64');
  return { buffer: buf, skipLogoComposite: false };
}

module.exports = {
  generateImage,
  hasOpenAIKey,
  hasGeminiKey,
  isDemoMode,
  getGeminiImageModel,
  getFallbackGeminiImageModel,
  getModelsConfig: () => ({
    primary: getGeminiImageModel(),
    fallback: getFallbackGeminiImageModel(),
  }),
};
