// src/lib/api/ai-qdrant.ts
import { api } from './client'
import type { AiTimeFilter } from './ai-query'
import type { Event } from '@/features/events/data/schema'

export interface QdrantSearchRequest {
  query: string
  time?: AiTimeFilter
  topK?: number
}

export interface QdrantEventSnippet {
  id: string
  title: string
  summary?: string
  type: string
  severity: string
  status: string
  occurredAt: string
  latitude?: number
  longitude?: number
  tags?: string[]
}

export async function searchEventsInQdrant(
  payload: QdrantSearchRequest,
): Promise<QdrantEventSnippet[]> {
  const res = await api.post<QdrantEventSnippet[]>('/ai/qdrant/events', payload)
  return res.data
}