// src/ai/ai-query.service.ts
import { Injectable, Logger } from '@nestjs/common'
import { EventsService } from '../events/events.service'
import type { ListEventsQuery } from '../events/events.schema'
import type {
  AiEventSnippet,
  AiQueryDataPayload,
  AiQueryRequest,
  AiQueryResponse,
} from './ai-query.types'
import { AiQdrantSearchService } from './ai-qdrant-search.service';
import { AiQueryLogService } from './ai-query-log.service'

@Injectable()
export class AiQueryService {
  private readonly logger = new Logger(AiQueryService.name)

  private readonly ollamaUrl =
    process.env.OLLAMA_URL ?? 'http://localhost:11434'
  private readonly model =
    process.env.AI_QUERY_MODEL ??
    process.env.LLM_MODEL ??
    'gemma3:12b'

  // postgres | qdrant
  private readonly source =
    (process.env.AI_QUERY_SOURCE as 'postgres' | 'qdrant' | undefined) ??
    'postgres'

  constructor(
    private readonly eventsService: EventsService,
    private readonly qdrantSearch: AiQdrantSearchService,
    private readonly aiQueryLog: AiQueryLogService,
  ) {}

  async handleQuery(req: AiQueryRequest, userId?: string): Promise<AiQueryResponse> {
    const started = Date.now()
    const scope = req.scope ?? { includeEvents: true }
    const language = req.language ?? 'uk'

    const { from, to } = this.resolveTimeRange(req.time)

    const topK = 10

    let events: AiEventSnippet[] = []
    let sourceUsed: 'postgres' | 'qdrant' = this.source
    if (scope.includeEvents) {
      if (this.source === 'qdrant') {
        this.logger.log('AiQuery: loading events from Qdrant')
        events = await this.qdrantSearch.searchEventsForAi({
          req,
          from,
          to,
          limit: topK,
        })

        // 👇 fallback на Postgres, якщо Qdrant не знайшов нічого
        if (events.length === 0) {
          this.logger.warn(
            'AiQuery: Qdrant returned 0 events, falling back to Postgres',
          )
          events = await this.loadEventsFromPostgres({ from, to, limit: topK })
          sourceUsed = 'postgres'
        }
      } else {
        this.logger.log('AiQuery: loading events from Postgres')
        events = await this.loadEventsFromPostgres({ from, to, limit: topK })
      }
    }

    const payload: AiQueryDataPayload = {
      events,
    }

    let llmError: string | null = null
    let llmResult
    try {
      llmResult = await this.callLlm(req, payload, {
        from,
        to,
        language,
        mode: req.mode ?? 'analysis',
      })
    } catch (e: any) {
      llmError = e?.message ?? String(e)
      throw e
    } finally {
      // лог AI‑запиту незалежно від успіху виклику LLM
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
      })
    }

    const answer = llmResult.answer ?? 'AI не зміг сформувати відповідь.'
    const citations = Array.isArray(llmResult.citations)
      ? llmResult.citations
      : []
    const suggestedActions = Array.isArray(llmResult.suggestedActions)
      ? llmResult.suggestedActions
      : []

    return {
      answer,
      citations,
      suggestedActions,
      meta: {
        ...(llmResult.meta ?? {}),
        resolvedFilters: {
          time: { from, to },
          types: scope.includeEvents ? ['events'] : [],
        },
      },
    }
  }

  private resolveTimeRange(
    time?: AiQueryRequest['time'],
  ): { from?: string; to?: string } {
    if (!time) return {}
    if (time.from || time.to) return { from: time.from, to: time.to }

    if (!time.preset) return {}

    const now = new Date()
    const to = now.toISOString()
    const fromDate = new Date(now)

    switch (time.preset) {
      case 'last_24h':
        fromDate.setUTCDate(now.getUTCDate() - 1)
        break
      case 'last_7d':
        fromDate.setUTCDate(now.getUTCDate() - 7)
        break
      case 'last_30d':
        fromDate.setUTCDate(now.getUTCDate() - 30)
        break
      default:
        return {}
    }

    return { from: fromDate.toISOString(), to }
  }

  private async loadEventsFromPostgres(opts: {
    from?: string
    to?: string
    limit: number
  }): Promise<AiEventSnippet[]> {
    const query: ListEventsQuery = {
      page: 1,
      pageSize: opts.limit,
      from: opts.from,
      to: opts.to,
      severity: ['high', 'critical'],
    }

    const res = await this.eventsService.listEvents(query)

    const truncate = (text: string | null | undefined, max: number): string => {
      if (!text) return ''
      if (text.length <= max) return text
      return text.slice(0, max - 1).trimEnd() + '…'
    }

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
    }))
  }

  private async callLlm(
    req: AiQueryRequest,
    data: AiQueryDataPayload,
    context: {
      from?: string
      to?: string
      language: 'uk' | 'en'
      mode: string
    },
  ): Promise<AiQueryResponse> {
    const prompt = this.buildPrompt(req, data, context)

    this.logger.log(
      `LLM call started (model=${this.model}, events=${data.events.length})`,
    )

    try {
      const resp = await fetch(
        `${this.ollamaUrl.replace(/\/$/, '')}/api/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.model,
            prompt,
            stream: false,
          }),
        },
      )

      if (!resp.ok) {
        const body = await resp.text()
        this.logger.warn(
          `LLM request failed with status ${resp.status}: ${body.slice(
            0,
            200,
          )}`,
        )
        return this.fallbackAnswer(req, data, context)
      }

      const json: any = await resp.json()
      const raw = String(json.response ?? '').trim()

      if (!raw) {
        this.logger.warn('LLM returned empty response, using fallback')
        return this.fallbackAnswer(req, data, context)
      }

      this.logger.log('LLM call finished successfully (plain markdown)')

      return {
        answer: raw,
        citations: (data.events ?? []).slice(0, 10).map((ev) => ({
          type: 'event' as const,
          id: ev.id,
          title: ev.title,
          summary: ev.summary,
        })),
        suggestedActions: [],
        meta: {
          model: this.model,
        },
      }
    } catch (err) {
      this.logger.error('Помилка виклику LLM через Ollama', err as any)
      return this.fallbackAnswer(req, data, context)
    }
  }

  private buildPrompt(
    req: AiQueryRequest,
    data: AiQueryDataPayload,
    context: {
      from?: string
      to?: string
      language: 'uk' | 'en'
      mode: string
    },
  ): string {
    const lang = context.language === 'uk' ? 'українською' : 'англійською'
    const userQuery = req.query

    const filters = {
      time: { from: context.from, to: context.to },
      scope: req.scope ?? { includeEvents: true },
      mode: context.mode,
    }

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
    }

    const dataJson = JSON.stringify(dataForPrompt)

    return `
    Ти аналітик дашборду платформи управління. Ти НЕ військовий оглядач і НЕ маєш робити загальний аналіз війни чи оперативної обстановки.

    У тебе є:
    - запит користувача (у вільній формі);
    - масив подій "events" з бази платформи (id, title, summary, type, severity, status, occurredAt, tags).
    Події вже відфільтровані (важливі / високий пріоритет), їх небагато.

    ЖОРСТКІ ОБМЕЖЕННЯ:
    - Ти МАЄШ опиратися ТІЛЬКИ на події з масиву "events".
    - Заборонено робити узагальнення про лінію фронту, бойові дії в Україні чи світі, напрямки типу "київський", "запорізький" тощо, якщо це прямо не випливає з полів подій.
    - Якщо даних у "events" мало або взагалі немає — прямо скажи про це. Нічого не вигадуй.
    - Не використовуй формулювання "оперативна обстановка", "обстановка в Україні" тощо. Говори тільки про "події дашборду", "події платформи", "зафіксовані події".

    Твоє завдання:
    1) Коротко підсумувати ситуацію ПО ПОДІЯХ ДАШБОРДУ ${lang}.
    2) Виділити головні типи подій, тренди та "вузькі місця" (наприклад: багато критичних подій без обробки, скупчення подій певного типу).
    3) Дати практичні рекомендації по роботі штабу саме з цими подіями (перевірити, поставити задачі, пріоритезувати, тощо).

    СТРУКТУРА ВІДПОВІДІ:
    - Відповідь у форматі Markdown‑тексту.
    - Рівно 3 блоки з такими заголовками:
      1. "Коротко по подіях дашборду" — 2–4 маркери з головними висновками по наданих подіях.
      2. "Деталі по подіях" — 3–6 маркерів з конкретними прикладами (які типи подій, які пріоритети, що помітно по датах/тегах).
      3. "Рекомендації для штабу" — 3–6 маркерів з діями по роботі з подіями (що перевірити, що поставити в задачі, що можна відсіяти).
    - Не вигадуй географію, якщо її немає в подіях. Якщо локації відсутні — так і пиши.
    - Не згадуй "обстановку в Україні" або будь-яку загальну картину війни — тільки те, що видно по подіях у дашборді.

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
    ${dataJson}
    >>>
    `.trim()
  }

  private fallbackAnswer(
    req: AiQueryRequest,
    data: AiQueryDataPayload,
    context: {
      from?: string
      to?: string
      language: 'uk' | 'en'
      mode: string
    },
  ): AiQueryResponse {
    const events = data.events ?? []

    const bySeverity = events.reduce<Record<string, number>>((acc, ev) => {
      acc[ev.severity] = (acc[ev.severity] ?? 0) + 1
      return acc
    }, {})

    const byType = events.reduce<Record<string, number>>((acc, ev) => {
      acc[ev.type] = (acc[ev.type] ?? 0) + 1
      return acc
    }, {})

    const total = events.length

    const severityLabel: Record<string, string> = {
      critical: 'Критичні',
      high: 'Високий пріоритет',
      medium: 'Середній пріоритет',
      low: 'Низький пріоритет',
    }

    const typeLabel: Record<string, string> = {
      equipment_movement: 'Рух колони/техніки',
      strike: 'Ураження / удар',
      combat: 'Бойові зіткнення',
      info: 'Інформаційні повідомлення',
      infoop_disinfo: 'ІПсО / дезінформація',
      strategic_aircraft: 'Стратегічна авіація',
    }

    let answer = ''
    if (context.language === 'uk') {
      answer += `### Оперативне зведення по подіях\n\n`
      answer += `**Запит аналітика:** ${req.query}\n\n`
      if (context.from || context.to) {
        answer += `**Період аналізу:** ${context.from ?? '—'} → ${
          context.to ?? '—'
        }\n\n`
      }
      answer += `**Кількість подій у вибірці:** ${total}\n\n`

      if (total > 0) {
        answer += `#### За пріоритетом\n`
        Object.entries(bySeverity).forEach(([sev, count]) => {
          const label = severityLabel[sev] ?? sev
          answer += `- ${label}: ${count}\n`
        })
        answer += `\n#### За типами (топ‑5)\n`
        Object.entries(byType)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .forEach(([type, count]) => {
            const label = typeLabel[type] ?? type
            answer += `- ${label}: ${count}\n`
          })

        answer += `\n#### Приклади подій\n`
        events.slice(0, 5).forEach((ev) => {
          const sevLabel = severityLabel[ev.severity] ?? ev.severity
          const title = ev.title || 'Без назви'
          answer += `- [${sevLabel}] ${title} (${ev.occurredAt})\n`
        })
      } else {
        answer += `За заданими фільтрами подій не знайдено.\n`
      }
    } else {
      answer += `Operational summary (fallback). Total events: ${total}.\n`
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
      meta: {
        model: 'fallback-no-llm',
      },
    }
  }
}