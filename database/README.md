# PostgreSQL – vytvoření databáze v pgAdmin

## Postup v pgAdmin

### 1. Spuštění pgAdmin
Otevřete pgAdmin a přihlaste se k vašemu PostgreSQL serveru.

### 2. Vytvoření databáze přes rozhraní

1. V levém stromu rozbalte **Servers** → váš server (např. *PostgreSQL 15*)
2. Pravý klik na **Databases**
3. Zvolte **Create** → **Database**
4. V záložce **General** vyplňte:
   - **Database:** `factoryshop_konfigurator`
   - **Owner:** `postgres` (nebo váš uživatel)
5. V záložce **Definition** (volitelně):
   - **Encoding:** UTF8
6. Klikněte **Save**

### 3. Spuštění SQL skriptu (schéma tabulek)

1. Pravý klik na databázi **factoryshop_konfigurator**
2. Zvolte **Query Tool**
3. Zkopírujte obsah souboru `02_schema.sql`
4. Vložte do editoru a klikněte **Execute** (F5)

---

## Alternativa: vytvoření přes SQL

1. Pravý klik na **Databases**
2. **Query Tool**
3. Spusťte `01_create_database.sql` (vyžaduje práva superuser)
4. Připojte se na novou databázi a spusťte `02_schema.sql`

---

## Připojovací řetězec

Pro Node.js aplikaci (např. s `pg`):

```
postgresql://postgres:heslo@localhost:5432/factoryshop_konfigurator
```

Nahraďte:
- `postgres` – váš uživatel
- `heslo` – vaše heslo
- `localhost:5432` – host a port (5432 je výchozí)
- `factoryshop_konfigurator` – název databáze
