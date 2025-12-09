-- 001_create_events.sql

-- Генерація UUID, якщо ще не ввімкнено
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS events (
                                      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Основні поля події
    title           TEXT NOT NULL,
    summary         TEXT,
    description     TEXT,

    -- Класифікація
    type            TEXT NOT NULL,        -- e.g. 'artillery', 'uav', 'sabotage'
    severity        TEXT NOT NULL,        -- 'critical' | 'high' | 'medium' | 'low'
    status          TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'confirmed' | 'disproved'

-- Геодані (MVP без PostGIS)
    latitude        NUMERIC(9,6),
    longitude       NUMERIC(9,6),

    -- Час
    occurred_at     TIMESTAMPTZ NOT NULL,           -- коли подія фактично відбулась
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Авторство (якщо є таблиця users)
    created_by      UUID REFERENCES users(id),
    updated_by      UUID REFERENCES users(id),

    -- Коефіцієнт достовірності 0..1
    confidence      NUMERIC(3,2),

    -- Зовнішній ідентифікатор / посилання
    external_ref    TEXT
    );

CREATE INDEX IF NOT EXISTS idx_events_occurred_at ON events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type        ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_status      ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_severity    ON events(severity);