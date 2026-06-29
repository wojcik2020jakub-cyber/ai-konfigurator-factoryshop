#!/usr/bin/env node
/**
 * Skript pro ověření dostupnosti AI modelů (Gemini / Nano Banana 2).
 * Spusťte: node scripts/check-models.js
 * Vyžaduje GEMINI_API_KEY v .env nebo prostředí.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { GoogleGenAI } = require('@google/genai');
const { getGeminiImageModel, getFallbackGeminiImageModel } = require('../server/services/ai');

async function checkGeminiImage(apiKey, modelName) {
  const ai = new GoogleGenAI({ apiKey });
  try {
    const r = await ai.models.generateContent({
      model: modelName,
      contents: 'Simple blue circle',
      config: { responseModalities: ['TEXT', 'IMAGE'] },
    });
    const hasImage = r?.candidates?.[0]?.content?.parts?.some(p => p.inlineData?.data);
    return { ok: !!hasImage, error: hasImage ? null : 'Žádný obrázek v odpovědi' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function main() {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY není nastaven. Nastavte v .env nebo jako proměnnou prostředí.');
    process.exit(1);
  }

  const primary = getGeminiImageModel();
  const fallback = getFallbackGeminiImageModel();

  console.log('Kontrola dostupnosti modelů (Gemini / Nano Banana 2)...\n');
  console.log('Primární model:', primary);
  const r1 = await checkGeminiImage(apiKey, primary);
  console.log(r1.ok ? '  ✓ Dostupné' : `  ✗ Chyba: ${r1.error}\n`);

  if (primary !== fallback) {
    console.log('Záložní model:', fallback);
    const r2 = await checkGeminiImage(apiKey, fallback);
    console.log(r2.ok ? '  ✓ Dostupné' : `  ✗ Chyba: ${r2.error}\n`);
  }

  if (r1.ok) {
    console.log('\n✓ Model funguje. Aplikace by měla generovat obrázky.');
  } else {
    console.log('\n❌ Model není dostupný. Zkontrolujte GEMINI_IMAGE_MODEL v .env');
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
