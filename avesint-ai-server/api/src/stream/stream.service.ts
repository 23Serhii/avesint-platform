// api/src/stream/stream.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { pool } from '../db';
import { EventsService } from '../events/events.service';
import { OsintItemEntity } from '../osint/osint-item.entity';
import type {
  IntelligenceItemDto,
  StreamQueryDto,
  StreamResponseDto,
  ReviewStreamItemDto,
} from './dto/intelligence-item.dto';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { QdrantService } from '../common/qdrant.service';

@Injectable()
export class StreamService {
  constructor(
    private readonly eventsService: EventsService,
    @InjectRepository(OsintItemEntity)
    private readonly osintItemRepo: Repository<OsintItemEntity>,
    private readonly qdrant: QdrantService,
  ) {}

  async list(query: StreamQueryDto): Promise<StreamResponseDto> {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const offset = (page - 1) * limit;

    const type = query.type ?? null;
    const status = query.status ?? null;

    const countResult = await pool.query(
      `
                SELECT COUNT(*) AS total
                FROM events e
                WHERE
                    ($1::text IS NULL OR e.status = $1) AND
                    ($2::text IS NULL OR e.type = $2)
            `,
      [status, type],
    );

    const total = Number(countResult.rows[0]?.total ?? 0);

    const result = await pool.query(
      `
                SELECT
                    e.id,
                    e.title,
                    e.summary,
                    e.status,
                    e.severity,
                    e.occurred_at,
                    e.confidence,
                    e.latitude,
                    e.longitude,
                    e.external_ref,
                    oi.tags,
                    oi.meta
                FROM events e
                         LEFT JOIN osint_items oi
                                   ON oi."externalId" = e.external_ref  -- <─ ВАЖЛИВО: "externalId", а не external_id
                WHERE
                    ($1::text IS NULL OR e.status = $1) AND
                    ($2::text IS NULL OR e.type = $2)
                ORDER BY e.occurred_at DESC
                    LIMIT $3 OFFSET $4
            `,
      [status, type, limit, offset],
    );

    const items: IntelligenceItemDto[] = result.rows.map((row: any) => {
      const meta = (row.meta ?? null) as { aiClassification?: any } | null;

      const dto: IntelligenceItemDto = {
        id: String(row.id),
        type: 'event',
        title: row.title,
        summary: row.summary,
        time: row.occurred_at.toISOString(),
        status: row.status,
        confidence: row.confidence !== null ? Number(row.confidence) : null,
        latitude: row.latitude !== null ? Number(row.latitude) : null,
        longitude: row.longitude !== null ? Number(row.longitude) : null,
        source: null,
        externalRef: row.external_ref ?? null,
        tags: row.tags ?? null,
        aiClassification: meta?.aiClassification ?? null,
      };

      return dto;
    });

    return { items, page, limit };
  }

  /**
   * Зберігає рішення аналітика по елементу стріму:
   * - оновлює статус події в таблиці events;
   * - зберігає review у meta відповідного osint_item.
   */
  async reviewItem(
    id: string,
    body: ReviewStreamItemDto,
    actor?: JwtPayload,
    ip?: string | null,
  ): Promise<IntelligenceItemDto | null> {
    const updatedEvent = await this.eventsService.updateEvent(
      id,
      { status: body.status } as any,
      actor,
      ip,
    );

    if (!updatedEvent) {
      return null;
    }

    if (updatedEvent.externalRef) {
      const osintItem = await this.osintItemRepo.findOne({
        where: { externalId: updatedEvent.externalRef },
      });

      if (osintItem) {
        const currentMeta = (osintItem.meta ?? {}) as Record<string, any>;

        const reviewPayload = {
          status: body.status,
          priority: body.priority ?? null,
          tags: body.tags ?? [],
          comment: body.comment ?? null,
          reviewerId: actor?.sub ?? null,
          reviewedAt: new Date().toISOString(),
        };

        osintItem.meta = {
          ...currentMeta,
          review: reviewPayload,
        };

        if (Array.isArray(body.tags)) {
          osintItem.tags = body.tags;
        }

        await this.osintItemRepo.save(osintItem);
      }
    }

    // оновлюємо Event у Qdrant (щоб статус і теги були актуальні)
    void this.qdrant.upsertEvent({
      id: updatedEvent.id,
      title: updatedEvent.title ?? null,
      summary: updatedEvent.summary ?? null,
      description: updatedEvent.description ?? null,
      time: updatedEvent.occurredAt,
      severity: updatedEvent.severity ?? null,
      status: updatedEvent.status ?? null,
      latitude: updatedEvent.latitude ?? null,
      longitude: updatedEvent.longitude ?? null,
      // поле tags у updatedEvent відсутнє, тому не передаємо його сюди
      aiClassification: (updatedEvent as any).meta?.aiClassification ?? null,
      sourceName: null,
    });

    const dto: IntelligenceItemDto = {
      id: updatedEvent.id,
      type: 'event',
      title: updatedEvent.title,
      summary: updatedEvent.summary,
      time: updatedEvent.occurredAt,
      status: updatedEvent.status,
      confidence: updatedEvent.confidence ?? null,
      latitude: updatedEvent.latitude ?? null,
      longitude: updatedEvent.longitude ?? null,
      source: null,
      externalRef: updatedEvent.externalRef ?? null,
      tags: null,
      aiClassification: null,
    };

    return dto;
  }
}
