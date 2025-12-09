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
import { InjectRepository } from '@nestjs/typeorm';
import { OsintItemEntity } from '../osint/osint-item.entity';
import { Repository } from 'typeorm';
import { OsintSourceEntity } from '../osint/osint-source.entity';
import { QdrantService } from '../common/qdrant.service';  // 🔹 новий імпорт

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

const SYNC_EVENTS_TO_QDRANT =
  (process.env.SYNC_EVENTS_TO_QDRANT ?? 'true').toLowerCase() === 'true';

@Injectable()
export class EventsService {
  constructor(
    private readonly auditLog: AuditLogService,

    @InjectRepository(OsintItemEntity)
    private readonly osintItemRepo: Repository<OsintItemEntity>,

    @InjectRepository(OsintSourceEntity)
    private readonly osintSourceRepo: Repository<OsintSourceEntity>,

    private readonly qdrant: QdrantService, // 🔹 інʼєктимо QdrantService
  ) {}
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
      if (!v) return null
      if (Array.isArray(v)) return v.map(String)
      return [String(v)]
    }

    const statusArr = toArray(query.status);
    const severityArr = toArray(query.severity);
    const typeArr = toArray(query.type);
    const searchText =
      query.search && query.search.trim().length > 0
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
                tags               -- 🔹 додаємо tags у вибірку
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
              ORDER BY occurred_at DESC
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
              tags                -- 🔹 додаємо tags
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
              tags              -- 🔹 пишемо tags
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
                     $15  -- tags
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
        input.tags ?? null, // 🔹 може бути масив або null
      ],
    );

    const dto = mapRowToDto(result.rows[0]);

    // 🔹 Синхронізація в Qdrant (feature‑flag SYNC_EVENTS_TO_QDRANT)
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
      })
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
    if (input.tags !== undefined) addField('tags', input.tags ?? null); // 🔹 оновлюємо tags

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

    // 🔹 оновлення в Qdrant
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
      })
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