# Postup spuštění aplikace – AI Konfigurátor bannerů

Návod pro lokální spuštění a nasazení AI Konfigurátoru pro Factoryshop.cz.

---

## 1. Požadavky

| Požadavek | Verze |
|-----------|-------|
| **Node.js** | 18 nebo vyšší |
| **npm** | 8+ (součást Node.js) |
| **PostgreSQL** | 12+ (volitelně – pro historii a rate limiting) |

Zkontrolujte verzi Node.js:

```bash
node --version
```

---

## 2. Instalace

### 2.1 Stáhnutí / klonování projektu

```bash
cd c:\Users\jakub\Desktop\Aplikace-Factoryshop.cz
```

(Případně jiná cesta, kde je projekt umístěn.)

### 2.2 Instalace závislostí

```bash
npm install
```

---

## 3. Konfigurace

### 3.1 Vytvoření souboru .env

```bash
copy .env.example .env
```

(Příkaz pro Windows; na Linux/Mac použijte `cp .env.example .env`.)

### 3.2 Úprava .env

Otevřete `.env` a nastavte minimálně:

| Proměnná | Povinné | Popis | Příklad |
|----------|---------|-------|---------|
| `GEMINI_API_KEY` | ano* | Google AI klíč pro generování obrázků | `AIzaSy...` |
| `PORT` | ne | Port serveru | `3020` |
| `DATABASE_URL` | ne | PostgreSQL connection string | `postgresql://user:heslo@localhost:5432/factoryshop_konfigurator` |

\* Bez klíče aplikace běží v demo režimu (placeholder náhledy).

### 3.3 Volitelné proměnné

| Proměnná | Popis |
|----------|-------|
| `REPLICATE_API_TOKEN` | AI upscaling a vektorizace – viz [REPLICATE_API_SETUP.md](REPLICATE_API_SETUP.md) |
| `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD` | Upload vygenerovaných souborů na FTP |
| `MAX_GENERATIONS_PER_DAY` | Denní limit generací (0 = bez limitu) |

---

## 4. Databáze (volitelné)

Pokud používáte PostgreSQL:

### 4.1 Vytvoření databáze

```bash
psql -U postgres -c "CREATE DATABASE factoryshop_konfigurator;"
```

### 4.2 Spuštění migrace

```bash
psql -U postgres -d factoryshop_konfigurator -f database/02_schema.sql
```

Bez databáze aplikace funguje, ale neukládá historii návrhů a neaplikuje rate limiting.

---

## 5. Spuštění aplikace

### 5.1 Standardní spuštění

```bash
npm start
```

### 5.2 Alternativa (přímé volání Node.js)

```bash
node server/index.js
```

### 5.3 Očekávaný výstup

```
AI Konfigurátor běží na http://localhost:3020
Output PDF: C:\...\output
✓ Generování přes Google Gemini 2.0 Flash (image)
```

---

## 6. Ověření funkčnosti

### 6.1 Otevření v prohlížeči

```
http://localhost:3020
```

### 6.2 Kontrola zdraví API

```bash
curl http://localhost:3020/api/health
```

Očekávaná odpověď (zkráceno):

```json
{"status":"ok","service":"ai-konfigurator","aiProvider":"gemini",...}
```

---

## 7. Užitečné příkazy – přehled

| Příkaz | Popis |
|--------|-------|
| `npm install` | Instalace závislostí |
| `npm start` | Spuštění serveru |
| `node server/index.js` | Přímé spuštění serveru |
| `npm run check-models` | Kontrola dostupnosti AI modelů |
| `copy .env.example .env` | Vytvoření .env ze šablony (Windows) |
| `psql -U postgres -d factoryshop_konfigurator -f database/02_schema.sql` | Spuštění databázové migrace |

---

## 8. Ukončení aplikace

V terminálu, kde běží server, stiskněte:

```
Ctrl + C
```

---

## 9. Řešení problémů

| Problém | Řešení |
|---------|--------|
| Port 3020 je obsazen | Změňte `PORT` v `.env` na jinou hodnotu (např. 3021) |
| „ECONNREFUSED“ u databáze | Zkontrolujte, že PostgreSQL běží a `DATABASE_URL` je správný |
| Generování nefunguje | Zkontrolujte `GEMINI_API_KEY` – klíč získáte na [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| Chybí složka output | Složka se vytvoří automaticky při prvním schválení návrhu |

---

## 10. Dokumentace

| Dokument | Obsah |
|----------|-------|
| [TECHNICKA_SPECIFIKACE.md](TECHNICKA_SPECIFIKACE.md) | Architektura, API, konfigurace |
| [REPLICATE_API_SETUP.md](REPLICATE_API_SETUP.md) | Nastavení Replicate pro upscaling |
| [VEKTORIZACE_SVG.md](VEKTORIZACE_SVG.md) | Vektorizace na SVG |
| [KALKULACE_NAKLADU.md](KALKULACE_NAKLADU.md) | Provozní náklady |

---

*Poslední aktualizace: březen 2025*
