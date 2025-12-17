// src/ai/ai-qdrant-search.service.ts
import { Injectable, Logger } from '@nestjs/common';
import type { AiEventSnippet, AiQueryRequest } from './ai-query.types';

type QdrantPoint = {
  id: string | number;
  score: number;
  payload?: Record<string, unknown> | null;
};

type QdrantSearchResponse = {
  result?: QdrantPoint[];
  time?: number;
  status?: unknown;
};

type QdrantErrorBody = {
  status?: {
    error?: string;
  };
  time?: number;
};

@Injectable()
export class AiQdrantSearchService {
  private readonly logger = new Logger(AiQdrantSearchService.name);

  private readonly qdrantUrl =
    process.env.QDRANT_URL ?? 'http://localhost:6333';

  /**
   * Має збігатися з тим, куди реально upsert'иш події.
   * У твоєму проєкті writer використовує QDRANT_COLLECTION (дефолт: 'osint'),
   * тому тут дефолт ТАКИЙ САМИЙ.
   */
  private readonly eventsCollection =
    process.env.QDRANT_EVENTS_COLLECTION ??
    process.env.QDRANT_COLLECTION ??
    'osint';

  private readonly qdrantApiKey = process.env.QDRANT_API_KEY;

  private readonly ollamaUrl =
    process.env.OLLAMA_URL ?? 'http://localhost:11434';

  /**
   * Для embeddings не можна брати AI_QUERY_MODEL (це чат-модель).
   * Має бути embed-модель: AI_EMBED_MODEL або EMBED_MODEL.
   */
  private readonly embedModel =
    process.env.AI_EMBED_MODEL ?? process.env.EMBED_MODEL ?? 'nomic-embed-text';

  private warnedMissingCollection = false;
  private warnedEmbeddingsDown = false;

  async listRecentEventsForAi(opts: {
    from?: string;
    to?: string;
    limit: number;
  }): Promise<AiEventSnippet[]> {
    const { from, to, limit } = opts;

    const exists = await this.collectionExists();
    if (!exists) return [];

    const fromMs = from ? new Date(from).getTime() : null;
    const toMs = to ? new Date(to).getTime() : null;

    const must: any[] = [{ key: 'docType', match: { value: 'event' } }];

    if (fromMs !== null && Number.isFinite(fromMs)) {
      must.push({ key: 'timeUnixMs', range: { gte: fromMs } });
    }
    if (toMs !== null && Number.isFinite(toMs)) {
      must.push({ key: 'timeUnixMs', range: { lte: toMs } });
    }

    // Scroll: без вектора, беремо просто точки і сортуємо по часу на бекенді
    const url = `${this.qdrantCollectionUrl()}/points/scroll`;
    const body = {
      limit: Math.max(limit, 50), // беремо з запасом, щоб точно вибрати найсвіжіші
      with_payload: true,
      with_vector: false,
      filter: { must },
    };

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: this.buildQdrantHeaders(),
        body: JSON.stringify(body),
      });

      if (!resp.ok) return [];

      const json = (await resp.json()) as {
        result?: {
          points?: Array<{
            id: string | number;
            payload?: Record<string, unknown>;
          }>;
        };
      };

      const points = json?.result?.points ?? [];

      const mapped = points.map((p) => {
        const payload = (p.payload ?? {}) as Record<string, unknown>;
        const id = typeof p.id === 'number' ? String(p.id) : String(p.id ?? '');

        return {
          id,
          title: this.truncate(payload.title, 80) || 'Без назви',
          summary: this.truncate(payload.summary, 140) || undefined,
          description: undefined,
          type: this.pickString(payload.type) ?? 'other_enemy_activity',
          severity: this.pickString(payload.severity) ?? 'medium',
          status: this.pickString(payload.status) ?? 'pending',
          occurredAt: this.safeIso(payload.time) ?? new Date(0).toISOString(),
          latitude: this.parseNumber(payload.latitude),
          longitude: this.parseNumber(payload.longitude),
          tags: this.pickStringArray(payload.tags),
        } satisfies AiEventSnippet;
      });

      return mapped
        .filter((e) => typeof e.occurredAt === 'string')
        .sort(
          (a, b) =>
            new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
        )
        .slice(0, limit);
    } catch {
      return [];
    }
  }

  private buildQdrantHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.qdrantApiKey) headers['api-key'] = this.qdrantApiKey;
    return headers;
  }

  private qdrantCollectionUrl(): string {
    return `${this.qdrantUrl.replace(/\/$/, '')}/collections/${encodeURIComponent(
      this.eventsCollection,
    )}`;
  }

  private qdrantSearchUrl(): string {
    return `${this.qdrantCollectionUrl()}/points/search`;
  }

  private async collectionExists(): Promise<boolean> {
    try {
      const resp = await fetch(this.qdrantCollectionUrl(), {
        method: 'GET',
        headers: this.buildQdrantHeaders(),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  private parseNumber(v: unknown): number | undefined {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    return undefined;
  }

  private truncate(text: unknown, max: number): string {
    const s = typeof text === 'string' ? text : '';
    if (s.length <= max) return s;
    return s.slice(0, max - 1).trimEnd() + '…';
  }

  private safeIso(v: unknown): string | undefined {
    if (typeof v !== 'string' || !v.trim()) return undefined;
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d.toISOString() : undefined;
  }

  private pickString(v: unknown): string | undefined {
    return typeof v === 'string' && v.trim() ? v : undefined;
  }

  private pickStringArray(v: unknown): string[] | undefined {
    if (!Array.isArray(v)) return undefined;
    const out = v
      .map((x) => (typeof x === 'string' ? x : String(x)))
      .filter(Boolean);
    return out.length > 0 ? out : undefined;
  }

  private expandQuery(raw: string): string {
    const q = (raw ?? '').trim();
    if (!q) return q;

    const lower = q.toLowerCase();

    const expansions: string[] = [q];

    // UAV / drones
    if (
      lower.includes('бпла') ||
      lower.includes('бла') ||
      lower.includes('дрон') ||
      lower.includes('fpv') ||
      lower.includes('uav')
    ) {
      expansions.push('безпілотник');
      expansions.push('оператори бпла');
      expansions.push('fpv дрон');
    }

    // infantry / soldiers (узагальнено)
    if (
      lower.includes('піхот') ||
      lower.includes('солдат') ||
      lower.includes('військов') ||
      lower.includes('особов')
    ) {
      expansions.push('піхота');
      expansions.push('особовий склад');
      expansions.push('військові');
    }

    // operators (узагальнено)
    if (lower.includes('оператор') || lower.includes('розрах')) {
      expansions.push('розрахунок');
      expansions.push('екіпаж');
    }

    // Склеюємо в один текст для embeddings (без спецсимволів)
    return Array.from(new Set(expansions)).join('. ');
  }

  private async embedQuery(req: AiQueryRequest): Promise<number[] | null> {
    const rawText = req.query?.trim();
    if (!rawText) return null;

    const text = this.expandQuery(rawText);

    this.logger.log(
      `AiQdrantSearch: embedding query with model=${this.embedModel}`,
    );

    try {
      const resp = await fetch(
        `${this.ollamaUrl.replace(/\/$/, '')}/api/embeddings`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: this.embedModel, prompt: text }),
        },
      );

      if (!resp.ok) return null;

      const data = (await resp.json()) as { embedding?: unknown };
      const vector = data?.embedding;

      if (!Array.isArray(vector) || vector.length === 0) return null;

      const clean = vector.filter((x) => typeof x === 'number') as number[];
      return clean.length > 0 ? clean : null;
    } catch {
      return null;
    }
  }

  async searchEventsForAi(opts: {
    req: AiQueryRequest;
    from?: string;
    to?: string;
    limit: number;
  }): Promise<AiEventSnippet[]> {
    const { req, from, to, limit } = opts;

    // 1) Якщо колекції немає — повертаємо [] (AiQueryService зробить fallback на Postgres)
    const exists = await this.collectionExists();
    if (!exists) {
      if (!this.warnedMissingCollection) {
        this.warnedMissingCollection = true;
        this.logger.warn(
          `Qdrant collection "${this.eventsCollection}" not found. Falling back to Postgres until it exists.`,
        );
      }
      return [];
    }

    // 2) Embedding обов'язковий. Не робимо "dummy vector [0]" — це ламає Qdrant (size mismatch).
    const vector = await this.embedQuery(req);
    if (!vector) {
      return [];
    }

    const must: any[] = [
      {
        key: 'docType',
        match: { value: 'event' },
      },
    ];

    const fromMs = from ? new Date(from).getTime() : null;
    const toMs = to ? new Date(to).getTime() : null;

    if (fromMs !== null && Number.isFinite(fromMs)) {
      must.push({
        key: 'timeUnixMs',
        range: { gte: fromMs },
      });
    }
    if (toMs !== null && Number.isFinite(toMs)) {
      must.push({
        key: 'timeUnixMs',
        range: { lte: toMs },
      });
    }

    const filter = { must };
    const MIN_SCORE = 0.22;

    const body = {
      vector: { name: 'text', vector },
      limit,
      filter,
      with_payload: true,
      with_vector: false,
      score_threshold: MIN_SCORE,
    };
    this.logger.log(
      `Qdrant semantic search started (collection=${this.eventsCollection}, limit=${limit}, hasVector=true, minScore=${MIN_SCORE})`,
    );

    try {
      const resp = await fetch(this.qdrantSearchUrl(), {
        method: 'POST',
        headers: this.buildQdrantHeaders(),
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const text = await resp.text();

        // Спробуємо прочитати qdrant error красиво
        let hint = text.slice(0, 200);
        try {
          const parsed = JSON.parse(text) as QdrantErrorBody;
          const msg = parsed?.status?.error;
          if (typeof msg === 'string' && msg.trim()) {
            hint = msg.trim();
          }
        } catch {
          // ignore
        }

        this.logger.warn(
          `Qdrant search failed (status=${resp.status}): ${hint}`,
        );
        return [];
      }

      const data = (await resp.json()) as QdrantSearchResponse;
      const result = Array.isArray(data.result) ? data.result : [];

      this.logger.log(
        `Qdrant search returned ${result.length} points in ${data.time ?? '?'}s`,
      );

      return result.map((p) => {
        const id = typeof p.id === 'number' ? String(p.id) : String(p.id ?? '');
        const payload = (p.payload ?? {}) as Record<string, unknown>;

        const title = this.truncate(payload.title, 80) || 'Без назви';
        const summary = this.truncate(payload.summary, 140) || undefined;

        return {
          id,
          title,
          summary,
          description: undefined,
          type: this.pickString(payload.type) ?? 'other_enemy_activity',
          severity: this.pickString(payload.severity) ?? 'medium',
          status: this.pickString(payload.status) ?? 'pending',
          occurredAt: this.safeIso(payload.time) ?? new Date().toISOString(),
          latitude: this.parseNumber(payload.latitude),
          longitude: this.parseNumber(payload.longitude),
          tags: this.pickStringArray(payload.tags),
        };
      });
    } catch (err) {
      this.logger.error('Qdrant search error', err);
      return [];
    }
  }
}
