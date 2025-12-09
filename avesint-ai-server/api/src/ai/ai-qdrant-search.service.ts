// src/ai/ai-qdrant-search.service.ts
import { Injectable, Logger } from '@nestjs/common'
import type { AiEventSnippet, AiQueryRequest } from './ai-query.types'

type QdrantPoint = {
  id: string | number
  score: number
  payload: {
    title?: string | null
    summary?: string | null
    description?: string | null
    time?: string | null
    severity?: string | null
    status?: string | null
    latitude?: number | null
    longitude?: number | null
    tags?: string[] | null
    sourceName?: string | null
    aiClassification?: any
    isRoutine?: boolean | null
    type?: string | null
  }
}

// 🔹 окремий тип для іменованого вектору
type QdrantNamedVector = {
  name: string
  vector: number[]
}

type QdrantSearchRequest = {
  vector: QdrantNamedVector
  limit: number
  filter?: any
  with_payload?: boolean
  with_vector?: boolean
  score_threshold?: number
}

type QdrantSearchResponse = {
  result: QdrantPoint[]
  time: number
  status: string
}

@Injectable()
export class AiQdrantSearchService {
  private readonly logger = new Logger(AiQdrantSearchService.name)

  private readonly qdrantUrl =
    process.env.QDRANT_URL ?? 'http://localhost:6333'
  private readonly eventsCollection =
    process.env.QDRANT_EVENTS_COLLECTION ?? 'intelligence_items'

  private readonly ollamaUrl =
    process.env.OLLAMA_URL ?? 'http://localhost:11434'
  private readonly embedModel =
    process.env.AI_EMBED_MODEL ??
    process.env.AI_QUERY_MODEL ??
    process.env.LLM_MODEL ??
    'nomic-embed-text'

  async searchEventsForAi(opts: {
    req: AiQueryRequest
    from?: string
    to?: string
    limit: number
  }): Promise<AiEventSnippet[]> {
    const { req, from, to, limit } = opts

    const filters: any[] = []

    // if (from) {
    //   filters.push({
    //     key: 'time',
    //     range: { gte: from },
    //   })
    // }
    // if (to) {
    //   filters.push({
    //     key: 'time',
    //     range: { lte: to },
    //   })
    // }
    //
    // filters.push({
    //   key: 'severity',
    //   match: {
    //     any: ['high', 'critical'],
    //   },
    // })

    const filter =
      filters.length > 0
        ? {
          must: filters,
        }
        : undefined

    const vector = await this.embedQuery(req)
    if (!vector) {
      this.logger.warn(
        'AiQdrantSearch: embedQuery failed, falling back to dummy vector + filter‑only',
      )
    }

    const body: QdrantSearchRequest = {
      vector: {
        name: 'text',            // імʼя вектора з колекції intelligence_items
        vector: vector ?? [0],   // якщо ембед не вдалось отримати
      },
      limit,
      filter,
      with_payload: true,
      with_vector: false,
      score_threshold: 0.0,
    }

    const url = `${this.qdrantUrl.replace(
      /\/$/,
      '',
    )}/collections/${encodeURIComponent(
      this.eventsCollection,
    )}/points/search`

    this.logger.log(
      `Qdrant semantic search started (collection=${this.eventsCollection}, limit=${limit}, hasVector=${!!vector})`,
    )

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!resp.ok) {
        const text = await resp.text()
        this.logger.warn(
          `Qdrant search failed with status ${resp.status}: ${text.slice(
            0,
            200,
          )}`,
        )
        return []
      }

      const data = (await resp.json()) as QdrantSearchResponse
      const result = Array.isArray(data.result) ? data.result : []

      this.logger.log(
        `Qdrant search returned ${result.length} points in ${
          data.time ?? '?'
        }s`,
      )

      const truncate = (text: string | null | undefined, max: number): string => {
        if (!text) return ''
        if (text.length <= max) return text
        return text.slice(0, max - 1).trimEnd() + '…'
      }

      const snippets: AiEventSnippet[] = result.map((p) => {
        const id =
          typeof p.id === 'number' ? String(p.id) : (p.id as string | undefined) ?? ''
        const payload = p.payload ?? {}

        const title = truncate(payload.title ?? undefined, 80) || 'Без назви'
        const summary = truncate(payload.summary ?? undefined, 140) || undefined

        return {
          id,
          title,
          summary,
          description: undefined,
          type: payload.type ?? 'other_enemy_activity',
          severity: payload.severity ?? 'medium',
          status: payload.status ?? 'pending',
          occurredAt: payload.time ?? new Date().toISOString(),
          latitude: payload.latitude ?? undefined,
          longitude: payload.longitude ?? undefined,
          tags: payload.tags ?? undefined,
        }
      })

      return snippets
    } catch (err) {
      this.logger.error('Qdrant search error', err as any)
      return []
    }
  }

  // embedQuery лишається як у тебе зараз
  private async embedQuery(req: AiQueryRequest): Promise<number[] | null> {
    const text = req.query?.trim()
    if (!text) return null

    this.logger.log(
      `AiQdrantSearch: embedding query with model=${this.embedModel}`,
    )

    try {
      const resp = await fetch(
        `${this.ollamaUrl.replace(/\/$/, '')}/api/embeddings`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.embedModel,
            prompt: text,
          }),
        },
      )

      if (!resp.ok) {
        const body = await resp.text()
        this.logger.warn(
          `Ollama embeddings failed with status ${
            resp.status
          }: ${body.slice(0, 200)}`,
        )
        return null
      }

      const data: any = await resp.json()
      const vector = data?.embedding as number[] | undefined
      if (!Array.isArray(vector) || vector.length === 0) {
        this.logger.warn('Ollama embeddings returned empty vector')
        return null
      }

      return vector
    } catch (err) {
      this.logger.error('Ollama embeddings error', err as any)
      return null
    }
  }
}