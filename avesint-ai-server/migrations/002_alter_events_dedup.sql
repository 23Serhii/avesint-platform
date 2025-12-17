-- 002_alter_events_dedup.sql
-- Мінімальна еволюція таблиці events для дедупа + evidence

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS tags TEXT[];

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS fingerprint TEXT;

-- Індекс для швидкого пошуку кандидатів
CREATE INDEX IF NOT EXISTS idx_events_fingerprint ON events(fingerprint);

-- (опційно) якщо хочеш жорстко заборонити дублікати по fingerprint:
-- УВАГА: якщо fingerprint занадто грубий, можна "склеїти" різні події.
-- Тому я рекомендую поки без UNIQUE, а після відладки – додати.
-- CREATE UNIQUE INDEX IF NOT EXISTS uq_events_fingerprint ON events(fingerprint) WHERE fingerprint IS NOT NULL;

-- Таблиця evidence: які OSINT items "підтверджують" event
CREATE TABLE IF NOT EXISTS event_evidence (
                                              event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    osint_item_id UUID NOT NULL REFERENCES osint_items(id) ON DELETE CASCADE,
    relation TEXT NOT NULL DEFAULT 'support', -- support|duplicate|contradict
    weight NUMERIC(4,3) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (event_id, osint_item_id)
    );

CREATE INDEX IF NOT EXISTS idx_event_evidence_event_id ON event_evidence(event_id);
CREATE INDEX IF NOT EXISTS idx_event_evidence_item_id ON event_evidence(osint_item_id);