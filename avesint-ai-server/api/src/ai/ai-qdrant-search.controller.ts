// src/ai/ai-qdrant-search.controller.ts
import { Body, Controller, Post, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { AiQdrantSearchService } from './ai-qdrant-search.service'
import type { AiQueryRequest, AiEventSnippet } from './ai-query.types'

@Controller('ai/qdrant')
@UseGuards(JwtAuthGuard)
export class AiQdrantSearchController {
  constructor(private readonly qdrantSearch: AiQdrantSearchService) {}

  @Post('events')
  async searchEvents(
    @Body()
    body: {
      query: AiQueryRequest['query']
      time?: AiQueryRequest['time']
      scope?: AiQueryRequest['scope']
      topK?: number
    },
  ): Promise<AiEventSnippet[]> {
    const req: AiQueryRequest = {
      query: body.query,
      time: body.time,
      scope: body.scope,
      language: 'uk',
      topKPerType: body.topK ?? 20,
    }

    const { time } = req
    const from = time?.from
    const to = time?.to

    return this.qdrantSearch.searchEventsForAi({
      req,
      from,
      to,
      limit: body.topK ?? 20,
    })
  }
}