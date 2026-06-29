-- Schéma databáze AI Konfigurátoru
-- Spusťte po připojení na databázi factoryshop_konfigurator

-- Rozšíření pro UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabulka vygenerovaných návrhů (historie)
CREATE TABLE designs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt          TEXT NOT NULL,
    width_cm         INTEGER NOT NULL,
    height_cm        INTEGER NOT NULL,
    image_url        VARCHAR(500),
    pdf_filename     VARCHAR(255),
    session_id       VARCHAR(100),
    product_id       VARCHAR(50),
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_designs_created_at ON designs(created_at);
CREATE INDEX idx_designs_session_id ON designs(session_id);
CREATE INDEX idx_designs_product_id ON designs(product_id);

COMMENT ON TABLE designs IS 'Historie vygenerovaných bannerů';

-- Tabulka pro rate limiting (počet generací za den)
CREATE TABLE generation_log (
    id              SERIAL PRIMARY KEY,
    session_id      VARCHAR(100) NOT NULL,
    design_id       UUID REFERENCES designs(id),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_generation_log_session_date ON generation_log(session_id, created_at);

COMMENT ON TABLE generation_log IS 'Log generací pro omezení frekvence (rate limiting)';
