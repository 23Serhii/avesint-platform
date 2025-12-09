// ... існуючі імпорти ...
import { api } from './client'

export type IntelligenceItemType = 'event' | 'osint'

export type IntelligenceItemDto = {
    id: string
    type: IntelligenceItemType
    title: string | null
    summary: string | null
    time: string
    status: string | null
    confidence: number | null
    latitude: number | null
    longitude: number | null
    source: string | null
    externalRef: string | null
    tags?: string[] | null
    aiClassification?: {
        mainCategory: string
        subCategories: string[]
        threatLevel: 'low' | 'medium' | 'high'
        priority: 'P0' | 'P1' | 'P2' | 'P3'
        eventKind: 'fact' | 'assessment' | 'assumption' | 'forecast'
        tags: string[]
        confidence: number
    } | null
}

export type AiMapEvent = {
    id: string
    title: string | null
    summary: string | null
    time: string | null
    severity: string | null
    status: string | null
    latitude: number
    longitude: number
    tags: string[]
}

export async function listAiMapEvents(params?: {
    limit?: number
    status?: string
}): Promise<AiMapEvent[]> {
    const res = await api.get<AiMapEvent[]>('/ai/map/events', {
        params: {
            limit: params?.limit,
            status: params?.status,
        },
    })
    return res.data
}

export async function listStream(params: {
    page?: number
    limit?: number
    type?: IntelligenceItemType
    status?: string
}): Promise<{ items: IntelligenceItemDto[] }> {
    const res = await api.get('/stream', { params })
    return res.data
}

// 🔹 новий метод: зберегти рішення аналітика
export type ReviewStreamPayload = {
    status: 'pending' | 'confirmed' | 'disproved'
    priority?: 'P0' | 'P1' | 'P2' | 'P3'
    tags?: string[]
    comment?: string
}

export async function reviewStreamItem(
    id: string,
    payload: ReviewStreamPayload,
): Promise<IntelligenceItemDto> {
    const res = await api.patch(`/stream/${id}/review`, payload)
    return res.data
}