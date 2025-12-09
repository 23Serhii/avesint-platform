// api/src/ai-stream/ai-search.controller.ts
import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { QdrantService } from '../common/qdrant.service';

type AiSearchRequestDto = {
  query: string;
  limit?: number;
};

type AiSearchResultItem = {
  id: string;
  score: number;
  title: string | null;
  summary: string | null;
  content: string;
  time: string | null;
  severity: string | null;
  status: string | null;
  sourceName: string | null;
  tags: string[];
};

type AiSearchResponseDto = {
  items: AiSearchResultItem[];
};

@Controller('ai-search')
export class AiSearchController {
  constructor(private readonly qdrant: QdrantService) {}

  @Post('osint')
  async searchOsint(
    @Body() body: AiSearchRequestDto,
  ): Promise<AiSearchResponseDto> {
    const query = (body.query ?? '').trim();
    const limit = body.limit ?? 10;

    if (!query) {
      throw new BadRequestException('query is required');
    }

    const hits = await this.qdrant.searchOsint({ query, limit });

    const items: AiSearchResultItem[] = hits.map((hit) => ({
      id: hit.payload.docId ?? hit.id,
      score: hit.score,
      title: hit.payload.title ?? null,
      summary: hit.payload.summary ?? null,
      content: hit.payload.content ?? '',
      time: hit.payload.time ?? null,
      severity: hit.payload.severity ?? null,
      status: hit.payload.status ?? null,
      sourceName: hit.payload.sourceName ?? null,
      tags: hit.payload.tags ?? [],
    }));

    return { items };
  }
}
