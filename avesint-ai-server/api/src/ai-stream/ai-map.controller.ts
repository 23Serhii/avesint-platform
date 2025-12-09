import { Controller, Get, Query } from '@nestjs/common';
import { QdrantService } from '../common/qdrant.service';

type AiMapEventDto = {
  id: string;
  title: string | null;
  summary: string | null;
  time: string | null;
  severity: string | null;
  status: string | null;
  latitude: number;
  longitude: number;
  tags: string[];
};

@Controller('ai/map')
export class AiMapController {
  constructor(private readonly qdrant: QdrantService) {}

  @Get('events')
  async listEventsForMap(
    @Query('limit') limitRaw?: string,
    @Query('status') statusRaw?: string,
  ): Promise<AiMapEventDto[]> {
    const limit = Math.min(
      Math.max(parseInt(limitRaw ?? '300', 10) || 300, 1),
      1000,
    );

    const status = statusRaw && statusRaw.trim() ? statusRaw : 'confirmed';

    const hits = await this.qdrant.searchIntelligence({
      query: undefined,
      limit,
      docTypes: ['event'],
      status,
      hasGeo: true,
      isRoutine: false,
    });

    const items: AiMapEventDto[] = hits
      .map((hit) => {
        const p = hit.payload;
        if (typeof p.latitude !== 'number' || typeof p.longitude !== 'number') {
          return null;
        }

        return {
          id: String(p.docId ?? hit.id),
          title: p.title ?? null,
          summary: p.summary ?? null,
          time: p.time ?? null,
          severity: p.severity ?? null,
          status: p.status ?? null,
          latitude: p.latitude,
          longitude: p.longitude,
          tags: Array.isArray(p.tags) ? p.tags : [],
        };
      })
      .filter((x): x is AiMapEventDto => x !== null);

    return items;
  }
}
