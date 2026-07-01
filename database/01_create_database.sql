-- Vytvoření databáze (spusťte jako superuser v Query Tool)
-- V pgAdmin: připojte se na server → pravý klik na Databases → Create → Database

CREATE DATABASE factoryshop_konfigurator
    WITH 
    OWNER = postgres
    ENCODING = 'UTF8'
    TEMPLATE = template0;

COMMENT ON DATABASE factoryshop_konfigurator IS 'Databáze pro AI konfigurátor bannerů Factoryshop.cz';
