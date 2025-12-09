// avesint-ai-client/src/lib/api/audit-log.ts
import { api } from './client'

export type AuditSeverity = 'info' | 'warning' | 'critical'

export type AuditActionType =
    | 'login'
    | 'logout'
    | 'user_created'
    | 'user_updated'
    | 'role_changed'
    | 'event_created'
    | 'event_updated'
    | 'event_deleted'
    | 'event_verified'
    | 'settings_changed'
    | string // на майбутнє — інші дії

export interface AuditLogDto {
    id: number
    ts: string
    actorId: string | null
    actorCallsign: string | null
    actorRole: string | null
    actorDisplayName: string | null
    actorRank: string | null
    actorUnit: string | null
    actorIsTwoFactorEnabled: boolean | null
    action: string
    severity: AuditSeverity
    target: string | null
    description: string
    ip: string | null
    userAgent: string | null
    context: Record<string, any> | null
}

export interface AuditEntry {
    id: string
    timestamp: string
    actor: string
    actorRole?: string
    actorDisplayName?: string
    actorRank?: string
    actorUnit?: string
    actorIsTwoFactorEnabled?: boolean
    action: AuditActionType
    severity: AuditSeverity
    target?: string
    description: string
    ip?: string
    userAgent?: string
    context?: Record<string, any>
}

export interface ListAuditLogParams {
    page?: number
    pageSize?: number
    severity?: AuditSeverity[]
    action?: string[]
    search?: string
}

export interface ListAuditLogResponse {
    items: AuditEntry[]
    page: number
    pageSize: number
    total: number
}

function mapDtoToEntry(dto: AuditLogDto): AuditEntry {
    return {
        id: String(dto.id),
        timestamp: dto.ts,
        actor: dto.actorCallsign ?? dto.actorDisplayName ?? dto.actorId ?? 'system',
        actorRole: dto.actorRole ?? undefined,
        actorDisplayName: dto.actorDisplayName ?? undefined,
        actorRank: dto.actorRank ?? undefined,
        actorUnit: dto.actorUnit ?? undefined,
        actorIsTwoFactorEnabled:
            dto.actorIsTwoFactorEnabled === null
                ? undefined
                : dto.actorIsTwoFactorEnabled,
        action: dto.action as AuditActionType,
        severity: dto.severity,
        target: dto.target ?? undefined,
        description: dto.description,
        ip: dto.ip ?? undefined,
        userAgent: dto.userAgent ?? undefined,
        context: dto.context ?? undefined,
    }
}

export async function listAuditLog(
    params: ListAuditLogParams,
): Promise<ListAuditLogResponse> {
    const res = await api.get<{
        items: AuditLogDto[]
        page: number
        pageSize: number
        total: number
    }>('/audit-log', {
        params: {
            page: params.page,
            pageSize: params.pageSize,
            severity: params.severity,
            action: params.action,
            search: params.search,
        },
    })

    const data = res.data
    return {
        page: data.page,
        pageSize: data.pageSize,
        total: data.total,
        items: data.items.map(mapDtoToEntry),
    }
}