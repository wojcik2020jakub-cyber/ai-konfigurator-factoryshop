const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const chatRoutes = require('./routes/chat');
const approveRoutes = require('./routes/approve');
const pdfRoutes = require('./routes/pdf');
const bgRemoveRoutes = require('./routes/bgRemove');
const { hasOpenAIKey, hasGeminiKey, isDemoMode, getModelsConfig } = require('./services/ai');

const app = express();
const PORT = process.env.PORT || 3020;
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(__dirname, '../output');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ── Bezpečnostní hlavičky (Helmet) ──────────────────────────────────────────
try {
  const helmet = require('helmet');
  app.use(helmet({
    contentSecurityPolicy: false, // uvolnit kvůli inline stylům a CDN fontům
    frameguard: false,            // umožnit embed do iframe e-shopu
  }));
} catch {
  console.warn('⚠  Helmet není nainstalovaný – spusťte npm install');
}

// ── CORS – povoluje všechny origins (open-source, multi-tenant deployment) ──
app.use(cors());

// ── Rate limiting na AI endpointy ───────────────────────────────────────────
try {
  const { rateLimit } = require('express-rate-limit');
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60 * 1000;
  const maxReq   = parseInt(process.env.RATE_LIMIT_MAX, 10) || 10;
  const limiter = rateLimit({
    windowMs,
    max: maxReq,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Příliš mnoho požadavků, zkuste za chvíli.' },
  });
  app.use('/api/chat/generate', limiter);
  app.use('/api/approve', limiter);
} catch {
  console.warn('⚠  express-rate-limit není nainstalovaný – spusťte npm install');
}

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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use('/api/chat', chatRoutes);
app.use('/api/approve', approveRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/image', bgRemoveRoutes);

app.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Příloha je příliš velká. Max. 20 MB.' });
  }
  next(err);
});

const server = app.listen(PORT, () => {
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

// ── Graceful shutdown ────────────────────────────────────────────────────────
const shutdown = (signal) => {
  console.log(`\n${signal} přijat – ukončuji server...`);
  server.close(() => {
    console.log('Server ukončen.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000); // force exit po 10s
};
process