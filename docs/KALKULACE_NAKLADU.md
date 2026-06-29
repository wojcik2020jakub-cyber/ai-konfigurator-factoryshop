# Kalkulace nákladů na provoz AI Konfigurátoru

Tento dokument odhaduje měsíční provozní náklady AI Konfigurátoru bannerů pro Factoryshop.cz při využití **Gemini**, **Nano Banana** (Gemini 3.1 Flash Image) a **Replicate** (Real-ESRGAN).

---

## 1. Parametry kalkulace

| Parametr | Hodnota |
|----------|---------|
| **Limit promptů na zákazníka a den** | max. 15 |
| **Předpokládaný průměr promptů na objednávku** | 3 (1× počáteční generace + 2× refinamenty) |
| **Replicate upscaling** | 1× na objednávku (před exportem schváleného PDF) |
| **Objem objednávek** | 100, 200, 300 objednávek bannerů měsíčně |

### Předpoklady

- Zákazník typicky vygeneruje návrh, provede 1–2 úpravy a poté schválí výstup → cca 3 prompty na objednávku.
- Limit 15 promptů/den brání extrémnímu zneužití jedním zákazníkem a zároveň pokrývá i náročnější workflow (5+ iterací).
- Každá schválená objednávka vyžaduje 1× AI upscaling přes Replicate před exportem do PDF.

---

## 2. Ceník služeb (orientační, 2025)

| Služba | Model / Endpoint | Cena za 1 jednotku |
|--------|------------------|--------------------|
| **Gemini 2.5 Flash Image** | Fallback model | ~0,039 USD / obrázek |
| **Gemini 3.1 Flash Image** (Nano Banana 2) | Hlavní model | ~0,045–0,067 USD / obrázek (dle rozlišení) |
| **Replicate Real-ESRGAN** | nightmareai/real-esrgan | ~0,01–0,03 USD / obrázek |

### Pro kalkulaci použito

- **Gemini (průměr 3.1 + 2.5)**: **0,05 USD** / vygenerovaný obrázek
- **Replicate**: **0,02 USD** / jeden upscale

*Poznámka: Oficiální ceníky: [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing), [Replicate Pricing](https://replicate.com/pricing). Ceny se mohou měnit.*

---

## 3. Kalkulace podle objemu objednávek

### 3.1 100 objednávek měsíčně

| Položka | Výpočet | Náklady (USD) |
|---------|---------|---------------|
| **Gemini** (generování) | 100 objednávek × 3 prompty × 0,05 USD | 15,00 |
| **Replicate** (upscaling) | 100 objednávek × 1× × 0,02 USD | 2,00 |
| **Celkem měsíčně** | | **~17 USD** |

V CZK (při ~23 Kč/USD): **cca 390 Kč/měsíc**

---

### 3.2 200 objednávek měsíčně

| Položka | Výpočet | Náklady (USD) |
|---------|---------|---------------|
| **Gemini** (generování) | 200 × 3 × 0,05 USD | 30,00 |
| **Replicate** (upscaling) | 200 × 1 × 0,02 USD | 4,00 |
| **Celkem měsíčně** | | **~34 USD** |

V CZK (při ~23 Kč/USD): **cca 780 Kč/měsíc**

---

### 3.3 300 objednávek měsíčně

| Položka | Výpočet | Náklady (USD) |
|---------|---------|---------------|
| **Gemini** (generování) | 300 × 3 × 0,05 USD | 45,00 |
| **Replicate** (upscaling) | 300 × 1 × 0,02 USD | 6,00 |
| **Celkem měsíčně** | | **~51 USD** |

V CZK (při ~23 Kč/USD): **cca 1 170 Kč/měsíc**

---

## 4. Přehledová tabulka

| Objednávky/měsíc | Gemini (USD) | Replicate (USD) | Celkem (USD) | Celkem (Kč) |
|------------------|--------------|-----------------|--------------|-------------|
| 100 | 15 | 2 | **17** | ~390 |
| 200 | 30 | 4 | **34** | ~780 |
| 300 | 45 | 6 | **51** | ~1 170 |

---

## 5. Faktory ovlivňující výsledné náklady

| Faktor | Vliv |
|--------|------|
| **Více promptů na objednávku** | Pokud zákazníci častěji upravují (např. průměr 5 promptů), náklady na Gemini rostou cca o 67 %. |
| **Limit 15 promptů/den** | Horní hranice nákladů na zákazníka a den je omezena tímto limitem. |
| **Bez Replicate** | Pokud se AI upscaling nepoužije, platí se jen Gemini (cca −12 % až −18 % celkových nákladů). |
| **Ceny API** | Google i Replicate mohou ceny měnit; doporučeno sledovat jejich oficiální ceníky. |
| **Směnný kurz** | Kalkulace v Kč závisí na kurzu USD/CZK (použito 23 Kč/USD). |

---

## 6. Doporučení

1. **Monitorování spotřeby** – sledovat skutečný počet promptů na objednávku a upravit odhady.
2. **Volitelný Replicate** – AI upscaling lze vypnout; aplikace pak použije Lanczos upscaling (bez dodatečných nákladů).
3. **Budget limity** – na Replicate lze nastavit limit výdajů (např. 10 USD/měsíc).
4. **Gemini Batch API** – pro velké objemy lze zvažovat Batch API (až 50% sleva) u vhodných use cases.

---

*Poslední aktualizace: březen 2025*
