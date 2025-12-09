import { Injectable } from '@nestjs/common';
import { pool } from '../db';

export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface AuditLogEntry {
  id: number;
  ts: string;
  actorId: string | null;
  actorCallsign: string | null;
  actorDisplayName?: string | null;
  actorRole: string | null;
  action: string;
  severity: AuditSeverity;
  target: string | null;
  description: string;
  ip: string | null;
  context: Record<string, any> | null;
}

export interface ListAuditLogParams {
  page?: number;
  pageSize?: number;
  severity?: AuditSeverity[];
  action?: string[];
  search?: string;
}

@Injectable()
export class AuditLogService {
  async log(params: {
    actorId?: string | null;
    actorCallsign?: string | null;
    actorRole?: string | null;

    // додай це поле
    actorDisplayName?: string | null;

    // і це (якщо вже використовуєш у викликах)
    actorIsTwoFactorEnabled?: boolean | null;

    action: string;
    severity?: AuditSeverity;
    target?: string | null;
    description: string;
    ip?: string | null;
    context?: Record<string, any> | null;
  }): Promise<void> {
    const {
      actorId,
      actorCallsign,
      actorRole,
      actorDisplayName, // <-- можна не використовувати в SQL поки що
      actorIsTwoFactorEnabled, // <-- так само
      action,
      severity,
      target,
      description,
      ip,
      context,
    } = params;
    await pool.query(
      `
                INSERT INTO audit_log (
                    actor_id,
                    actor_callsign,
                    actor_role,
                    action,
                    severity,
                    target,
                    description,
                    ip,
                    context
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `,
      [
        actorId ?? null,
        actorCallsign ?? null,
        actorRole ?? null,
        action,
        severity ?? 'info',
        target ?? null,
        description,
        ip ?? null,
        context ? JSON.stringify(context) : null,
      ],
    );
  }

  async list(params: ListAuditLogParams): Promise<{
    items: AuditLogEntry[];
    page: number;
    pageSize: number;
    total: number;
  }> {
    const page = Math.max(params.page ?? 1, 1);
    const pageSize = Math.min(Math.max(params.pageSize ?? 20, 1), 100);
    const offset = (page - 1) * pageSize;

    const severityArr = params.severity ?? null;
    const actionArr = params.action ?? null;
    const searchText =
      params.search && params.search.trim().length > 0
        ? params.search.trim()
        : null;

    const filterParams = [severityArr, actionArr, searchText];

    const totalResult = await pool.query(
      `
                SELECT COUNT(*) AS total
                FROM audit_log
                WHERE
                    ($1::text[] IS NULL OR severity = ANY($1)) AND
                    ($2::text[] IS NULL OR action   = ANY($2)) AND
                    (
                        $3::text IS NULL
                            OR actor_callsign ILIKE '%' || $3::text || '%'
                            OR actor_role     ILIKE '%' || $3::text || '%'
                            OR target         ILIKE '%' || $3::text || '%'
                            OR description    ILIKE '%' || $3::text || '%'
                        )
            `,
      filterParams,
    );

    const total = Number(totalResult.rows[0]?.total ?? 0);

    const result = await pool.query(
      `
                SELECT
                    id,
                    ts,
                    actor_id,
                    actor_callsign,
                    actor_role,
                    action,
                    severity,
                    target,
                    description,
                    ip,
                    context
                FROM audit_log
                WHERE
                    ($1::text[] IS NULL OR severity = ANY($1)) AND
                    ($2::text[] IS NULL OR action   = ANY($2)) AND
                    (
                    $3::text IS NULL
                   OR actor_callsign ILIKE '%' || $3::text || '%'
                   OR actor_role     ILIKE '%' || $3::text || '%'
                   OR target         ILIKE '%' || $3::text || '%'
                   OR description    ILIKE '%' || $3::text || '%'
                    )
                ORDER BY ts DESC
                    LIMIT $4 OFFSET $5
            `,
      [...filterParams, pageSize, offset],
    );

    const items: AuditLogEntry[] = result.rows.map((row: any) => ({
      id: row.id,
      ts: row.ts.toISOString(),
      actorId: row.actor_id ?? null,
      actorCallsign: row.actor_callsign ?? null,
      actorRole: row.actor_role ?? null,
      action: row.action,
      severity: row.severity,
      target: row.target ?? null,
      description: row.description,
      ip: row.ip ?? null,
      context: row.context ?? null,
    }));

    return { items, page, pageSize, total };
  }
}
