// api/src/scripts/qdrant-sync-osint.ts

import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { OsintService } from '../osint/osint.service';
import type { OsintIngestDto } from '../osint/dto/osint-ingest.dto';

// -------- Qdrant config --------

const QDRANT_URL = process.env.QDRANT_URL ?? 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION ?? 'osint_items'; // ← підлаштуй під свою колекцію

type QdrantPoint = {
  id: string | number;
  payload?: Record<string, any>;
};

type QdrantScrollResponse = {
  points: QdrantPoint[];
  next_page_offset?: number;
};

// -------- Локальний payload-тип, який ми очікуємо в Qdrant --------

type QdrantOsintPayload = {
  sourceExternalId: string;
  sourceType?: string;
  sourceName: string;
  sourceUrl?: string;
  sourceCategory?: string;

  itemExternalId: string;
  kind: 'text' | 'video' | 'image' | 'infra' | 'other';
  title?: string;
  content: string;
  summary?: string;
  language?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  type?: string;
  category?: string;
  tags?: string[];
  credibility?: number;
  parseDate: string;
  eventDate?: string;
  rawUrl?: string;
  mediaUrl?: string;
  meta?: Record<string, unknown>;
};

// Мапимо payload з Qdrant → OsintIngestDto
function mapPayloadToOsintDto(p: QdrantOsintPayload): OsintIngestDto {
  return {
    source: {
      externalId: p.sourceExternalId,
      type: p.sourceType ?? 'osint_tool',
      name: p.sourceName,
      url: p.sourceUrl,
      category: p.sourceCategory,
    },
    item: {
      externalId: p.itemExternalId,
      kind: p.kind,
      title: p.title,
      content: p.content,
      summary: p.summary,
      language: p.language,
      priority: p.priority,
      type: p.type,
      category: p.category,
      tags: p.tags,
      credibility: p.credibility,
      parseDate: p.parseDate,
      eventDate: p.eventDate,
      rawUrl: p.rawUrl,
      mediaUrl: p.mediaUrl,
      meta: p.meta,
    },
  };
}

// Виклик REST scroll до Qdrant
async function scrollQdrant(
  limit: number,
  offset?: number,
): Promise<QdrantScrollResponse> {
  const url = `${QDRANT_URL}/collections/${encodeURIComponent(
    QDRANT_COLLECTION,
  )}/points/scroll`;

  const body: any = {
    limit,
    with_payload: true,
    with_vector: false,
  };
  if (offset !== undefined) {
    body.offset = offset;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (QDRANT_API_KEY) {
    headers['api-key'] = QDRANT_API_KEY;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Qdrant scroll failed: ${res.status} ${res.statusText} - ${text}`,
    );
  }

  const json = (await res.json()) as QdrantScrollResponse;
  return json;
}

// Витягнути всі поінти з Qdrant
async function fetchAllPoints(): Promise<QdrantPoint[]> {
  const result: QdrantPoint[] = [];
  let offset: number | undefined = undefined;

  while (true) {
    const { points, next_page_offset } = await scrollQdrant(256, offset);
    if (!points || points.length === 0) break;

    result.push(...points);
    console.log(
      `Fetched ${points.length} points (total so far: ${result.length})`,
    );

    if (next_page_offset === undefined) break;
    offset = next_page_offset;
  }

  return result;
}

async function main() {
  console.log('Starting Qdrant → Osint/Postgres sync...');
  console.log(`Qdrant: ${QDRANT_URL}, collection: ${QDRANT_COLLECTION}`);

  const points = await fetchAllPoints();
  console.log(`Total points from Qdrant: ${points.length}`);

  if (points.length === 0) {
    console.log('No points to sync, exiting.');
    return;
  }

  // Піднімаємо Nest-контекст, щоб отримати OsintService
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const osintService = app.get(OsintService);

  let ok = 0;
  let failed = 0;

  for (const pt of points) {
    try {
      const payload = pt.payload ?? {};

      // TODO: підлаштуй під свій payload у Qdrant
      const dto = mapPayloadToOsintDto({
        sourceExternalId:
          payload.sourceExternalId ?? payload.source_id ?? 'unknown:source',
        sourceType: payload.sourceType,
        sourceName: payload.sourceName ?? 'Unknown source',
        sourceUrl: payload.sourceUrl,
        sourceCategory: payload.sourceCategory,

        itemExternalId:
          payload.itemExternalId ?? payload.externalId ?? String(pt.id),
        kind: payload.kind ?? 'text',
        title: payload.title,
        content: payload.content,
        summary: payload.summary,
        language: payload.language,
        priority: payload.priority,
        type: payload.type,
        category: payload.category,
        tags: payload.tags,
        credibility: payload.credibility,
        parseDate: payload.parseDate,
        eventDate: payload.eventDate,
        rawUrl: payload.rawUrl,
        mediaUrl: payload.mediaUrl,
        meta: payload.meta ?? {},
      });

      await osintService.ingest(dto);
      ok += 1;
    } catch (e) {
      failed += 1;
      console.error(
        'Failed to ingest point from Qdrant:',
        pt.id,
        'error:',
        (e as Error).message,
      );
    }
  }

  console.log(`Sync finished. OK: ${ok}, failed: ${failed}`);

  await app.close();
}

main()
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error in sync script:', err);
    process.exit(1);
  });
