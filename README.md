# AI Konfigurátor bannerů – Factoryshop.cz

Aplikace pro generování tiskových dat bannerů pomocí umělé inteligence. Uživatel popíše požadavek v chatu, AI vygeneruje návrh a po schválení vznikne PDF v tiskové kvalitě.

## Požadavky

- Node.js 18+
- OpenAI API klíč (pro DALL-E 3)

## Instalace

```bash
npm install
```

## Konfigurace

1. Zkopírujte `.env.example` na `.env`
2. Nastavte `OPENAI_API_KEY` (z https://platform.openai.com)
3. Nastavte `DATABASE_URL` pro PostgreSQL (historie návrhů + rate limiting)
4. Volitelně: FTP pro upload vygenerovaných souborů

```env
OPENAI_API_KEY=sk-...
PORT=3020
DATABASE_URL=postgresql://postgres:heslo@localhost:5432/factoryshop_konfigurator
MAX_GENERATIONS_PER_DAY=10
OUTPUT_DIR=./output
```

## Spuštění

```bash
npm start
```

Aplikace běží na **http://localhost:3020**

### Demo režim (bez API klíče)

Pokud není nastaven `OPENAI_API_KEY`, aplikace běží v **demo režimu** – generuje placeholder náhledy podle popisu. Můžete otestovat celý flow (chat → náhled → schválení → PDF) bez nákladů na API.

## Integrace do e-shopu (Upgates)

**Iframe na detail produktu:**

```html
<iframe 
  src="https://vaše-doména.cz/embed.html?product=123&maxWidth=150&returnTo=https://www.factoryshop.cz/produkt/banner-xyz" 
  width="100%" 
  height="700" 
  frameborder="0">
</iframe>
```

- `product` – ID produktu (pro budoucí integraci s Upgates API)
- `maxWidth` – max. šířka banneru v cm (např. 150 pro Basic)
- `returnTo` – URL pro návrat po stažení/zkopírování dat (volitelné; jinak se použije `document.referrer`)

## API

### POST /api/chat/generate

Generuje obrázek podle popisu.

```json
{
  "prompt": "Tmavě modrý banner s bílým textem SOUTĚŽ 2025",
  "widthCm": 100,
  "heightCm": 150
}
```

### POST /api/approve

Vytvoří PDF v tiskové kvalitě a vrátí odkaz ke stažení.

```json
{
  "imageBase64": "data:image/png;base64,...",
  "widthCm": 100,
  "heightCm": 150
}
```

## Dokumentace

| Dokument | Popis |
|----------|-------|
| [docs/POSTUP_SPUSTENI.md](docs/POSTUP_SPUSTENI.md) | **Postup spuštění** – instalace, konfigurace, příkazy |
| [docs/TECHNICKA_SPECIFIKACE.md](docs/TECHNICKA_SPECIFIKACE.md) | **Technická specifikace aplikace** – architektura, API, konfigurace, důležitá poznámka k limitům pro produkci |
| [docs/KALKULACE_NAKLADU.md](docs/KALKULACE_NAKLADU.md) | Kalkulace provozních nákladů (Gemini, Replicate) |
| [docs/MODELY_Aktualizace.md](docs/MODELY_Aktualizace.md) | Kontrola a aktualizace AI modelů (Gemini, Imagen) |
| [docs/REPLICATE_API_SETUP.md](docs/REPLICATE_API_SETUP.md) | Nastavení Replicate API pro AI upscaling (Real-ESRGAN) – volitelná služba třetí strany |
| [docs/VEKTORIZACE_SVG.md](docs/VEKTORIZACE_SVG.md) | Vektorizace na SVG (křivky) pro ostřejší text na velkých formátech |

## Databáze (PostgreSQL)

Použijte skripty ve složce `database/`:
- `02_schema.sql` vytvoří tabulky `designs` a `generation_log`

Bez `DATABASE_URL` aplikace funguje, ale neukládá historii a neaplikuje rate limiting.

## Struktura projektu

```
├── server/
│   ├── index.js          # Express server
│   ├── db.js             # Připojení k PostgreSQL
│   ├── routes/
│   │   ├── chat.js       # Generování obrázků
│   │   └── approve.js    # Schválení → PDF
│   └── services/
│       ├── ai.js         # OpenAI DALL-E 3
│       ├── designsDb.js  # Ukládání do DB, rate limiting
│       ├── imageProcessor.js  # Sharp + PDF
│       └── ftp.js        # FTP upload
├── public/
│   ├── index.html        # Hlavní konfigurátor
│   ├── embed.html        # Embed verze
│   ├── styles.css
│   └── app.js
└── output/               # Vygenerovaná PDF (pokud není FTP)
```
