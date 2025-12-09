// src/ai/ai-query-log.service.ts
import { Injectable, Logger } from '@nestjs/common'
import { pool } from '../db'

@Injectable()
export class AiQueryLogService {
  private readonly logger = new Logger(AiQueryLogService.name)

  private async ensureTable(): Promise<void> {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_query_log (
        id           BIGSERIAL PRIMARY KEY,
        ts           TIMESTAMPTZ NOT NULL DEFAULT now(),
        user_id      TEXT NULL,
        source       TEXT NOT NULL,
        mode         TEXT NULL,
        language     TEXT NULL,
        scope        JSONB NULL,
        time_filter  JSONB NULL,
        query        TEXT NULL,
        events_found INTEGER NULL,
        duration_ms  INTEGER NULL,
        error        TEXT NULL,
        meta         JSONB NULL
      );
    `)
  }

  async log(entry: {
    userId?: string | null
    source: string
    mode?: string | null
    language?: string | null
    scope?: any | null
    time?: any | null
    query?: string | null
    eventsFound?: number | null
    durationMs?: number | null
    error?: string | null
    meta?: Record<string, any> | null
  }): Promise<void> {
    try {
      await this.ensureTable()
      const {
        userId,
        source,
        mode,
        language,
        scope,
        time,
        query,
        eventsFound,
        durationMs,
        error,
        meta,
      } = entry
      await pool.query(
        `
          INSERT INTO ai_query_log (
            user_id, source, mode, language, scope, time_filter, query,
            events_found, duration_ms, error, meta
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        `,
        [
          userId ?? null,
          source,
          mode ?? null,
          language ?? null,
          scope ? JSON.stringify(scope) : null,
          time ? JSON.stringify(time) : null,
          query ?? null,
          typeof eventsFound === 'number' ? eventsFound : null,
          typeof durationMs === 'number' ? durationMs : null,
          error ?? null,
          meta ? JSON.stringify(meta) : null,
        ],
      )
    } catch (e: any) {
      // Не валимо запит через помилки логування
      this.logger.warn(`Failed to write ai_query_log: ${e?.message ?? e}`)
    }
  }
}
