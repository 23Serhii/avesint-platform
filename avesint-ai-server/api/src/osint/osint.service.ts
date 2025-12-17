// api/src/osint/osint.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { OsintIngestDto } from './dto/osint-ingest.dto';
import { OsintGateway } from './osint.gateway';
import { OsintSourceEntity } from './osint-source.entity';
import { OsintItemEntity } from './osint-item.entity';
import { EventsService } from '../events/events.service';
import { QdrantService } from '../common/qdrant.service';
import { AiGeoService } from '../common/ai-geo.service';
import { AiClassificationService } from '../common/ai-classification.service';

type JsonRecord = Record<string, unknown>;

function asRecord(v: unknown): JsonRecord {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as JsonRecord)
    : {};
}

@Injectable()
export class OsintService {
  private readonly logger = new Logger(OsintService.name);

  constructor(
    private readonly gateway: OsintGateway,

    @InjectRepository(OsintSourceEntity)
    private readonly sourceRepo: Repository<OsintSourceEntity>,

    private readonly eventsService: EventsService,

    @InjectRepository(OsintItemEntity)
    private readonly itemRepo: Repository<OsintItemEntity>,

    private readonly qdrant: QdrantService,

    private readonly aiGeo: AiGeoService,
    private readonly aiClass: AiClassificationService,
  ) {}

  private readonly allowedSourceCategories = new Set([
    'official',
    'osint-team',
    'local-news',
    'enemy-prop',
    'unknown',
  ]);

  private mapPriorityToSeverity(
    priority?: OsintIngestDto['item']['priority'],
  ): 'critical' | 'high' | 'medium' | 'low' {
    switch (priority) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'high';
      case 'low':
        return 'low';
      case 'medium':
      default:
        return 'medium';
    }
  }

  async reviewOsintItem(
    osintItemId: string,
    verdict: 'confirmed' | 'disproved' | 'unknown',
  ): Promise<{
    ok: true;
    osintItemId: string;
    sourceId: string;
    sourceReliability: number;
    verdict: 'confirmed' | 'disproved' | 'unknown';
    previousVerdict: 'confirmed' | 'disproved' | 'unknown';
    updatedEvents: Array<{
      eventId: string;
      status: 'pending' | 'confirmed' | 'disproved';
    }>;
  } | null> {
    const runner = this.itemRepo.manager.connection.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();

    try {
      const item = await runner.manager.findOne(OsintItemEntity, {
        where: { id: osintItemId },
      });
      if (!item) {
        await runner.rollbackTransaction();
        return null;
      }

      const source = await runner.manager.findOne(OsintSourceEntity, {
        where: { id: item.sourceId },
      });
      if (!source) {
        await runner.rollbackTransaction();
        return null;
      }

      const meta = asRecord(item.meta);
      const review = asRecord(meta.review);
      const prev =
        typeof review.verdict === 'string'
          ? (review.verdict as 'confirmed' | 'disproved' | 'unknown')
          : 'unknown';

      if (prev !== verdict) {
        if (prev === 'confirmed') {
          source.confirmedItems = Math.max(0, source.confirmedItems - 1);
        }
        if (prev === 'disproved') {
          source.disprovedItems = Math.max(0, source.disprovedItems - 1);
        }

        if (verdict === 'confirmed') source.confirmedItems += 1;
        if (verdict === 'disproved') source.disprovedItems += 1;

        const updatedSource = this.recalcSourceReliability(source);

        item.meta = {
          ...meta,
          review: {
            ...review,
            verdict,
            reviewedAt: new Date().toISOString(),
          },
        };

        await runner.manager.save(OsintSourceEntity, updatedSource);
        await runner.manager.save(OsintItemEntity, item);
      }

      const eventIdsRes = await runner.query(
        `
          SELECT event_id
          FROM event_evidence
          WHERE osint_item_id = $1
        `,
        [osintItemId],
      );

      const eventIds = Array.isArray(eventIdsRes)
        ? eventIdsRes.map((r: unknown) => String((r as any).event_id))
        : [];

      const updatedEvents: Array<{
        eventId: string;
        status: 'pending' | 'confirmed' | 'disproved';
      }> = [];

      for (const eventId of eventIds) {
        const countsRes = await runner.query(
          `
            SELECT
              SUM(CASE WHEN (i.meta->'review'->>'verdict') = 'confirmed' THEN 1 ELSE 0 END) AS confirmed_cnt,
              SUM(CASE WHEN (i.meta->'review'->>'verdict') = 'disproved' THEN 1 ELSE 0 END) AS disproved_cnt
            FROM event_evidence ee
            JOIN osint_items i ON i.id = ee.osint_item_id
            WHERE ee.event_id = $1
          `,
          [eventId],
        );

        const row =
          Array.isArray(countsRes) && countsRes.length > 0 ? countsRes[0] : {};
        const confirmedCnt = Number((row as any).confirmed_cnt ?? 0);
        const disprovedCnt = Number((row as any).disproved_cnt ?? 0);

        let nextStatus: 'pending' | 'confirmed' | 'disproved' = 'pending';
        if (confirmedCnt > 0 && disprovedCnt === 0) nextStatus = 'confirmed';
        else if (disprovedCnt > 0 && confirmedCnt === 0)
          nextStatus = 'disproved';
        else nextStatus = 'pending';

        await runner.query(
          `
            UPDATE events
            SET status = $2, updated_at = now()
            WHERE id = $1
          `,
          [eventId, nextStatus],
        );

        updatedEvents.push({ eventId, status: nextStatus });
      }

      const freshSource = await runner.manager.findOne(OsintSourceEntity, {
        where: { id: source.id },
      });

      await runner.commitTransaction();

      return {
        ok: true,
        osintItemId: item.id,
        sourceId: source.id,
        sourceReliability: freshSource?.reliability ?? source.reliability,
        verdict,
        previousVerdict: prev,
        updatedEvents,
      };
    } catch (e) {
      await runner.rollbackTransaction();
      throw e;
    } finally {
      await runner.release();
    }
  }

  private recalcSourceReliability(
    source: OsintSourceEntity,
  ): OsintSourceEntity {
    if (source.totalItems <= 0) {
      source.reliability = 0.5;
      return source;
    }

    const greyItems =
      source.totalItems - source.confirmedItems - source.disprovedItems;

    const raw = (source.confirmedItems + 0.5 * greyItems) / source.totalItems;

    source.reliability = Math.max(0, Math.min(1, raw));
    return source;
  }

  private buildShortTitle(dto: OsintIngestDto): string {
    const baseForTitle = dto.item.title || dto.item.summary || dto.item.content;
    let title = String(baseForTitle ?? '').trim();

    const firstSentenceMatch = title.match(/^(.+?[.!?])\s/u);
    if (firstSentenceMatch) {
      title = firstSentenceMatch[1];
    }

    const MAX_TITLE_LEN = 80;
    if (title.length > MAX_TITLE_LEN) {
      title = title.slice(0, MAX_TITLE_LEN - 1).trimEnd() + '…';
    }

    return title || 'OSINT‑подія';
  }

  private buildFullText(dto: OsintIngestDto): string {
    return [
      dto.item.title ?? '',
      dto.item.summary ?? '',
      dto.item.content ?? '',
    ]
      .join('\n')
      .trim();
  }

  async ingest(dto: OsintIngestDto) {
    let source = await this.upsertSource(dto.source);

    const osintItem = await this.createOsintItem(source, dto.item);

    source.totalItems += 1;
    source = this.recalcSourceReliability(source);
    await this.sourceRepo.save(source);

    const severity = this.mapPriorityToSeverity(dto.item.priority);
    const occurredAt = dto.item.eventDate ?? dto.item.parseDate;

    const fullText = this.buildFullText(dto);
    const summary = dto.item.summary || dto.item.content;
    const title = this.buildShortTitle(dto);

    const [geoPoint, classification] = await Promise.all([
      this.aiGeo.extractLocation(fullText),
      this.aiClass.classify(fullText),
    ]);

    const dedupQueryText = [
      dto.item.type ?? 'osint_report',
      summary ?? '',
      dto.item.content ?? '',
    ]
      .join('\n')
      .trim();

    const candidate = await this.eventsService.findDedupCandidate({
      queryText: dedupQueryText,
      type: dto.item.type || 'osint_report',
      occurredAtIso: occurredAt,
      latitude: geoPoint?.latitude ?? null,
      longitude: geoPoint?.longitude ?? null,
    });

    let event = null as Awaited<ReturnType<EventsService['getEventById']>>;

    if (candidate) {
      const existingEvent = await this.eventsService.getEventById(
        candidate.eventId,
      );

      if (existingEvent) {
        const { inserted } = await this.eventsService.attachEvidence({
          eventId: candidate.eventId,
          osintItemId: osintItem.id,
          relation: 'support',
          weight:
            typeof dto.item.credibility === 'number'
              ? dto.item.credibility
              : null,
        });

        this.logger.log(
          `attachEvidence(dedup) eventId=${candidate.eventId} osintItemId=${osintItem.id} inserted=${inserted}`,
        );

        await this.itemRepo.manager.query(
          `
            UPDATE events
            SET updated_at = now()
            WHERE id = $1
          `,
          [candidate.eventId],
        );

        event = existingEvent;
      } else {
        this.logger.warn(
          `Dedup candidate points to missing event in DB: ${candidate.eventId} (will create new event)`,
        );
      }
    }

    if (!event) {
      const fingerprint = this.eventsService.buildFingerprint({
        type: dto.item.type || 'osint_report',
        occurredAtIso: occurredAt,
        latitude: geoPoint?.latitude ?? null,
        longitude: geoPoint?.longitude ?? null,
      });

      const created = await this.eventsService.createEvent(
        {
          title,
          summary,
          description: dto.item.content,
          type: dto.item.type || 'osint_report',
          severity,
          status: 'pending',
          occurredAt,
          confidence: dto.item.credibility ?? undefined,
          externalRef: dto.item.externalId,
          latitude: geoPoint?.latitude ?? undefined,
          longitude: geoPoint?.longitude ?? undefined,
          imageUrl: dto.item.mediaUrl ?? undefined,
          tags: dto.item.tags ?? null,
          fingerprint,
        } as any,
        undefined,
        null,
      );

      const { inserted } = await this.eventsService.attachEvidence({
        eventId: created.id,
        osintItemId: osintItem.id,
        relation: 'support',
        weight:
          typeof dto.item.credibility === 'number'
            ? dto.item.credibility
            : null,
      });

      this.logger.log(
        `attachEvidence(created) eventId=${created.id} osintItemId=${osintItem.id} inserted=${inserted}`,
      );

      event = created;
    }

    const isRoutine = this.qdrant.isRoutineFromPayload({
      tags: osintItem.tags ?? undefined,
      aiClassification: classification ?? undefined,
    });

    void this.qdrant.upsertOsintItem({
      id: osintItem.id,
      type: 'osint',
      title: osintItem.title,
      summary: osintItem.summary,
      content: osintItem.content,
      time: osintItem.parseDate.toISOString(),
      severity: event?.severity ?? severity,
      status: event?.status ?? 'pending',
      sourceName: source.name,
      tags: osintItem.tags ?? [],
      aiClassification: classification ?? null,
      isRoutine,
    });

    if (event?.id) {
      void this.qdrant.upsertEvent({
        id: event.id,
        title: event.title ?? null,
        summary: event.summary ?? null,
        description: event.description ?? null,
        time: event.occurredAt,
        severity: event.severity ?? null,
        status: event.status ?? null,
        latitude: event.latitude ?? null,
        longitude: event.longitude ?? null,
        tags: osintItem.tags ?? null,
        aiClassification: classification ?? null,
        sourceName: source.name,
        isRoutine,
      });
    }

    this.gateway.broadcastNewItem({
      id: osintItem.id,
      source: {
        id: source.id,
        name: source.name,
        category: source.category ?? undefined,
      },
      item: {
        externalId: osintItem.externalId,
        kind: osintItem.kind as any,
        title: osintItem.title ?? undefined,
        content: osintItem.content,
        summary: osintItem.summary ?? undefined,
        language: osintItem.language ?? undefined,
        priority: osintItem.priority as any,
        type: osintItem.type ?? undefined,
        category: osintItem.category ?? undefined,
        tags: osintItem.tags ?? [],
        credibility: osintItem.credibility ?? undefined,
        parseDate: osintItem.parseDate.toISOString(),
        eventDate: osintItem.eventDate
          ? osintItem.eventDate.toISOString()
          : undefined,
        rawUrl: osintItem.rawUrl ?? undefined,
        mediaUrl: osintItem.mediaUrl ?? undefined,
        meta: {
          ...(osintItem.meta ?? {}),
          aiClassification: classification ?? undefined,
          dedup:
            candidate && event?.id === candidate.eventId
              ? {
                  matchedEventId: candidate.eventId,
                  qdrantScore: candidate.score,
                }
              : { createdEventId: event?.id },
        },
      },
    });

    return {
      status: 'ok',
      osintItemId: osintItem.id,
      eventId: event?.id ?? null,
    };
  }

  private async upsertSource(src: OsintIngestDto['source']) {
    let existing = await this.sourceRepo.findOne({
      where: { externalId: src.externalId },
    });

    const incomingCategory =
      typeof src.category === 'string' ? src.category.trim() : null;

    const safeIncomingCategory =
      incomingCategory && this.allowedSourceCategories.has(incomingCategory)
        ? incomingCategory
        : null;

    if (!existing) {
      existing = this.sourceRepo.create({
        externalId: src.externalId,
        type: src.type,
        name: src.name,
        url: src.url ?? null,
        category: safeIncomingCategory ?? null,
        reliability: 0.5,
        totalItems: 0,
        confirmedItems: 0,
        disprovedItems: 0,
      });
    } else {
      existing.name = src.name;
      existing.type = src.type;
      existing.url = src.url ?? existing.url ?? null;

      if (!existing.category && safeIncomingCategory) {
        existing.category = safeIncomingCategory;
      }
    }

    return this.sourceRepo.save(existing);
  }

  private async createOsintItem(
    source: OsintSourceEntity,
    item: OsintIngestDto['item'],
  ): Promise<OsintItemEntity> {
    const existing = await this.itemRepo.findOne({
      where: { externalId: item.externalId },
    });

    if (existing) {
      existing.title = item.title ?? existing.title ?? null;
      existing.content = item.content ?? existing.content;
      existing.summary = item.summary ?? existing.summary ?? null;
      existing.language = item.language ?? existing.language ?? null;
      existing.priority = item.priority ?? existing.priority ?? null;
      existing.type = item.type ?? existing.type ?? null;
      existing.category = item.category ?? existing.category ?? null;
      existing.tags = item.tags ?? existing.tags ?? null;
      existing.credibility =
        typeof item.credibility === 'number'
          ? item.credibility
          : existing.credibility;
      existing.parseDate = item.parseDate
        ? new Date(item.parseDate)
        : existing.parseDate;
      existing.eventDate = item.eventDate
        ? new Date(item.eventDate)
        : existing.eventDate;
      existing.rawUrl = item.rawUrl ?? existing.rawUrl ?? null;
      existing.mediaUrl = item.mediaUrl ?? existing.mediaUrl ?? null;
      existing.meta = item.meta ?? existing.meta ?? null;

      return this.itemRepo.save(existing);
    }

    const parseDate = new Date(item.parseDate);
    const eventDate = item.eventDate ? new Date(item.eventDate) : null;

    const entity = this.itemRepo.create({
      source, // ✅ КРИТИЧНО: так заповниться source_id
      externalId: item.externalId,
      kind: item.kind,
      title: item.title ?? null,
      content: item.content,
      summary: item.summary ?? null,
      language: item.language ?? null,
      priority: item.priority ?? null,
      type: item.type ?? null,
      category: item.category ?? null,
      tags: item.tags ?? null,
      credibility:
        typeof item.credibility === 'number' ? item.credibility : null,
      parseDate,
      eventDate,
      rawUrl: item.rawUrl ?? null,
      mediaUrl: item.mediaUrl ?? null,
      meta: item.meta ?? null,
    });

    return this.itemRepo.save(entity);
  }
}
