# Vektorizace na SVG (křivky)

AI Konfigurátor **vždy** generuje vedle PDF i **SVG** – vektorový formát vhodný pro velké formáty bannerů (ostřejší text, škálovatelnost bez ztráty kvality).

---

## 1. Jak to funguje

| Krok | Popis |
|------|-------|
| 1 | Vygenerovaný návrh (PNG) projde upscalingem (Replicate Real-ESRGAN nebo Lanczos) |
| 2 | Obrázek se vloží do PDF (rastrový výstup) |
| 3 | **Vektorizace** – PNG se převede na SVG křivky (viz níže) |
| 4 | Do SVG se doplní rozměry v mm pro tisk |
| 5 | Uživatel dostane PDF i SVG ke stažení / zkopírování odkazu |

### Způsoby vektorizace (vždy se pokusí oba)

1. **Replicate** (VTracer) – pokud je nastaven `REPLICATE_API_TOKEN`, použije se nejdříve (nejvyšší kvalita)
2. **imagetracerjs** – lokální fallback bez API, používá se při chybějícím tokenu nebo selhání Replicate

---

## 2. Volitelná konfigurace Replicate

Pro vyšší kvalitu SVG nastavte v `.env`:
```
REPLICATE_API_TOKEN=r8_xxxx
```
Stejný token jako pro upscaling – viz [REPLICATE_API_SETUP.md](REPLICATE_API_SETUP.md).

Bez tokenu se SVG generuje přes lokální imagetracerjs.

---

## 3. Náklady (pouze při použití Replicate)

Model **merahburam/vectorizer-v2** na Replicate stojí cca **$0.0001** za běh (~10 000 běhů za $1). Lokální imagetracerjs je zdarma.

---

## 4. Kdy se SVG negeneruje

Výjimečně, když selže obě metody (Replicate i imagetracerjs) – např. poškozený obrázek, extrémní rozměry. V takovém případě se zobrazí pouze PDF.

---

## 5. Formát SVG výstupu

- Do SVG se doplní atributy `width` a `height` v mm podle zadaných rozměrů banneru
- Formát je kompatibilní s Adobe Illustrator, CorelDRAW, Inkscape aj.
- Vhodné pro velkoplošný tisk a řezání

---

*Viz také: [REPLICATE_API_SETUP.md](REPLICATE_API_SETUP.md) pro nastavení tokenu.*
