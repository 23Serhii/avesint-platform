// avesint-ai-client/src/lib/api/targets.ts
import { api } from './client'
import type {
    TargetObject,
    TargetPriority,
    TargetStatus,
    TargetType,
} from '@/features/targets/data/schema'

export interface PaginatedResponse<T> {
    items: T[]
    page: number
    pageSize: number
    total: number
}

export interface TargetDto {
    id: string
    title: string
    description: string | null
    type: string | null
    status: string
    priority: string | null
    latitude: number | null
    longitude: number | null
    firstSeenAt: string
    lastSeenAt: string
    createdAt: string
    updatedAt: string
    createdBy?: string | null
    updatedBy?: string | null
    archived?: boolean
}

export function mapDtoToTarget(dto: TargetDto): TargetObject {
    const status = (dto.status as TargetStatus) ?? 'candidate'
    const priority = (dto.priority as TargetPriority) ?? 'medium'
    const type = (dto.type as TargetType) ?? 'other'

    return {
        id: dto.id,
        title: dto.title,
        kind: 'target',
        type,
        priority,
        status,
        locationText: undefined,
        firstSeenAt: new Date(dto.firstSeenAt),
        lastSeenAt: new Date(dto.lastSeenAt),
        source: undefined,
        notes: dto.description ?? undefined,
        archived: dto.archived ?? false,
    }
}

export interface ListTargetsParams {
    page?: number
    pageSize?: number
    status?: TargetStatus[]
    priority?: TargetPriority[]
    type?: TargetType[]
    search?: string
    archived?: boolean
}

async function fetchTargets(
    params?: ListTargetsParams,
): Promise<PaginatedResponse<TargetObject>> {
    const res = await api.get<PaginatedResponse<TargetDto>>('/targets', {
        params: {
            page: params?.page,
            pageSize: params?.pageSize,
            status: params?.status,
            priority: params?.priority,
            type: params?.type,
            search: params?.search,
            archived:
                typeof params?.archived === 'boolean'
                    ? String(params.archived)
                    : undefined,
        },
    })

    const data = res.data
    return {
        ...data,
        items: data.items.map(mapDtoToTarget),
    }
}

export async function listTargets(
    params?: ListTargetsParams,
): Promise<PaginatedResponse<TargetObject>> {
    return fetchTargets(params)
}

export async function getTarget(id: string): Promise<TargetObject> {
    const res = await api.get<TargetDto>(`/targets/${id}`)
    return mapDtoToTarget(res.data)
}

export interface CreateTargetInput {
    title: string
    description?: string
    type?: TargetType
    status: TargetStatus
    priority?: TargetPriority
}

export type UpdateTargetInput = Partial<CreateTargetInput>

export async function createTarget(
    input: CreateTargetInput,
): Promise<TargetObject> {
    const body = {
        title: input.title,
        description: input.description ?? null,
        type: input.type ?? null,
        status: input.status,
        priority: input.priority ?? null,
        latitude: null,
        longitude: null,
    }

    const res = await api.post<TargetDto>('/targets', body)
    return mapDtoToTarget(res.data)
}

export async function updateTarget(
    id: string,
    input: UpdateTargetInput,
): Promise<TargetObject> {
    const body = {
        title: input.title,
        description: input.description ?? null,
        type: input.type ?? null,
        status: input.status,
        priority: input.priority ?? null,
        latitude: null,
        longitude: null,
    }

    const res = await api.patch<TargetDto>(`/targets/${id}`, body)
    return mapDtoToTarget(res.data)
}

export async function deleteTarget(id: string): Promise<void> {
    await api.delete(`/targets/${id}`)
}