import { Injectable, Logger } from '@nestjs/common';

const DEFAULT_COLLECTION = 'osint';
const DEFAULT_VECTOR_SIZE = 768;

export type QdrantSearchHit = {
  id: string;
  score: number;
  payload: Record<string, any>;
};

@Injectable()
export class QdrantService {
  private readonly logger = new Logger(QdrantService.name);
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly collection: string;
  private readonly ollamaUrl: string;
  private readonly embedModel: string;

  constructor() {
    this.baseUrl = process.env.QDRANT_URL ?? 'http://localhost:6333';
    this.apiKey = process.env.QDRANT_API_KEY;
    this.collection = process.env.QDRANT_COLLECTION ?? DEFAULT_COLLECTION;

    this.ollamaUrl = process.env.OLLAMA_URL ?? 'http://localhost:11434';
    this.embedModel = process.env.EMBED_MODEL ?? 'nomic-embed-text';
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['api-key'] = this.apiKey;
    }
    return headers;
  }

  private async ensureCollectionExists(): Promise<void> {
    const url = `${this.baseUrl}/collections/${encodeURIComponent(
      this.collection,
    )}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: this.buildHeaders(),
    });

    if (res.ok) {
      return;
    }

    this.logger.log(`Creating Qdrant collection "${this.collection}"...`);
    const createRes = await fetch(url, {
      method: 'PUT',
      headers: this.buildHeaders(),
      body: JSON.stringify({
        vectors: {
          text: {
            size: DEFAULT_VECTOR_SIZE,
            distance: 'Cosine',
          },
        },
      }),
    });

    if (!createRes.ok) {
      const text = await createRes.text();
      throw new Error(
        `Failed to create Qdrant collection: ${createRes.status} ${createRes.statusText} - ${text}`,
      );
    }

    this.logger.log(`Qdrant collection "${this.collection}" created`);
  }

  private async buildEmbedding(text: string): Promise<number[]> {
    const url = `${this.ollamaUrl.replace(/\/$/, '')}/api/embeddings`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.embedModel,
        prompt: text,
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Ollama embeddings error: ${res.status} ${t}`);
    }

    const json = (await res.json()) as { embedding?: unknown };

    if (!json || !Array.isArray(json.embedding)) {
      throw new Error('Ollama embeddings: invalid response format');
    }

    const vec = json.embedding as number[];
    if (vec.length === 0) {
      throw new Error('Ollama embeddings: empty vector');
    }

    return vec;
  }

  /**
   * Записати OSINT-айтем у Qdrant.
   */
  async upsertOsintItem(params: {
    id: string;
    type: 'osint';
    title?: string | null;
    summary?: string | null;
    content: string;
    time: string;
    severity?: string | null;
    status?: string | null;
    sourceName?: string | null;
    tags?: string[] | null;
    aiClassification?: {
      mainCategory: string;
      subCategories: string[];
      threatLevel: 'low' | 'medium' | 'high';
      priority: 'P0' | 'P1' | 'P2' | 'P3';
      eventKind: 'fact' | 'assessment' | 'assumption' | 'forecast';
      tags: string[];
      confidence: number;
    } | null;
    isRoutine?: boolean;
  }): Promise<void> {
    try {
      await this.ensureCollectionExists();

      const {
        id,
        type,
        title,
        summary,
        content,
        time,
        severity,
        status,
        sourceName,
        tags,
        aiClassification,
        isRoutine,
      } = params;

      const fullText = [title, summary, content].filter(Boolean).join('\n\n');

      const vector = await this.buildEmbedding(fullText);

      const url = `${this.baseUrl}/collections/${encodeURIComponent(
        this.collection,
      )}/points?wait=true`;

      const body = {
        points: [
          {
            id,
            vector: { text: vector },
            payload: {
              docId: id,
              docType: type,
              title: title ?? null,
              summary: summary ?? null,
              content,
              time,
              severity: severity ?? null,
              status: status ?? null,
              sourceName: sourceName ?? null,
              tags: tags ?? [],
              aiClassification: aiClassification ?? null,
              isRoutine: typeof isRoutine === 'boolean' ? isRoutine : false,
              latitude: null,
              longitude: null,
            },
          },
        ],
      };

      const res = await fetch(url, {
        method: 'PUT',
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        this.logger.error(
          `Failed to upsert point to Qdrant: ${res.status} ${res.statusText} - ${text}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Error while upserting OSINT item to Qdrant: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Записати Event у Qdrant як docType='event'.
   */
  async upsertEvent(params: {
    id: string;
    title: string | null;
    summary: string | null;
    description: string | null;
    time: string; // occurredAt ISO
    severity: string | null;
    status: string | null;
    latitude: number | null;
    longitude: number | null;
    tags?: string[] | null;
    aiClassification?: {
      mainCategory: string;
      subCategories: string[];
      threatLevel: 'low' | 'medium' | 'high';
      priority: 'P0' | 'P1' | 'P2' | 'P3';
      eventKind: 'fact' | 'assessment' | 'assumption' | 'forecast';
      tags: string[];
      confidence: number;
    } | null;
    sourceName?: string | null;
    isRoutine?: boolean;
  }): Promise<void> {
    try {
      await this.ensureCollectionExists();

      const {
        id,
        title,
        summary,
        description,
        time,
        severity,
        status,
        latitude,
        longitude,
        tags,
        aiClassification,
        sourceName,
      } = params;

      const fullText = [title, summary, description]
        .filter(Boolean)
        .join('\n\n');

      const vector = await this.buildEmbedding(fullText);

      const url = `${this.baseUrl}/collections/${encodeURIComponent(
        this.collection,
      )}/points?wait=true`;

      const body = {
        points: [
          {
            id,
            vector: { text: vector },
            payload: {
              docId: id,
              docType: 'event',
              title: title ?? null,
              summary: summary ?? null,
              content: description ?? summary ?? '',
              time,
              severity: severity ?? null,
              status: status ?? null,
              sourceName: sourceName ?? null,
              tags: tags ?? [],
              aiClassification: aiClassification ?? null,
              latitude,
              longitude,
              isRoutine:
                typeof params.isRoutine === 'boolean'
                  ? params.isRoutine
                  : false,
            },
          },
        ],
      };

      const res = await fetch(url, {
        method: 'PUT',
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        this.logger.error(
          `Failed to upsert event to Qdrant: ${res.status} ${res.statusText} - ${text}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Error while upserting Event to Qdrant: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Визначаємо, чи це "рутинна" подія (щоденні удари, шахеди тощо)
   * на основі тегів та aiClassification.
   */
  isRoutineFromPayload(payload: {
    tags?: string[] | null;
    aiClassification?: {
      mainCategory: string;
      threatLevel: 'low' | 'medium' | 'high';
    } | null;
  }): boolean {
    const tags = (payload.tags ?? []).map((t) => t.toLowerCase());
    const ai = payload.aiClassification ?? null;

    const routineKeywords = [
      'shahed',
      'шахед',
      'дрон-камікадзе',
      'артобстріл',
      'артобстрел',
      'мінометний обстріл',
      'ракетний удар',
      'обстріл міста',
      'бавовна',
    ];

    if (tags.some((tag) => routineKeywords.some((kw) => tag.includes(kw)))) {
      return true;
    }

    if (
      ai &&
      ai.mainCategory === 'strikes_threats' &&
      ai.threatLevel !== 'high'
    ) {
      return true;
    }

    return false;
  }

  /**
   * Семантичний пошук по OSINT-документах.
   */
  async searchOsint(params: {
    query: string;
    limit?: number;
  }): Promise<QdrantSearchHit[]> {
    const { query, limit = 10 } = params;

    await this.ensureCollectionExists();
    const vector = await this.buildEmbedding(query);

    const url = `${this.baseUrl}/collections/${encodeURIComponent(
      this.collection,
    )}/points/search`;

    const body = {
      vector: { text: vector },
      limit,
      with_payload: true,
      with_vector: false,
      filter: {
        must: [
          {
            key: 'docType',
            match: { value: 'osint' },
          },
        ],
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Qdrant search failed: ${res.status} ${res.statusText} - ${text}`,
      );
    }

    const json = (await res.json()) as {
      result?: Array<{
        id: string | number;
        score: number;
        payload?: Record<string, any>;
      }>;
    };

    const points = json.result ?? [];

    return points.map((pt) => ({
      id: String(pt.id),
      score: pt.score,
      payload: {
        docId: pt.payload?.docId,
        docType: pt.payload?.docType,
        title: pt.payload?.title ?? null,
        summary: pt.payload?.summary ?? null,
        content: pt.payload?.content,
        time: pt.payload?.time,
        severity: pt.payload?.severity ?? null,
        status: pt.payload?.status ?? null,
        sourceName: pt.payload?.sourceName ?? null,
        tags: pt.payload?.tags ?? [],
        aiClassification: pt.payload?.aiClassification ?? null,
        latitude: pt.payload?.latitude ?? null,
        longitude: pt.payload?.longitude ?? null,
        isRoutine: Boolean(pt.payload?.isRoutine),
      },
    }));
  }

  /**
   * Загальний AI-пошук / вибірка по Qdrant для подій та OSINT.
   */
  async searchIntelligence(params: {
    query?: string;
    limit?: number;
    docTypes?: Array<'event' | 'osint'>;
    status?: string;
    isRoutine?: boolean;
    hasGeo?: boolean;
  }): Promise<QdrantSearchHit[]> {
    const {
      query,
      limit = 50,
      docTypes = ['event', 'osint'],
      status,
      isRoutine,
      hasGeo,
    } = params;

    await this.ensureCollectionExists();

    const vector =
      typeof query === 'string' && query.trim()
        ? await this.buildEmbedding(query.trim())
        : null;

    const mustFilters: any[] = [
      {
        key: 'docType',
        match: { any: docTypes },
      },
    ];

    if (typeof status === 'string') {
      mustFilters.push({
        key: 'status',
        match: { value: status },
      });
    }

    if (typeof isRoutine === 'boolean') {
      mustFilters.push({
        key: 'isRoutine',
        match: { value: isRoutine },
      });
    }

    // 🔹 Фільтр "є гео": latitude/longitude в адекватних межах
    if (hasGeo) {
      mustFilters.push({
        key: 'latitude',
        range: { gte: -90, lte: 90 },
      });
      mustFilters.push({
        key: 'longitude',
        range: { gte: -180, lte: 180 },
      });
    }

    const url = `${this.baseUrl}/collections/${encodeURIComponent(
      this.collection,
    )}/points/search`;

    const body: any = {
      limit,
      with_payload: true,
      with_vector: false,
      filter: { must: mustFilters },
    };

    if (vector) {
      body.vector = { name: 'text', vector };
    } else {
      body.vector = {
        name: 'text',
        vector: new Array(DEFAULT_VECTOR_SIZE).fill(0),
      };
      body.score_threshold = 0;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Qdrant searchIntelligence failed: ${res.status} ${res.statusText} - ${text}`,
      );
    }

    const json = (await res.json()) as {
      result?: Array<{
        id: string | number;
        score: number;
        payload?: Record<string, any>;
      }>;
    };

    const points = json.result ?? [];

    return points.map((pt) => ({
      id: String(pt.id),
      score: pt.score,
      payload: {
        docId: pt.payload?.docId,
        docType: pt.payload?.docType,
        title: pt.payload?.title ?? null,
        summary: pt.payload?.summary ?? null,
        content: pt.payload?.content,
        time: pt.payload?.time,
        severity: pt.payload?.severity ?? null,
        status: pt.payload?.status ?? null,
        sourceName: pt.payload?.sourceName ?? null,
        tags: pt.payload?.tags ?? [],
        aiClassification: pt.payload?.aiClassification ?? null,
        latitude: pt.payload?.latitude ?? null,
        longitude: pt.payload?.longitude ?? null,
        isRoutine: Boolean(pt.payload?.isRoutine),
      },
    }));
  }
}
