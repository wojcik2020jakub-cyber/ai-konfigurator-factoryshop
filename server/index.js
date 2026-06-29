const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const chatRoutes = require('./routes/chat');
const approveRoutes = require('./routes/approve');
const { hasOpenAIKey, hasGeminiKey, isDemoMode, getModelsConfig } = require('./services/ai');

const app = express();
const PORT = process.env.PORT || 3020;
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(__dirname, '../output');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

app.use(cors());

app.use('/api', (req, res, next) => {
  res.charset = 'utf-8';
  next();
});

app.get('/api/health', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  const aiProvider = hasOpenAIKey() ? 'openai' : hasGeminiKey() ? 'gemini' : 'demo';
  res.json({
    status: 'ok',
    service: 'ai-konfigurator',
    aiProvider,
    geminiConfigured: hasGeminiKey(),
    openaiConfigured: hasOpenAIKey(),
    models: getModelsConfig(),
    v: 2,
  });
});

app.use(express.static(path.join(__dirname, '../public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('.htm')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    } else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    }
  },
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/api/chat', chatRoutes);
app.use('/api/approve', approveRoutes);

app.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Příloha je příliš velká. Max. 20 MB.' });
  }
  next(err);
});

app.listen(PORT, () => {
  console.log(`AI Konfigurátor běží na http://localhost:${PORT}`);
  console.log(`Output PDF: ${OUTPUT_DIR}`);
  if (hasOpenAIKey()) {
    console.log('✓ Generování přes OpenAI DALL-E 3');
  } else if (hasGeminiKey()) {
    console.log('✓ Generování přes Google Gemini 2.0 Flash (image)');
  } else {
    console.log('⚠️  Demo režim – nastavte GEMINI_API_KEY nebo OPENAI_API_KEY v .env pro skutečné generování');
    console.log('   Gemini API klíč: https://aistudio.google.com/apikey');
  }
});
