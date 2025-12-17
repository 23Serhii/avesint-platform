// src/ai/ai-query.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { EventsService } from '../events/events.service';
import type { ListEventsQuery } from '../events/events.schema';
import type {
  AiEventSnippet,
  AiQueryDataPayload,
  AiQueryRequest,
  AiQueryResponse,
} from './ai-query.types';
import { AiQdrantSearchService } from './ai-qdrant-search.service';
import { AiQueryLogService } from './ai-query-log.service';

@Injectable()
export class AiQueryService {
  private readonly logger = new Logger(AiQueryService.name);

  private readonly ollamaUrl =
    process.env.OLLAMA_URL ?? 'http://localhost:11434';

  /**
   * Чат-модель (для /api/generate).
   */
  private readonly model =
    process.env.AI_QUERY_MODEL ?? process.env.LLM_MODEL ?? 'gemma3:12b';

  /**
   * Кома-список запасних моделей:
   * AI_QUERY_MODEL_FALLBACKS="gemma3:12b,llama3:8b"
   */
  private readonly modelFallbacks = (process.env.AI_QUERY_MODEL_FALLBACKS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  /**
   * postgres | qdrant
   */
  private readonly source =
    (process.env.AI_QUERY_SOURCE as 'postgres' | 'qdrant' | undefined) ??
    'postgres';

  constructor(
    private readonly eventsService: EventsService,
    private readonly qdrantSearch: AiQdrantSearchService,
    private readonly aiQueryLog: AiQueryLogService,
  ) {}

  private stripIdsFromAnswer(text: string): string {
    if (!text) return text;

    const uuidLike =
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

    return text
      .replace(uuidLike, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  private buildCitations(req: AiQueryRequest, events: AiEventSnippet[], max = 5) {
    const q = (req.query ?? '').toLowerCase().trim();

    if (!q) {
      return events.slice(0, max).map((ev) => ({
        type: 'event' as const,
        id: ev.id,
        title: ev.title,
        summary: ev.summary,
      }));
    }

    const tokens = q
      .split(/[\s,.;:!?()"'«»]+/g)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3);

    const score = (ev: AiEventSnippet) => {
      const hay = [
        ev.title ?? '',
        ev.summary ?? '',
        ...(Array.isArray(ev.tags) ? ev.tags : []),
      ]
        .join(' ')
        .toLowerCase();

      let s = 0;
      for (const t of tokens) {
        if (hay.includes(t)) s += 1;
      }
      return s;
    };

    const ranked = [...events]
      .map((ev) => ({ ev, s: score(ev) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, max)
      .map(({ ev }) => ({
        type: 'event' as const,
        id: ev.id,
        title: ev.title,
        summary: ev.summary,
      }));

    return ranked.length > 0
      ? ranked
      : events.slice(0, max).map((ev) => ({
        type: 'event' as const,
        id: ev.id,
        title: ev.title,
        summary: ev.summary,
      }));
  }

  private async callLlm(
    req: AiQueryRequest,
    data: AiQueryDataPayload,
    context: {
      from?: string;
      to?: string;
      language: 'uk' | 'en';
      mode: string;
    },
  ): Promise<AiQueryResponse> {
    const prompt = this.buildPrompt(req, data, context);

    const modelsToTry = [
      this.model,
      ...this.modelFallbacks.filter((m) => m !== this.model),
    ];

    for (const model of modelsToTry) {
      this.logger.log(
        `LLM call started (model=${model}, events=${data.events.length})`,
      );

      try {
        const resp = await fetch(
          `${this.ollamaUrl.replace(/\/$/, '')}/api/generate`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, prompt, stream: false }),
          },
        );

        if (!resp.ok) {
          return this.fallbackAnswer(req, data, context);
        }

        const json = (await resp.json()) as { response?: unknown };
        const raw = String(json.response ?? '').trim();
        if (!raw) return this.fallbackAnswer(req, data, context);

        const cleaned = this.stripIdsFromAnswer(raw);

        return {
          answer: cleaned,
          citations: this.buildCitations(req, data.events ?? [], 5),
          suggestedActions: [],
          meta: { model },
        };
      } catch (err) {
        this.logger.error('LLM call error (Ollama)', err);
        return this.fallbackAnswer(req, data, context);
      }
    }

    return this.fallbackAnswer(req, data, context);
  }

  // ----------------------------
  // Time resolution
  // ----------------------------

  private resolveTimeRange(time?: AiQueryRequest['time']): { from?: string; to?: string } {
    // дефолт якщо time не передали (було 60 хв, але для "підсумку" це надто вузько)
    if (!time) {
      const now = new Date();
      const to = now.toISOString();
      const fromDate = new Date(now);
      fromDate.setUTCHours(now.getUTCHours() - 24);
      return { from: fromDate.toISOString(), to };
    }

    if (time.from || time.to) return { from: time.from, to: time.to };
    if (!time.preset) return {};

    const now = new Date();
    const to = now.toISOString();
    const fromDate = new Date(now);

    switch (time.preset) {
      case 'last_24h':
        fromDate.setUTCHours(now.getUTCHours() - 24);
        break;
      case 'last_7d':
        fromDate.setUTCDate(now.getUTCDate() - 7);
        break;
      case 'last_30d':
        fromDate.setUTCDate(now.getUTCDate() - 30);
        break;
      default:
        return {};
    }

    return { from: fromDate.toISOString(), to };
  }

  private parseTimeRangeFromQueryText(raw: unknown): { from?: string; to?: string } | null {
    const q = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    if (!q) return null;

    // UA: "за останні 7 днів", "останні 2 години", "за 48 годин"
    const ua =
      q.match(/(?:за\s*)?(?:останні|останніх)\s*(\d{1,3})\s*(дн(?:ів|і)?|доба|доб[иу]?|год(?:ин|ини|ину)?)/i) ??
      q.match(/(?:за\s*)?(\d{1,3})\s*(дн(?:ів|і)?|доба|доб[иу]?|год(?:ин|ини|ину)?)/i);

    // EN (на всяк випадок): "last 7 days", "last 24h"
    const en =
      q.match(/last\s*(\d{1,3})\s*(days?|hours?|h)\b/i);

    const m = ua ?? en;
    if (!m) return null;

    const n = Number(m[1]);
    if (!Number.isFinite(n) || n <= 0) return null;

    const unit = String(m[2] ?? '').toLowerCase();

    const now = new Date();
    const to = now.toISOString();
    const fromDate = new Date(now);

    if (unit.startsWith('год') || unit === 'hour' || unit === 'hours' || unit === 'h') {
      fromDate.setUTCHours(now.getUTCHours() - n);
      return { from: fromDate.toISOString(), to };
    }

    fromDate.setUTCDate(now.getUTCDate() - n);
    return { from: fromDate.toISOString(), to };
  }

  private resolveTimeRangeSmart(req: AiQueryRequest): { from?: string; to?: string } {
    // 1) якщо time явно передали — це головне
    if (req.time) return this.resolveTimeRange(req.time);

    // 2) якщо не передали — пробуємо витягти з тексту
    const parsed = this.parseTimeRangeFromQueryText(req.query);
    if (parsed) return parsed;

    // 3) інакше дефолт
    return this.resolveTimeRange(undefined);
  }

  // ----------------------------
  // Events processing
  // ----------------------------

  private filterAndSortByTimeRange(events: AiEventSnippet[], from?: string, to?: string) {
    const fromMs = from ? new Date(from).getTime() : null;
    const toMs = to ? new Date(to).getTime() : null;

    const inRange = (iso: string) => {
      const t = new Date(iso).getTime();
      if (!Number.isFinite(t)) return false;
      if (fromMs !== null && t < fromMs) return false;
      if (toMs !== null && t > toMs) return false;
      return true;
    };

    return events
      .filter((e) => typeof e.occurredAt === 'string' && inRange(e.occurredAt))
      .sort(
        (a, b) =>
          new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
      );
  }

  private mergeUniqueById(a: AiEventSnippet[], b: AiEventSnippet[]): AiEventSnippet[] {
    const map = new Map<string, AiEventSnippet>();
    for (const x of a) map.set(String(x.id), x);
    for (const x of b) map.set(String(x.id), x);
    return Array.from(map.values());
  }

  private isNonSemanticQuery(qRaw: unknown): boolean {
    const q = typeof qRaw === 'string' ? qRaw.toLowerCase() : '';
    const s = q.replace(/\s+/g, ' ').trim();
    if (!s) return true;

    // типові “порожні” запити, які погано працюють як embeddings
    const junk = [
      'зроби підсумок',
      'зроби короткий підсумок',
      'підсумок подій',
      'дай підсумок',
      'зроби аналіз',
      'проаналізуй',
      'summary',
      'report',
      'analysis',
    ];

    if (junk.some((x) => s.includes(x))) {
      // якщо в запиті, крім цього, нічого немає — вважаємо “не семантичний”
      const stripped = junk.reduce((acc, x) => acc.replaceAll(x, ''), s).trim();
      return stripped.length < 6;
    }

    return false;
  }

  private async loadEventsFromPostgres(opts: {
    req: AiQueryRequest;
    from?: string;
    to?: string;
    limit: number;
  }): Promise<AiEventSnippet[]> {
    const search =
      typeof opts.req.query === 'string' && opts.req.query.trim().length > 0
        ? opts.req.query.trim()
        : undefined;

    const query: ListEventsQuery = {
      page: 1,
      pageSize: opts.limit,
      from: opts.from,
      to: opts.to,
      search,
      // важливо: не відрізаємо події по severity
      severity: undefined,
    };

    const res = await this.eventsService.listEvents(query);

    const truncate = (text: string | null | undefined, max: number): string => {
      if (!text) return '';
      if (text.length <= max) return text;
      return text.slice(0, max - 1).trimEnd() + '…';
    };

    return res.items.map((e) => ({
      id: e.id,
      title: truncate(e.title, 80),
      summary: truncate(e.summary ?? undefined, 140) || undefined,
      description: undefined,
      type: e.type,
      severity: e.severity,
      status: e.status,
      occurredAt: e.occurredAt,
      latitude: e.latitude ?? undefined,
      longitude: e.longitude ?? undefined,
      tags: (e as any).tags ?? undefined,
    }));
  }

  private buildEmptyAnswer(from?: string, to?: string, language: 'uk' | 'en' = 'uk'): AiQueryResponse {
    const answerUk = [
      'Відповідь по запиту:',
      'За заданий період подій не знайдено (вибірка порожня).',
      '',
      'Релевантні події:',
      '- Немає подій у вибірці',
      '',
      'Що зробити далі:',
      '1. Перевірити, що події реально створюються як events (а не тільки osint items).',
      '2. Перевірити, що time/occurredAt виставляється коректно (і потрапляє у діапазон).',
      '3. Спробувати ширший період або конкретизувати запит.',
      '',
      'Використані події:',
      '(немає)',
    ].join('\n');

    return {
      answer: language === 'uk' ? answerUk : 'No events found for the selected time range.',
      citations: [],
      suggestedActions: [],
      meta: {
        model: 'no-llm-empty-events',
        resolvedFilters: { time: { from, to }, types: ['events'] },
      },
    };
  }

  // ----------------------------
  // Main handler
  // ----------------------------

  async handleQuery(req: AiQueryRequest, userId?: string): Promise<AiQueryResponse> {
    const started = Date.now();
    const scope = req.scope ?? { includeEvents: true };
    const language = req.language ?? 'uk';

    const { from, to } = this.resolveTimeRangeSmart(req);
    const topK = 10;

    let events: AiEventSnippet[] = [];
    let sourceUsed: 'postgres' | 'qdrant' = this.source;

    if (scope.includeEvents) {
      if (this.source === 'qdrant') {
        // 1) always try recent-by-time first (this makes "summary" work)
        const recent = await this.qdrantSearch.listRecentEventsForAi({
          from,
          to,
          limit: topK,
        });

        // 2) semantic only if query looks meaningful
        const doSemantic = !this.isNonSemanticQuery(req.query);
        const semantic = doSemantic
          ? await this.qdrantSearch.searchEventsForAi({
            req,
            from,
            to,
            limit: topK,
          })
          : [];

        const merged = this.mergeUniqueById(recent, semantic);
        events = this.filterAndSortByTimeRange(merged, from, to).slice(0, 5);

        // 3) fallback to Postgres if still empty
        if (events.length === 0) {
          this.logger.warn('AiQuery: Qdrant returned 0 events, falling back to Postgres');
          events = await this.loadEventsFromPostgres({ req, from, to, limit: topK });
          sourceUsed = 'postgres';
          events = this.filterAndSortByTimeRange(events, from, to).slice(0, 5);
        }
      } else {
        events = await this.loadEventsFromPostgres({ req, from, to, limit: topK });
        events = this.filterAndSortByTimeRange(events, from, to).slice(0, 5);
      }
    }

    const payload: AiQueryDataPayload = { events };

    if (scope.includeEvents && events.length === 0) {
      return this.buildEmptyAnswer(from, to, language);
    }

    let llmError: string | null = null;

    const llmResult = await this.callLlm(req, payload, {
      from,
      to,
      language,
      mode: req.mode ?? 'analysis',
    }).catch((e: unknown) => {
      llmError = e instanceof Error ? e.message : String(e);
      return this.fallbackAnswer(req, payload, {
        from,
        to,
        language,
        mode: req.mode ?? 'analysis',
      });
    });

    void this.aiQueryLog.log({
      userId: userId ?? null,
      source: sourceUsed,
      mode: req.mode ?? 'analysis',
      language,
      scope: req.scope ?? null,
      time: req.time ?? null,
      query: req.query ?? null,
      eventsFound: events.length,
      durationMs: Date.now() - started,
      error: llmError,
      meta: { topK },
    });

    return {
      answer: llmResult.answer ?? 'AI не зміг сформувати відповідь.',
      citations: Array.isArray(llmResult.citations) ? llmResult.citations : [],
      suggestedActions: Array.isArray(llmResult.suggestedActions)
        ? llmResult.suggestedActions
        : [],
      meta: {
        ...(llmResult.meta ?? {}),
        resolvedFilters: {
          time: { from, to },
          types: scope.includeEvents ? ['events'] : [],
        },
      },
    };
  }

  // ----------------------------
  // Prompt + fallback (залишив як було по суті)
  // ----------------------------

  private buildPrompt(
    req: AiQueryRequest,
    data: AiQueryDataPayload,
    context: {
      from?: string;
      to?: string;
      language: 'uk' | 'en';
      mode: string;
    },
  ): string {
    const lang = context.language === 'uk' ? 'українською' : 'англійською';
    const userQuery = req.query;

    const filters = {
      time: { from: context.from, to: context.to },
      scope: req.scope ?? { includeEvents: true },
      mode: context.mode,
    };

    const dataForPrompt = {
      events: data.events.map((e) => ({
        id: e.id,
        title: e.title,
        summary: e.summary,
        type: e.type,
        severity: e.severity,
        status: e.status,
        occurredAt: e.occurredAt,
        tags: e.tags ?? [],
      })),
    };

    const timeWindowText =
      context.from && context.to
        ? `Період вибірки: від ${context.from} до ${context.to}.`
        : 'Період вибірки: НЕ заданий явно (не вигадуй годину/день/тиждень).';

    return `
Ти аналітик дашборду платформи управління.

${timeWindowText}

ЖОРСТКІ ОБМЕЖЕННЯ:
- Відповідай ТІЛЬКИ на основі "events".
- Якщо період вибірки НЕ заданий явно, ЗАБОРОНЕНО писати "за останню годину/добу/тиждень" або будь-який конкретний час.
- Якщо період вибірки заданий, можеш посилатися ТІЛЬКИ на нього (без вільних трактувань).
- НЕ виводь у тексті відповіді жодних id, uuid, хешів, службових ключів подій.
- НЕ додавай рядки, що починаються з символа #.

ФОРМАТУВАННЯ:
- Пиши ${lang}.
- ПОВЕРНИ ПРОСТИЙ ТЕКСТ (не Markdown): не використовуй символи "*", "\`", "[", "]", "(", ")", "{", "}", "<", ">", "@", "=", лапки подвійні та одинарні.

Структура відповіді (строго 4 секції, кожна з нового рядка):
Відповідь по запиту:
(1–3 речення, по суті)

Релевантні події:
(1–5 маркерів через дефіс, тільки релевантні, без повторів)

Що зробити далі:
(2–4 конкретні кроки)

Використані події:
(максимум 3–5 рядків. ТІЛЬКИ назви подій, без id. Кожен рядок: назва події)
(Секцію "Використані події" виводь РІВНО ОДИН РАЗ.)

Запит користувача:
<<<
${userQuery}
>>>

Resolved фільтри:
<<<
${JSON.stringify(filters)}
>>>

Події дашборду (JSON):
<<<
${JSON.stringify(dataForPrompt)}
>>>
    `.trim();
  }

  private fallbackAnswer(
    req: AiQueryRequest,
    data: AiQueryDataPayload,
    context: {
      from?: string;
      to?: string;
      language: 'uk' | 'en';
      mode: string;
    },
  ): AiQueryResponse {
    const events = data.events ?? [];

    const bySeverity = events.reduce<Record<string, number>>((acc, ev) => {
      acc[ev.severity] = (acc[ev.severity] ?? 0) + 1;
      return acc;
    }, {});

    const byType = events.reduce<Record<string, number>>((acc, ev) => {
      acc[ev.type] = (acc[ev.type] ?? 0) + 1;
      return acc;
    }, {});

    const total = events.length;

    const severityLabel: Record<string, string> = {
      critical: 'Критичні',
      high: 'Високий пріоритет',
      medium: 'Середній пріоритет',
      low: 'Низький пріоритет',
    };

    let answer = '';

    if (context.language === 'uk') {
      answer += `### Коротко по подіях дашборду\n\n`;
      answer += `- Подій у вибірці: **${total}**\n`;
      if (context.from || context.to) {
        answer += `- Період: **${context.from ?? '—'} → ${context.to ?? '—'}**\n`;
      }

      if (total === 0) {
        answer += `\n### Деталі по подіях\n\n- Немає подій за заданими фільтрами.\n`;
        answer += `\n### Рекомендації\n\n- Уточніть фільтри часу/пріоритетів або спробуйте інший запит.\n`;
      } else {
        answer += `\n### Деталі по подіях\n\n`;
        answer += `- За пріоритетом: ${Object.entries(bySeverity)
          .map(([k, v]) => `${severityLabel[k] ?? k}: ${v}`)
          .join(', ')}\n`;
        answer += `- За типами (топ): ${Object.entries(byType)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ')}\n`;

        answer += `\n### Рекомендації\n\n`;
        answer += `- Перевірити критичні/високі події на дублікати та актуальний статус.\n`;
        answer += `- Додати задачі на верифікацію для подій без підтвердження.\n`;
        answer += `- Уточнити тип/теги для подій з неінформативним описом.\n`;
      }
    } else {
      answer = `Fallback. Total events: ${total}. Query: ${req.query ?? ''}`;
    }

    return {
      answer,
      citations: events.slice(0, 10).map((ev) => ({
        type: 'event' as const,
        id: ev.id,
        title: ev.title,
        summary: ev.summary,
      })),
      suggestedActions: [],
      meta: { model: 'fallback-no-llm' },
    };
  }
}