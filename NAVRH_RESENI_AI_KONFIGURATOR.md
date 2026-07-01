# AI Konfigurátor / Kreativátor pro Factoryshop.cz

## Návrh řešení problému nekvalitních výstupů z ChatGPT/Gemini pro velkoplošný tisk bannerů

---

## 1. Problém – shrnutí

| Aspekt | Stav dnes | Požadavek |
|--------|-----------|-----------|
| **Zdroje grafiky** | ChatGPT, Gemini (PNG/JPG 1000×1000 px) | Tisková data v odpovídajícím rozlišení |
| **Rozlišení** | cca 72–150 DPI, max 1024–1792 px | Min. 72–100 DPI pro velký formát, v praxi lépe 100–150 DPI |
| **Rozměr výstupu** | Fixní (např. 1024×1024 px) | Přesné rozměry banneru (např. 200×2000 cm) |
| **Formát** | RGB, PNG/JPG | CMYK, PDF nebo vhodný tiskový formát |
| **Vizualizace** | Někdy i kovová oka, detaily výroby | Čistý návrh bez technických prvků |
| **Workflow** | Email, manuální upload | Integrovaný upload do objednávky s URL na FTP |

### Minimální požadavky na tisková data pro velkoplošný tisk

- **Banner 200×200 cm při 100 DPI** → cca 7874×7874 px
- **Banner 200×2000 cm při 100 DPI** → cca 7874×78740 px
- **Formát**: PDF 1:1 nebo TIFF/PSD (CMYK)
- **Bezpečná zóna**: min. 5 cm od okraje
- **Spadávka**: 3 mm při tisku do okraje

---

## 2. Architektura navrženého řešení

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AI KONFIGURÁTOR – HIGH-LEVEL FLOW                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Detail produktu]                                                          │
│       │                                                                     │
│       ▼  ◄── Upgates API (produkt, rozměry, kontext)                         │
│  ┌─────────────────────────────────────────────────────────┐                │
│  │           AI KONFIGURÁTOR (embed/iframe)                 │                │
│  │  ┌─────────────┐  ┌─────────────────┐  ┌─────────────┐  │                │
│  │  │ Chat UI     │  │ Výběr rozměrů   │  │ Náhled      │  │                │
│  │  │ (ChatGPT-   │  │ Šířka × Výška   │  │ (adaptivní  │  │                │
│  │  │  styl)      │  │ v cm            │  │  k rozměrům)│  │                │
│  │  └──────┬──────┘  └────────┬────────┘  └──────┬───────┘  │                │
│  │         │                  │                  │          │                │
│  │         ▼                  ▼                  ▼          │                │
│  │  ┌─────────────────────────────────────────────────────┐│                │
│  │  │              Backend (vaše API)                      ││                │
│  │  │  • AI orchestrace (OpenAI / Google / Firefly)       ││                │
│  │  │  • Vektorizace / AI upscaling                        ││                │
│  │  │  • Generování PDF v rozměru 1:1                     ││                │
│  │  │  • FTP upload → URL pro přílohu objednávky          ││                │
│  │  └─────────────────────────────────────────────────────┘│                │
│  └─────────────────────────────────────────────────────────┘                │
│       │                                                                     │
│       ▼                                                                     │
│  [Upload obrázku] → URL z FTP → příloha objednávky (Upgates)                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Technický postup zpracování grafiky

### 3.1 Omezení běžných AI modelů

- **DALL·E 3**: max 1792×1024 px
- **Stable Diffusion**: běžně 512–1024 px
- **Imagen / Firefly**: vyšší rozlišení možné, ale stále v rámci tisíců px

### 3.2 Doporučený pipeline „z chatu k tisku“

```
Krok 1: AI generování (chat + prompt)
   → Obrázek cca 1024–2048 px („koncept“)

Krok 2: Zpracování do tiskové kvality
   Varianta A: AI vektorizace (PNG/JPG → SVG)
   Varianta B: AI upscaling (Real-ESRGAN, Topaz, Upscayl) na cílové rozlišení
   Varianta C: Hybrid – vektorizace pro loga/text, upscaling pro fotky

Krok 3: Finální tiskový výstup
   → PDF 1:1 v cm, CMYK (nebo RGB s konverzí při tisku)
   → Bezpečná zóna, spadávka 3 mm
```

### 3.3 Doporučení

- **Ilustrace / plochý design** → vektorizace (SVG) a převod do PDF
- **Fotorealistické motivy** → AI upscaling (4×–8×) a export do PDF/TIFF
- **Kombinace** → segmentace motivu a kombinace obou přístupů

---

## 4. Uživatelské rozhraní konfigurátoru

### 4.1 Chat-style rozhraní (podobně jako ChatGPT/Gemini)

- Levý/skutečný panel: chat s AI
- Pravý panel: náhled návrhu + ovladače
- Krátké prompty typu:
  - „Chci reklamní banner pro sportovní akci, tmavě modré pozadí, bílé logo firmy XYZ“
  - „Jednoduchý banner: červený text ‚SLEVA 20%‘ na bílém pozadí“

### 4.2 Integrace rozměrů banneru

- Pole: **Šířka (cm)** × **Výška (cm)**
- Omezení dle produktu (např. banner Basic max šířka 150 cm)
- Náhled se mění podle poměru stran
- Jasná informace: „Náhled je zmenšený, finální výstup bude v tiskové kvalitě.“

### 4.3 Zásady pro vizuální výstup

- Žádná vizualizace kovových ok, oček, šití
- Čistý grafický návrh (plachta/banner jako rovina)
- Možnost zobrazení bezpečné zóny (např. přerušovaná čára 5 cm od okraje)

### 4.4 Brand Factoryshop.cz (doporučení)

Na základě obecného vzhledu e-shopu:

- **Primární**: tmavě modrá / modrá (#1a365d, #2c5282)
- **Sekundární**: oranžová / žlutá pro CTA (#ed8936, #ecc94b)
- **Pozadí**: bílá (#ffffff), světle šedá (#f7fafc)
- **Text**: tmavě šedá (#2d3748)
- **Font**: sans-serif (např. Inter, Open Sans, systémové fonty)

---

## 5. Integrace s Upgates a e-shopem

### 5.1 Upgates API (podle dokumentace)

- **Endpoint**: `https://upgatesapiv2.docs.apiary.io/`
- **Použití**:
  - Načíst data produktu (název, rozměry, omezení)
  - Případně propojit upload s objednávkou
  - Rate limit podle tarifu (max 60 000 req/den)

### 5.2 Implementace na detailu produktu

**Možnost A: Embed přes JavaScript widget**

```html
<!-- Na stránce detailu produktu -->
<div id="ai-konfigurator" data-product-id="XXXX" data-max-width="150"></div>
<script src="https://vaše-doména.cz/konfigurator/widget.js" async></script>
```

**Možnost B: iframe**

```html
<iframe 
  src="https://vaše-doména.cz/konfigurator?product=XXXX&maxWidth=150" 
  width="100%" 
  height="700" 
  frameborder="0">
</iframe>
```

### 5.3 Propojení s objednávkou

1. Po schválení návrhu v konfigurátoru → backend vygeneruje tisková data a nahraje na FTP.
2. API vrátí URL souboru.
3. Tato URL se předá do sekce „Vložte vaše data (PNG, PDF)“ – buď automaticky ( pokud Upgates umožňuje programový upload), nebo zobrazením odkazu ke stažení.
4. Zákazník může soubor stáhnout a ručně nahrát, nebo systém vyplní pole přílohy, pokud to API podporuje.

---

## 6. Bezpečnost a omezení

- **GDPR**: uchovávání promptů a obrázků jen v souladu se zásadami a souhlasem
- **Omezení AI**: zákaz generování nevhodného obsahu, fallback na „nelze vygenerovat“
- **Rate limiting**: omezení počtu generování na uživatele/den (např. 3–5 zdarma)
- **Kvalita**: upozornění, že AI návrh je „návrh“, finální kontrolu provádí zákazník

---

## 7. Implementační doporučení

### Fáze 1 – MVP (2–3 měsíce)

1. Konfigurátor jako samostatná webová aplikace.
2. Chat UI + základní AI (např. DALL·E 3 nebo Gemini).
3. Výběr rozměrů a základní náhled.
4. Pipeline: vektorizace nebo upscaling → PDF.
5. FTP upload a generování URL.
6. Manuální propojení s objednávkou (zákazník stáhne PDF a nahraje v e-shopu).

### Fáze 2 – Integrace

1. Embed na detail produktu přes widget/iframe.
2. Integrace s Upgates API (produkt, rozměry).
3. Automatické předání URL přílohy do objednávky (pokud API umožňuje).

### Fáze 3 – Pokročilé funkce

1. Přihlášení uživatele a propojení s OpenAI/Google účtem (pokud je relevantní).
2. Ukládání historie návrhů.
3. Šablony bannerů (sport, akce, promo).
4. A/B testování různých AI modelů.

---

## 8. Odhad nákladů (orientační)

| Položka | Náklady |
|---------|---------|
| DALL·E 3 HD (1024×1024) | cca 0,08–0,12 USD/obrázek |
| Google Imagen API | podle ceníku Google |
| Vektorizace (VectorWiz, VectoSolve API) | cca 0,05–0,20 USD/obrázek |
| AI upscaling (self-hosted Real-ESRGAN) | nízké provozní náklady |
| Hosting + FTP | dle výběru provozovatele |

---

## 9. Shrnutí

Řešení kombinuje:

1. **Uživatelsky přívětivý chat** v duchu ChatGPT/Gemini.
2. **Post-processing** (vektorizace/upscaling) pro dosažení tiskové kvality.
3. **Vazbu na rozměry** banneru z detailu produktu.
4. **Integraci s e-shopem** (Upgates API, FTP, příloha objednávky).
5. **Jasné oddělení** mezi „návrhem“ a „tiskovými daty“ pro zákazníka i provozovatele.

Hlavní přidaná hodnota je **automatický přechod od konceptu k tiskovým datům** přímo v e-shopu, bez nutnosti přeposílat nízkorozlišené obrázky emailem nebo ručně upravovat v externích nástrojích.

---

*Dokument připraven jako strategický návrh. Konkrétní implementace závisí na výběru technologií, API a rozpočtu.*
