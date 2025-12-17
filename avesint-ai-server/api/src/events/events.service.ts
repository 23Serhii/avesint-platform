// src/events/events.service.ts
import { Injectable } from '@nestjs/common';
import { pool } from '../db';
import type {
  CreateEventInput,
  ListEventsQuery,
  EventDto,
  UpdateEventInput,
} from './events.schema';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { QdrantService } from '../common/qdrant.service';
import { createHash } from 'crypto';

function mapRowToDto(row: any): EventDto {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary ?? null,
    description: row.description ?? null,
    type: row.type,
    severity: row.severity,
    status: row.status,
    latitude: row.latitude !== null ? Number(row.latitude) : null,
    longitude: row.longitude !== null ? Number(row.longitude) : null,
    occurredAt: row.occurred_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    confidence: row.confidence !== null ? Number(row.confidence) : null,
    externalRef: row.external_ref ?? null,
    imageUrl: row.image_url ?? null,
    tags: row.tags ?? null,
  };
}

function sha1(input: string): string {
  return createHash('sha1').update(input).digest('hex');
}

function normalizeEventType(type: unknown): string {
  if (typeof type !== 'string') return '';
  return type.trim().toLowerCase();
}

function buildSoftFingerprint(params: {
  type: string;
  occurredAtIso: string;
  latitude: number | null;
  longitude: number | null;
}): string {
  const type = normalizeEventType(params.type) || 'osint_report';

  // 60 хв bucket (грубо, але стабільно)
  const dt = new Date(params.occurredAtIso);
  const bucketMs = 60 * 60 * 1000;
  const timeBucket = Number.isFinite(dt.getTime())
    ? Math.floor(dt.getTime() / bucketMs)
    : null;

  // geo bucket (0.1 градуса ~ 11км по широті). Це лише для fingerprint.
  const latBucket =
    typeof params.latitude === 'number'
      ? Math.round(params.latitude * 10) / 10
      : null;
  const lonBucket =
    typeof params.longitude === 'number'
      ? Math.round(params.longitude * 10) / 10
      : null;

  return sha1(
    JSON.stringify({
      v: 2,
      type,
      timeBucket,
      latBucket,
      lonBucket,
    }),
  );
}

function distanceKmApprox(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  // швидка апроксимація, достатня для дедупа
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

function parseIsoOrNull(v: unknown): Date | null {
  if (typeof v !== 'string') return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

const SYNC_EVENTS_TO_QDRANT =
  (process.env.SYNC_EVENTS_TO_QDRANT ?? 'true').toLowerCase() === 'true';

@Injectable()
export class EventsService {
  constructor(
    private readonly auditLog: AuditLogService,
    private readonly qdrant: QdrantService,
  ) {}

  async listEvidenceDebug(eventId: string): Promise<{
    eventEvidenceRows: number;
    matchedItems: number;
    matchedSources: number;
  }> {
    const res = await pool.query(
      `
        SELECT
          (SELECT COUNT(*) FROM event_evidence ee WHERE ee.event_id = $1)                         AS ee_cnt,
          (SELECT COUNT(*)
             FROM event_evidence ee
             JOIN osint_items i ON i.id = ee.osint_item_id
            WHERE ee.event_id = $1)                                                              AS items_cnt,
          (SELECT COUNT(*)
             FROM event_evidence ee
             JOIN osint_items i ON i.id = ee.osint_item_id
             JOIN osint_sources s ON s.id = i.source_id
            WHERE ee.event_id = $1)                                                              AS sources_cnt
      `,
      [eventId],
    );

    const row = res.rows?.[0] ?? {};
    return {
      eventEvidenceRows: Number(row.ee_cnt ?? 0),
      matchedItems: Number(row.items_cnt ?? 0),
      matchedSources: Number(row.sources_cnt ?? 0),
    };
  }

  // -----------------------------
  // Dedup helpers (B: Qdrant + rules)
  // -----------------------------

  async listEvidence(eventId: string): Promise<
    Array<{
      osintItemId: string;
      relation: 'support' | 'duplicate' | 'contradict';
      weight: number | null;
      createdAt: string;

      source: {
        id: string;
        name: string;
        category: string | null;
        externalId: string;
      };

      item: {
        externalId: string;
        title: string | null;
        summary: string | null;
        content: string;
        parseDate: string;
        eventDate: string | null;
        rawUrl: string | null;
        mediaUrl: string | null;
        credibility: number | null;
        tags: string[] | null;
      };
    }>
  > {
    const res = await pool.query(
      `
        SELECT
          ee.osint_item_id,
          ee.relation,
          ee.weight,
          ee.created_at,

          s.id            AS source_id,
          s.name          AS source_name,
          s.category      AS source_category,
          s."externalId"  AS source_external_id,

          i."externalId"  AS item_external_id,
          i.title         AS item_title,
          i.summary       AS item_summary,
          i.content       AS item_content,
          i."parseDate"   AS item_parse_date,
          i."eventDate"   AS item_event_date,
          i."rawUrl"      AS item_raw_url,
          i."mediaUrl"    AS item_media_url,
          i.credibility   AS item_credibility,
          i.tags          AS item_tags
        FROM event_evidence ee
        JOIN osint_items i
          ON i.id = ee.osint_item_id
        JOIN osint_sources s
          ON s.id = i.source_id
        WHERE ee.event_id = $1
        ORDER BY ee.created_at DESC
        LIMIT 200
      `,
      [eventId],
    );

    return res.rows.map((r: any) => ({
      osintItemId: String(r.osint_item_id),
      relation:
        (r.relation as 'support' | 'duplicate' | 'contradict') ?? 'support',
      weight: r.weight !== null ? Number(r.weight) : null,
      createdAt: (r.created_at as Date).toISOString(),

      source: {
        id: String(r.source_id),
        name: String(r.source_name),
        category: r.source_category ?? null,
        externalId: String(r.source_external_id),
      },

      item: {
        externalId: String(r.item_external_id),
        title: r.item_title ?? null,
        summary: r.item_summary ?? null,
        content: String(r.item_content),
        parseDate: (r.item_parse_date as Date).toISOString(),
        eventDate: r.item_event_date
          ? (r.item_event_date as Date).toISOString()
          : null,
        rawUrl: r.item_raw_url ?? null,
        mediaUrl: r.item_media_url ?? null,
        credibility:
          r.item_credibility !== null ? Number(r.item_credibility) : null,
        tags: Array.isArray(r.item_tags) ? (r.item_tags as string[]) : null,
      },
    }));
  }

  buildFingerprint(params: {
    type: string;
    occurredAtIso: string;
    latitude: number | null;
    longitude: number | null;
  }): string {
    return buildSoftFingerprint(params);
  }

  async attachEvidence(params: {
    eventId: string;
    osintItemId: string;
    relation?: 'support' | 'duplicate' | 'contradict';
    weight?: number | null;
  }): Promise<{ inserted: boolean }> {
    const res = await pool.query(
      `
        INSERT INTO event_evidence (event_id, osint_item_id, relation, weight)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (event_id, osint_item_id) DO NOTHING
        RETURNING event_id
      `,
      [
        params.eventId,
        params.osintItemId,
        params.relation ?? 'support',
        typeof params.weight === 'number' ? params.weight : null,
      ],
    );

    return { inserted: res.rowCount > 0 };
  }

  /**
   * Повертає ID існуючої події, якщо:
   *  - Qdrant каже "семантично схоже" (topK),
   *  - і правила (час/гео/тип) дозволяють склеїти.
   */
  async findDedupCandidate(params: {
    queryText: string;
    type: string;
    occurredAtIso: string;
    latitude: number | null;
    longitude: number | null;
  }): Promise<{ eventId: string; score: number } | null> {
    const occurredAt = parseIsoOrNull(params.occurredAtIso);
    if (!occurredAt) return null;

    // 1) Шукаємо семантичних сусідів у Qdrant серед docType=event
    const hits = await this.qdrant.searchIntelligence({
      query: params.queryText,
      limit: 10,
      docTypes: ['event'],
      // hasGeo фільтр тут НЕ вмикаємо жорстко, бо інколи geo ще null
    });

    if (hits.length === 0) return null;

    const desiredType = normalizeEventType(params.type) || 'osint_report';

    // 2) Правила “склейки”
    const MAX_TIME_DIFF_MIN = 180; // 3 години
    const MAX_GEO_DIFF_KM = 25; // 25 км (грубо, але практично для MVP)
    const MIN_QDRANT_SCORE = 0.35; // поріг схожості (підкрутиш на даних)

    let best: { eventId: string; score: number } | null = null;

    for (const h of hits) {
      const payload = h.payload ?? {};
      if (payload.docType !== 'event') continue;

      const eventId = String(payload.docId ?? h.id);
      const score = Number(h.score ?? 0);
      if (!Number.isFinite(score) || score < MIN_QDRANT_SCORE) continue;

      const hitTime = parseIsoOrNull(payload.time);
      if (!hitTime) continue;

      const timeDiffMin =
        Math.abs(hitTime.getTime() - occurredAt.getTime()) / 60000;
      if (timeDiffMin > MAX_TIME_DIFF_MIN) continue;

      const hitTypeRaw = (payload as any).type;
      const hitType = normalizeEventType(hitTypeRaw);

      if (hitType && hitType !== desiredType) {
        continue;
      }
      // Гео правило: якщо в обох є координати — перевіряємо відстань
      if (
        typeof params.latitude === 'number' &&
        typeof params.longitude === 'number' &&
        typeof payload.latitude === 'number' &&
        typeof payload.longitude === 'number'
      ) {
        const dKm = distanceKmApprox(
          { lat: params.latitude, lon: params.longitude },
          { lat: payload.latitude, lon: payload.longitude },
        );
        if (dKm > MAX_GEO_DIFF_KM) continue;
      }

      if (!best || score > best.score) {
        best = { eventId, score };
      }
    }

    return best;
  }

  // -----------------------------
  // Queries / CRUD
  // -----------------------------

  async listEvents(query: ListEventsQuery): Promise<{
    items: EventDto[];
    page: number;
    pageSize: number;
    total: number;
  }> {
    const page = Math.max(Number(query.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize ?? 10), 1), 100);
    const offset = (page - 1) * pageSize;

    const toArray = (v: unknown): string[] | null => {
      if (v === null || v === undefined) return null;
      if (Array.isArray(v)) return v.map((x) => String(x));
      if (typeof v === 'string') return [v];
      if (typeof v === 'number' || typeof v === 'boolean') return [String(v)];
      // Якщо прилетів об'єкт — не stringify'мо "[object Object]"
      return null;
    };

    const statusArr = toArray(query.status);
    const severityArr = toArray(query.severity);
    const typeArr = toArray(query.type);

    const searchText =
      typeof query.search === 'string' && query.search.trim().length > 0
        ? query.search.trim()
        : null;

    const from = query.from ?? null;
    const to = query.to ?? null;
    const latMin = query.latMin ?? null;
    const latMax = query.latMax ?? null;
    const lngMin = query.lngMin ?? null;
    const lngMax = query.lngMax ?? null;

    const filterParams = [
      statusArr, // $1
      severityArr, // $2
      typeArr, // $3
      searchText, // $4
      from, // $5
      to, // $6
      latMin, // $7
      latMax, // $8
      lngMin, // $9
      lngMax, // $10
    ];

    const totalResult = await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM events
        WHERE
          ($1::text[] IS NULL OR status   = ANY($1)) AND
          ($2::text[] IS NULL OR severity = ANY($2)) AND
          ($3::text[] IS NULL OR type     = ANY($3)) AND
          (
            $4::text IS NULL
            OR title   ILIKE '%' || $4::text || '%'
            OR summary ILIKE '%' || $4::text || '%'
            ) AND
          ($5::timestamptz IS NULL OR occurred_at >= $5) AND
          ($6::timestamptz IS NULL OR occurred_at <= $6) AND
          ($7::numeric    IS NULL OR latitude      >= $7) AND
          ($8::numeric    IS NULL OR latitude      <= $8) AND
          ($9::numeric    IS NULL OR longitude     >= $9) AND
          ($10::numeric   IS NULL OR longitude     <= $10)
      `,
      filterParams,
    );

    const total = Number(totalResult.rows[0]?.total ?? 0);

    const result = await pool.query(
      `
        SELECT
          id,
          title,
          summary,
          description,
          type,
          severity,
          status,
          latitude,
          longitude,
          occurred_at,
          created_at,
          updated_at,
          confidence,
          external_ref,
          image_url,
          tags
        FROM events
        WHERE
          ($1::text[] IS NULL OR status   = ANY($1)) AND
          ($2::text[] IS NULL OR severity = ANY($2)) AND
          ($3::text[] IS NULL OR type     = ANY($3)) AND
          (
            $4::text IS NULL
            OR title   ILIKE '%' || $4::text || '%'
            OR summary ILIKE '%' || $4::text || '%'
            ) AND
          ($5::timestamptz IS NULL OR occurred_at >= $5) AND
          ($6::timestamptz IS NULL OR occurred_at <= $6) AND
          ($7::numeric    IS NULL OR latitude      >= $7) AND
          ($8::numeric    IS NULL OR latitude      <= $8) AND
          ($9::numeric    IS NULL OR longitude     >= $9) AND
          ($10::numeric   IS NULL OR longitude     <= $10)
        ORDER BY updated_at DESC, occurred_at DESC
          LIMIT $11 OFFSET $12
      `,
      [...filterParams, pageSize, offset],
    );

    const items = result.rows.map(mapRowToDto);
    return { items, page, pageSize, total };
  }

  async getEventById(id: string): Promise<EventDto | null> {
    const result = await pool.query(
      `
        SELECT
          id,
          title,
          summary,
          description,
          type,
          severity,
          status,
          latitude,
          longitude,
          occurred_at,
          created_at,
          updated_at,
          confidence,
          external_ref,
          image_url,
          tags
        FROM events
        WHERE id = $1
      `,
      [id],
    );

    if (result.rowCount === 0) return null;
    return mapRowToDto(result.rows[0]);
  }

  async createEvent(
    input: CreateEventInput,
    actor?: JwtPayload,
    ip?: string | null,
  ): Promise<EventDto> {
    const actorId = actor?.sub ?? null;

    const fingerprint =
      typeof (input as any).fingerprint === 'string'
        ? String((input as any).fingerprint)
        : null;

    const result = await pool.query(
      `
        INSERT INTO events (
          title,
          summary,
          description,
          type,
          severity,
          status,
          latitude,
          longitude,
          occurred_at,
          confidence,
          external_ref,
          image_url,
          created_by,
          updated_by,
          tags,
          fingerprint
        )
        VALUES (
          $1,  -- title
          $2,  -- summary
          $3,  -- description
          $4,  -- type
          $5,  -- severity
          $6,  -- status
          $7,  -- latitude
          $8,  -- longitude
          $9,  -- occurred_at
          $10, -- confidence
          $11, -- external_ref
          $12, -- image_url
          $13, -- created_by
          $14, -- updated_by
          $15, -- tags
          $16  -- fingerprint
        )
        RETURNING
          id,
          title,
          summary,
          description,
          type,
          severity,
          status,
          latitude,
          longitude,
          occurred_at,
          created_at,
          updated_at,
          confidence,
          external_ref,
          image_url,
          tags
      `,
      [
        input.title,
        input.summary ?? null,
        input.description ?? null,
        input.type,
        input.severity,
        input.status ?? 'pending',
        input.latitude ?? null,
        input.longitude ?? null,
        input.occurredAt,
        input.confidence ?? null,
        input.externalRef ?? null,
        input.imageUrl ?? null,
        actorId,
        actorId,
        input.tags ?? null,
        fingerprint,
      ],
    );

    const dto = mapRowToDto(result.rows[0]);

    if (SYNC_EVENTS_TO_QDRANT) {
      void this.qdrant.upsertEvent({
        id: dto.id,
        title: dto.title ?? null,
        summary: dto.summary ?? null,
        description: dto.description ?? null,
        time: dto.occurredAt,
        severity: dto.severity ?? null,
        status: dto.status ?? null,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        tags: dto.tags ?? null,
        aiClassification: null,
        sourceName: null,
        isRoutine: false,
      });
    }

    if (actor) {
      await this.auditLog.log({
        actorId: actor.sub,
        actorCallsign: actor.callsign,
        actorRole: actor.role,
        action: 'event_created',
        severity: 'info',
        target: `event:${dto.id}`,
        description: `Створено подію "${dto.title}" (${dto.id})`,
        ip: ip ?? null,
      });
    }

    return dto;
  }

  async updateEvent(
    id: string,
    input: UpdateEventInput,
    actor?: JwtPayload,
    ip?: string | null,
  ): Promise<EventDto | null> {
    const prev = await this.getEventById(id);
    if (!prev) return null;

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const addField = (column: string, value: any) => {
      fields.push(`${column} = $${idx}`);
      values.push(value);
      idx += 1;
    };

    if (input.title !== undefined) addField('title', input.title);
    if (input.summary !== undefined) addField('summary', input.summary);
    if (input.description !== undefined)
      addField('description', input.description);
    if (input.type !== undefined) addField('type', input.type);
    if (input.severity !== undefined) addField('severity', input.severity);
    if (input.status !== undefined) addField('status', input.status);
    if (input.latitude !== undefined) addField('latitude', input.latitude);
    if (input.longitude !== undefined) addField('longitude', input.longitude);
    if (input.occurredAt !== undefined)
      addField('occurred_at', input.occurredAt);
    if (input.confidence !== undefined)
      addField('confidence', input.confidence);
    if (input.externalRef !== undefined)
      addField('external_ref', input.externalRef);
    if (input.imageUrl !== undefined) addField('image_url', input.imageUrl);
    if (input.tags !== undefined) addField('tags', input.tags ?? null);

    addField('updated_at', new Date().toISOString());
    if (actor) {
      addField('updated_by', actor.sub);
    }

    if (fields.length === 0) {
      return prev;
    }

    values.push(id);

    const result = await pool.query(
      `
        UPDATE events
        SET ${fields.join(', ')}
        WHERE id = $${idx}
          RETURNING
          id,
          title,
          summary,
          description,
          type,
          severity,
          status,
          latitude,
          longitude,
          occurred_at,
          created_at,
          updated_at,
          confidence,
          external_ref,
          image_url,
          tags
      `,
      values,
    );

    if (result.rowCount === 0) return null;

    const dto = mapRowToDto(result.rows[0]);

    if (SYNC_EVENTS_TO_QDRANT) {
      void this.qdrant.upsertEvent({
        id: dto.id,
        title: dto.title ?? null,
        summary: dto.summary ?? null,
        description: dto.description ?? null,
        time: dto.occurredAt,
        severity: dto.severity ?? null,
        status: dto.status ?? null,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        tags: dto.tags ?? null,
        aiClassification: null,
        sourceName: null,
        isRoutine: false,
      });
    }

    if (actor) {
      await this.auditLog.log({
        actorId: actor.sub,
        actorCallsign: actor.callsign,
        actorRole: actor.role,
        action: 'event_updated',
        severity: 'info',
        target: `event:${dto.id}`,
        description: `Оновлено подію "${dto.title}" (${dto.id})`,
        ip: ip ?? null,
      });
    }

    return dto;
  }

  async deleteEvent(
    id: string,
    actor?: JwtPayload,
    ip?: string | null,
  ): Promise<boolean> {
    const existing = await this.getEventById(id);
    if (!existing) return false;

    const result = await pool.query(
      `
        DELETE FROM events
        WHERE id = $1
      `,
      [id],
    );

    if (result.rowCount > 0 && actor) {
      await this.auditLog.log({
        actorId: actor.sub,
        actorCallsign: actor.callsign,
        actorRole: actor.role,
        action: 'event_deleted',
        severity: 'warning',
        target: `event:${id}`,
        description: `Видалено подію "${existing.title}" (${id})`,
        ip: ip ?? null,
      });
    }

    return result.rowCount > 0;
  }
}
