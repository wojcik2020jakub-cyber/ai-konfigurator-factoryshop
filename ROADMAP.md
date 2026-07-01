# Roadmapa – AI Konfigurátor Factoryshop.cz

## ✅ Hotovo
- Interaktivní HTML vizualizace funkcí
- Handoff dokument (Word)
- Path traversal fix
- Helmet, rate-limit, body limits, graceful shutdown
- Rate limit bypass fix
- crypto.randomBytes místo Math.random
- Validace promptu a rozměrů
- Git + GitHub (main branch, čistá historie)
- GitHub Actions CI (smoke test /api/health)
- backup_db.bat pro Plánovač úloh Windows
- npm audit fix (9/10 zranitelností opraveno)

---

## 🔜 Další kroky

### Nasazení – pilotní provoz
- [ ] Nasadit na **Railway.app** (nebo Render.com)
  - Propojit GitHub repo → automatický deploy na push
  - Přidat env variables (GEMINI_API_KEY, limity, ...)
  - Přidat PostgreSQL plugin pro cloud databázi
  - Výsledek: veřejná HTTPS URL pro Upgates iframe embed
- [ ] Nastavit vlastní doménu (volitelně)
- [ ] Otestovat embed v Upgates prostředí

### Bezpečnost & kvalita
- [ ] uuid moderate zranitelnost – zvážit upgrade na uuid@14 (breaking change)
- [ ] CORS – zvážit whitelist domén až bude znám seznam nasazení
- [ ] Přidat jednotkové testy (Jest)

### Funkce
- [ ] Admin panel pro přehled generování per zákazník
- [ ] Historie vygenerovaných bannerů per session
- [ ] Podpora více jazyků (i18n)
