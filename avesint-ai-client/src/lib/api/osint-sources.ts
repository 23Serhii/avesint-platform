// src/lib/api/osint-sources.ts
import { api } from './client'

export type OsintSourceMeta = {
    aiEnabledForEvents?: boolean
    [key: string]: any
}

export type OsintSource = {
    id: string
    externalId: string
    name: string
    type: string | null
    url: string | null
    handle: string | null
    language: string | null
    isActive: boolean
    reliability: number
    totalItems: number
    confirmedItems: number
    disprovedItems: number
    description: string | null
    category: string | null
    tags: string[] | null
    meta: OsintSourceMeta | null
}

export async function listOsintSources(params?: {
    type?: string
    isActive?: boolean
    category?: string
}): Promise<OsintSource[]> {
    const res = await api.get<OsintSource[]>('/osint/sources', {
        params: {
            type: params?.type,
            category: params?.category,
            isActive:
                typeof params?.isActive === 'boolean'
                    ? String(params.isActive)
                    : undefined,
        },
    })
    return res.data
}

export async function createOsintSource(payload: {
    url: string
    category?: string | null
    isActive?: boolean
}): Promise<OsintSource> {
    const res = await api.post<OsintSource>('/osint/sources', payload)
    return res.data
}

export async function updateOsintSource(
    id: string,
    payload: {
        isActive?: boolean
        tags?: string[]
        category?: string | null
        meta?: OsintSourceMeta
    },
): Promise<OsintSource> {
    const res = await api.patch<OsintSource>(`/osint/sources/${id}`, payload)
    return res.data
}

export async function deleteOsintSource(id: string): Promise<void> {
    await api.delete(`/osint/sources/${id}`)
}