# Kontrola a aktualizace AI modelů

Tento dokument popisuje, jak sledovat dostupnost modelů a jak aktualizovat konfiguraci při změnách u poskytovatelů API.

## Proč je to důležité

Google a OpenAI průběžně upravují životní cyklus modelů:
- Starší modely se vyřazují (např. `gemini-2.0-flash-preview-image-generation` v roce 2025)
- Nové verze mění názvy nebo API
- Regionální dostupnost se může lišit

Bez pravidelné kontroly může aplikace přestat generovat obrázky.

---

## 1. Konfigurovatelné modely v .env

Modely jsou **konfigurovatelné** – nemusíte měnit kód, stačí upravit `.env`:

```env
# Imagen (generateImages API) – primární model
GEMINI_IMAGEN_MODEL=imagen-4.0-fast-generate-001

# Gemini Flash Image (generateContent API) – záloha
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image
```

**Výchozí hodnoty** (pokud nejsou nastaveny):
- `imagen-4.0-fast-generate-001` (Imagen 4 Fast – GA)
- `gemini-2.5-flash-image` (Gemini 2.5 Flash Image)

**Fallback:** Pokud oba selžou (404), použije se `imagen-3.0-generate-001`.

---

## 2. Kontrola použitých modelů

Endpoint `/api/health` vrací aktuální konfiguraci:

```bash
curl http://localhost:3020/api/health
```

Odpověď obsahuje `models`:
```json
{
  "status": "ok",
  "aiProvider": "gemini",
  "models": {
    "imagen": "imagen-3.0-generate-001",
    "geminiImage": "gemini-2.5-flash-preview-image"
  }
}
```

---

## 3. Kde sledovat změny modelů

### Google Gemini / Imagen
- **Modely:** https://ai.google.dev/gemini-api/docs/models
- **Imagen:** https://ai.google.dev/gemini-api/docs/imagen
- **Životní cyklus:** https://ai.google.dev/gemini-api/docs/models#model-lifecycle
- **Release notes:** https://ai.google.dev/gemini-api/docs/changelog

### OpenAI DALL-E
- ** Dokumentace:** https://platform.openai.com/docs/guides/images
- **Changelog:** https://openai.com/changelog

---

## 4. Doporučená frekvence kontroly

| Interval       | Akce |
|----------------|------|
| **Čtvrtletně** | Zkontrolovat changelog a dokumentaci modelů |
| **Po chybě**   | Když generování selže s „model not found“ – zkontrolovat aktuální modely |
| **1× ročně**   | Přečíst release notes poskytovatelů a zvážit upgrade |

---

## 5. Postup při aktualizaci

1. **Zjistěte nový model** – z dokumentace nebo changelogu
2. **Upravte `.env`** – přidejte/změňte `GEMINI_IMAGEN_MODEL` nebo `GEMINI_IMAGE_MODEL`
3. **Restartujte server**
4. **Otestujte** – vygenerujte náhled v konfigurátoru
5. **Ověřte `/api/health`** – zkontrolujte, že `models` odpovídá `.env`

---

## 6. Volitelný test skriptem

Pro rychlou kontrolu můžete spustit:

```bash
node scripts/check-models.js
```

Skript ověří, zda jsou modely dostupné (vyžaduje platný `GEMINI_API_KEY` v prostředí).
