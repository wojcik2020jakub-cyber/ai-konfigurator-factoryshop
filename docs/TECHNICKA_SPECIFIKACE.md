# Technická specifikace – AI Konfigurátor bannerů

Dokumentace aplikace pro generování tiskových dat bannerů pomocí umělé inteligence (Factoryshop.cz).

---

## 1. Přehled aplikace

| Položka | Hodnota |
|---------|---------|
| **Název** | AI Konfigurátor bannerů |
| **Účel** | Generování návrhů bannerů pomocí AI a export do PDF v tiskové kvalitě |
| **Cílová platforma** | Web (standalone + embed do e-shopu Upgates) |
| **Verze** | 1.0.0 |

### Hlavní funkce

- Konverzační rozhraní pro popis banneru (chat)
- Generování obrázků pomocí **Gemini** (Nano Banana 2 / Gemini 3.1 Flash Image) nebo **OpenAI DALL-E 3**
- Kumulativní úpravy návrhu (refinamenty s předchozím obrázkem)
- Volitelný AI upscaling (Real-ESRGAN přes Replicate) před exportem
- Export do PDF v tiskové kvalitě (300 DPI, 1:1, bezpečná zóna 5 cm)
- Ukládání historie návrhů do PostgreSQL
- FTP upload vygenerovaných souborů (volitelně)
- Demo režim bez API klíčů pro testování

---

## 2. Architektura

```
┌─────────────────────────────────────────────────────────────────────┐
│  KLIENT (Browser)                                                    │
│  ┌─────────────────┐  ┌─────────────────┐                            │
│  │  index.html     │  │  embed.html     │  – Embed do iframe          │
│  │  app.js         │  │  (bez headeru)   │                            │
│  │  styles.css     │  └─────────────────┘                            │
│  └─────────────────┘                                                  │
└──────────────────────────────────┬──────────────────────────────────┘
                                    │ HTTP/REST
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SERVER (Node.js + Express)                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ /api/chat    │  │ /api/approve │  │ Statické soubory (public)  │  │
│  │ generate     │  │ POST        │  │                             │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────────────┘  │
│         │                 │                                          │
│  ┌──────▼─────────────────▼──────────────────────────────────────┐  │
│  │  Služby: ai.js | imageProcessor.js | designsDb.js | ftp.js    │  │
│  └───────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────┬──────────────────────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐
│  Gemini API     │  │  PostgreSQL     │  │  Replicate / FTP         │
│  OpenAI API    │  │  designs,       │  │  (volitelně)             │
│  (obrázky)     │  │  generation_log │  │                          │
└─────────────────┘  └─────────────────┘  └─────────────────────────┘
```

---

## 3. Technický stack

| Vrstva | Technologie |
|--------|-------------|
| **Backend** | Node.js 18+, Express 4.x |
| **AI – generování** | @google/genai (Gemini), openai (DALL-E 3) |
| **AI – upscaling** | Replicate (Real-ESRGAN) – volitelně |
| **Zpracování obrázků** | sharp, pdf-lib |
| **Databáze** | PostgreSQL (pg) |
| **Upload** | basic-ftp – volitelně |
| **Frontend** | Vanilla JS, CSS |

---

## 4. Konfigurace (.env)

| Proměnná | Povinné | Popis |
|----------|---------|------|
| `GEMINI_API_KEY` | ano* | Google AI API klíč – [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `OPENAI_API_KEY` | ne | OpenAI klíč pro DALL-E 3 (alternativa k Geminimu) |
| `PORT` | ne | Port serveru (výchozí 3020) |
| `DATABASE_URL` | ne | PostgreSQL connection string |
| `MAX_GENERATIONS_PER_DAY` | ne | Denní limit generací na session (0 = bez limitu) |
| `OUTPUT_DIR` | ne | Složka pro lokální PDF (výchozí ./output) |
| `UPSCALE_AI_ENABLED` | ne | `true` pro Replicate AI upscaling |
| `REPLICATE_API_TOKEN` | ne | API token pro Replicate |
| `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD` | ne | FTP pro upload souborů |
| `PRINT_DPI` | ne | DPI pro PDF a SVG (výchozí 300, bez redukce) |
| `PRINT_PNG_COMPRESSION` | ne | Komprese PNG 1–9 (1 = větší soubory, výchozí 1) |
| `SVG_TRACE_MAX_DIM` | ne | Max. rozměr pro imagetracer vektorizaci (výchozí 6000) |

\* Bez klíče běží demo režim – placeholder náhledy.

---

## 5. API endpointy

### 5.1 GET /api/health

Stav služby a konfigurace AI providerů.

**Odpověď:** `{ status, aiProvider, geminiConfigured, openaiConfigured, models }`

### 5.2 POST /api/chat/generate

Generuje obrázek podle popisu.

**Request (JSON):**
```json
{
  "prompt": "Tmavě modrý banner s bílým textem SOUTĚŽ 2025",
  "widthCm": 100,
  "heightCm": 150,
  "sessionId": "sess_xxx",
  "previousImage": "data:image/png;base64,...",
  "productId": "123"
}
```

**Request (multipart – s logem):**
- `prompt`, `widthCm`, `heightCm`, `sessionId` (nebo v `meta` JSON)
- `logo` – soubor obrázku
- `previousImage` – base64 pro kumulativní úpravy

**Odpověď:** `{ image: "data:image/png;base64,...", dimensions, remaining }`

### 5.3 POST /api/approve

Vytvoří PDF v tiskové kvalitě z předaného obrázku.

**Request:**
```json
{
  "imageBase64": "data:image/png;base64,...",
  "widthCm": 100,
  "heightCm": 150,
  "prompt": "...",
  "sessionId": "sess_xxx",
  "productId": "123"
}
```

**Odpověď:** `{ downloadUrl, filename, message }`

### 5.4 GET /api/approve/output/:filename

Stažení vygenerovaného PDF souboru.

---

## 6. Databáze (PostgreSQL)

### Tabulky

| Tabulka | Účel |
|---------|------|
| `designs` | Historie vygenerovaných bannerů (prompt, rozměry, pdf_filename, session_id, product_id) |
| `generation_log` | Log generací pro rate limiting (session_id, created_at) |

### Migrace

Spustit skripty v `database/`:
- `02_schema.sql` – vytvoření tabulek

Bez `DATABASE_URL` aplikace běží, ale neukládá historii ani neaplikuje rate limiting.

---

## 7. Workflow uživatele

1. **Zadání rozměrů** – šířka a výška banneru v cm
2. **Popis v chatu** – uživatel popíše design (barvy, text, obrázky)
3. **Generování** – AI vygeneruje návrh (Gemini / DALL-E)
4. **Refinamenty** – volitelné dílčí úpravy („posuň logo doleva“) – kumulativní
5. **Schválení** – tlačítko „Schválit a získat tisková data“
6. **Export** – AI upscaling (Replicate) nebo step upscale → PDF → předání zákazníkovi

### Způsoby předání tiskových dat

Po schválení má zákazník dvě možnosti (šetrné zejména k mobilním zařízením a datovým limitům):

| Možnost | Popis |
|---------|-------|
| **Zkopírovat odkaz** | Odkaz se zkopíruje do schránky. Zákazník ho vloží do poznámky objednávky. Factoryshop data stáhne sám do výroby. Bez nutnosti stahovat velký soubor. |
| **Stáhnout PDF** | Přímé stažení souboru (např. pro zálohu nebo lokální použití). |
| **Stáhnout SVG** | Vektorový formát (křivky) – doporučeno pro velké formáty, ostřejší text. Generuje se vždy. Viz [VEKTORIZACE_SVG.md](VEKTORIZACE_SVG.md). |

Po obou akcích se zobrazí modální okno s otázkou *„Chcete se vrátit zpět do obchodu Factoryshop.cz?“* – zákazník může zvolit **Ano** (návrat na produktovou stránku) nebo **Ne** (zůstane v konfigurátoru). URL návratu se bere z parametru `returnTo` v adrese iframe, jinak z `document.referrer`.

### Formát výstupního souboru

- Jméno souboru: `Data z Factoryshop.cz-{8 číslic}.pdf`
- PDF: 300 DPI (bez redukce, vždy plné rozlišení), rozměr 1:1, bezpečná zóna 5 cm

---

## 8. Struktura projektu

```
├── server/
│   ├── index.js           # Express, routy, statické soubory
│   ├── db.js              # PostgreSQL připojení
│   ├── routes/
│   │   ├── chat.js        # POST /api/chat/generate
│   │   └── approve.js     # POST /api/approve, GET output/:filename
│   └── services/
│       ├── ai.js          # Gemini, OpenAI DALL-E 3
│       ├── imageProcessor.js  # Sharp, PDF, Replicate upscale
│       ├── designsDb.js   # DB operace, rate limiting
│       ├── composite.js   # Logo compositing
│       └── ftp.js         # FTP upload
├── public/
│   ├── index.html         # Hlavní konfigurátor
│   ├── embed.html         # Embed verze (iframe)
│   ├── app.js
│   └── styles.css
├── database/
│   └── 02_schema.sql
├── output/                # Lokální PDF (pokud není FTP)
└── docs/
    ├── TECHNICKA_SPECIFIKACE.md   # tento dokument
    ├── KALKULACE_NAKLADU.md
    ├── REPLICATE_API_SETUP.md
    └── MODELY_Aktualizace.md
```

---

## 9. Integrace (embed)

Iframe na detail produktu v e-shopu:

```html
<iframe 
  src="https://vaše-doména.cz/embed.html?product=123&maxWidth=150" 
  width="100%" 
  height="700" 
  frameborder="0">
</iframe>
```

- `product` – ID produktu (pro budoucí integraci s Upgates API)
- `maxWidth` – max. šířka banneru v cm (např. 150 pro Basic)

---

## 10. Doplňková dokumentace

| Dokument | Obsah |
|----------|-------|
| [KALKULACE_NAKLADU.md](KALKULACE_NAKLADU.md) | Odhad nákladů na provoz (Gemini, Replicate) |
| [REPLICATE_API_SETUP.md](REPLICATE_API_SETUP.md) | Nastavení Replicate API pro AI upscaling |
| [MODELY_Aktualizace.md](MODELY_Aktualizace.md) | Kontrola a aktualizace AI modelů |

---

## ⚠️ DŮLEŽITÁ POZNÁMKA PRO PRODUKČNÍ PROVOZ

### Limit promptů uživatele

**V testovací verzi** nejsou a nebudou nastaveny limity na počet promptů (generací) na uživatele. Slouží to pro snadné testování a vývoj.

**Před nasazením do produkce je nutné implementovat limit promptů na uživatele/session**, aby bylo možné:

- kontrolovat provozní náklady (Gemini, Replicate),
- zabránit zneužití služby,
- dodržet odhady z [KALKULACE_NAKLADU.md](KALKULACE_NAKLADU.md).

### Doporučení pro produkci

| Parametr | Doporučená hodnota | Implementace |
|----------|--------------------|--------------|
| **Max. počet promptů na zákazníka a den** | 15 | Rozšířit `designsDb.js` a `checkRateLimit` o sledování promptů místo/podle generací; nebo využívat `MAX_GENERATIONS_PER_DAY` s hodnotou např. 15 |
| **Identifikace uživatele** | session_id nebo user_id | Aktuálně session_id v localStorage; pro produkci zvážit přihlášení / cookie |

**Aktuální stav:** `MAX_GENERATIONS_PER_DAY=0` znamená bez limitu. Pro produkci nastavte kladnou hodnotu (např. 15) a ověřte, že `generation_log` a `checkRateLimit` fungují s `sessionId`.

---

*Poslední aktualizace: březen 2025*
