# Replicate API – nastavení pro AI upscaling

AI Konfigurátor může před exportem do PDF **volitelně** použít AI upscaling (Real-ESRGAN) ke zlepšení kvality obrázků. Tato funkce využívá **Replicate** – cloudovou službu třetí strany.

---

## 1. Je Replicate placená služba?

**Ano.** Replicate je komerční služba, nicméně:

| Položka | Popis |
|---------|-------|
| **Úvodní kredit** | Nové účty dostanou **$25 zdarma** na vyzkoušení |
| **Bez stálého limitu** | Po vyčerpání kreditu platíte jen za skutečné použití (pay-per-use) |
| **Žádné měsíční poplatky** | Placení pouze podle spotřeby |
| **Cena Real-ESRGAN** | Řádově centy za obrázek (GPU sekundy) |

**Služba je volitelná** – pokud Replicate nenastavíte, aplikace funguje normálně a použije Lanczos upscaling (Sharp). AI upscaling se jednoduše přeskočí.

---

## 2. Postup pro získání API tokenu

### Krok 1: Registrace

1. Otevřete **[replicate.com](https://replicate.com)**
2. Klikněte na **„Sign in“** (pravý horní roh)
3. Přihlaste se přes **GitHub** (Google se standardně nepodporuje)

### Krok 2: Vytvoření API tokenu

1. Po přihlášení přejděte na **[replicate.com/account/api-tokens](https://replicate.com/account/api-tokens)**
2. Klikněte na **„Create token“**
3. Zadejte název tokenu (např. „AI Konfigurátor Factoryshop“)
4. Klikněte na **„Create“**
5. **Zkopírujte token** – zobrazí se jen jednou (formát `r8_xxxxxxxxxxxx`)

### Krok 3: Doplnění platebních údajů (pro trvalé použití)

Pro využití služby po vyčerpání úvodního kreditu ($25):

1. Přejděte na **[replicate.com/account/billing](https://replicate.com/account/billing)**
2. Přidejte platební kartu
3. Nastavte si limit výdajů (doporučeno), např. $10/měsíc

> **Poznámka:** Bez doplněné karty můžete používat jen úvodní kredit $25.

---

## 3. Konfigurace v AI Konfigurátoru

Do souboru `.env` přidejte:

```env
# AI upscaling před exportem do PDF (Real-ESRGAN)
UPSCALE_AI_ENABLED=true
REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Poté **restartujte server**.

---

## 4. Kdy se AI upscaling používá

- Před exportem do PDF (tlačítko „Schválit a získat tisková data“)
- Jen pokud jsou v `.env` nastaveny `UPSCALE_AI_ENABLED=true` a `REPLICATE_API_TOKEN`
- Při selhání (síť, limit, chyba) se použije běžný Lanczos upscaling

---

## 5. Orientační náklady

| Akce | Odhad |
|------|-------|
| 1× export banneru (Real-ESRGAN 2×) | cca $0.002–0.01 |
| 100 exportů / měsíc | cca $0.20–1.00 |
| Úvodní kredit $25 | stovky až tisíce exportů |

Přesné ceny: [replicate.com/pricing](https://replicate.com/pricing)

---

## 6. Bezpečnost

- **Token nikdy necommitujte** do gitu (`.env` je v `.gitignore`)
- Token lze kdykoliv zrušit v [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens)
- Pro produkci doporučujeme nastavit limit výdajů v billing

---

## 7. Odkazy

| Odkaz | Popis |
|-------|-------|
| [replicate.com](https://replicate.com) | Domovská stránka |
| [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens) | Správa API tokenů |
| [replicate.com/pricing](https://replicate.com/pricing) | Ceník |
| [nightmareai/real-esrgan](https://replicate.com/nightmareai/real-esrgan) | Model Real-ESRGAN |
