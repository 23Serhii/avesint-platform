// api/src/osint/osint.service.ts
import { Injectable } from '@nestjs/common';
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

@Injectable()
export class OsintService {
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

  // Проста утиліта для перерахунку reliability на основі лічильників
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

    // Страхуємо від виходу за межі [0,1]
    source.reliability = Math.max(0, Math.min(1, raw));
    return source;
  }

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

  async ingest(dto: OsintIngestDto) {
    let source = await this.upsertSource(dto.source);

    const osintItem = await this.createOsintItem(source, dto.item);

    source.totalItems += 1;
    source = this.recalcSourceReliability(source);
    await this.sourceRepo.save(source);

    const severity = this.mapPriorityToSeverity(dto.item.priority);
    const occurredAt = dto.item.eventDate ?? dto.item.parseDate;

    // 🔹 1) Повний текст
    const fullText =
      (dto.item.title ?? '') +
      '\n' +
      (dto.item.summary ?? '') +
      '\n' +
      dto.item.content;

    // 🔹 2) Summary – як і раніше
    const summary = dto.item.summary || dto.item.content;

    // 🔹 3) Короткий заголовок: окремо формуємо з summary / content
    const baseForTitle = dto.item.title || dto.item.summary || dto.item.content;
    let title = baseForTitle.trim();

    // беремо перше речення до крапки/знака питання/оклику
    const firstSentenceMatch = title.match(/^(.+?[.!?])\s/u);
    if (firstSentenceMatch) {
      title = firstSentenceMatch[1];
    }

    // обрізаємо до 80 символів, щоб не було «стіни тексту» в заголовку
    const MAX_TITLE_LEN = 80;
    if (title.length > MAX_TITLE_LEN) {
      title = title.slice(0, MAX_TITLE_LEN - 1).trimEnd() + '…';
    }

    // fallback, якщо раптом все пусте
    if (!title) {
      title = 'OSINT‑подія';
    }

    // 1) AI геолокація
    const geoPoint = await this.aiGeo.extractLocation(fullText);

    // 2) AI класифікація події
    const classification = await this.aiClass.classify(fullText);

    // 3) Створюємо Event з координатами
    const event = await this.eventsService.createEvent(
      {
        title,
        summary,
        description: dto.item.content, // 🔹 повний текст у description
        type: dto.item.type || 'osint_report',
        severity,
        status: 'pending',
        occurredAt,
        confidence: dto.item.credibility ?? undefined,
        externalRef: dto.item.externalId,
        latitude: geoPoint?.latitude ?? undefined,
        longitude: geoPoint?.longitude ?? undefined,
        imageUrl: dto.item.mediaUrl ?? undefined,
      } as any,
      undefined,
      null,
    );

    // 4) Визначаємо, чи це "рутинна" подія
    const isRoutine = this.qdrant.isRoutineFromPayload({
      tags: osintItem.tags ?? undefined,
      aiClassification: classification ?? undefined,
    });

    // 5) Пушимо OSINT в Qdrant
    void this.qdrant.upsertOsintItem({
      id: osintItem.id,
      type: 'osint',
      title: osintItem.title,
      summary: osintItem.summary,
      content: osintItem.content,
      time: osintItem.parseDate.toISOString(),
      severity: event.severity,
      status: event.status,
      sourceName: source.name,
      tags: osintItem.tags ?? [],
      aiClassification: classification ?? null,
      isRoutine,
    });

    // 6) Пишемо Event в Qdrant
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

    // 7) Відправляємо по WebSocket (як було)
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
        },
      },
    });

    return { status: 'ok', osintItemId: osintItem.id };
  }

  // 🔹 Повертаємо upsertSource з попередньої версії
  private async upsertSource(src: OsintIngestDto['source']) {
    let existing = await this.sourceRepo.findOne({
      where: { externalId: src.externalId },
    });

    if (!existing) {
      existing = this.sourceRepo.create({
        externalId: src.externalId,
        type: src.type,
        name: src.name,
        url: src.url ?? null,
        category: src.category ?? null,
        // reliability поки базово 0.5, далі будемо міняти від верифікацій
        reliability: 0.5,
        totalItems: 0,
        confirmedItems: 0,
        disprovedItems: 0,
      });
    } else {
      existing.name = src.name;
      existing.type = src.type;
      existing.url = src.url ?? existing.url ?? null;
      existing.category = src.category ?? existing.category ?? null;
    }

    return this.sourceRepo.save(existing);
  }

  // 🔹 Повертаємо createOsintItem з попередньої версії
  private async createOsintItem(
    source: OsintSourceEntity,
    item: OsintIngestDto['item'],
  ): Promise<OsintItemEntity> {
    // Спочатку перевіряємо, чи такий externalId вже є
    const existing = await this.itemRepo.findOne({
      where: { externalId: item.externalId },
    });

    // Якщо вже існує — оновлюємо "мʼякі" поля
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

    // Якщо запису ще немає – створюємо новий
    const parseDate = new Date(item.parseDate);
    const eventDate = item.eventDate ? new Date(item.eventDate) : null;

    const entity = this.itemRepo.create({
      sourceId: source.id,
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
