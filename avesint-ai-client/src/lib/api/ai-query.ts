// src/lib/api/ai-query.ts
import { api } from './client';


export type AiQueryMode = 'search' | 'analysis' | 'report'

export interface AiDataScope {
  includeEvents?: boolean
  includeTasks?: boolean
  includeTargets?: boolean
  includeReports?: boolean
}

export interface AiTimeFilter {
  from?: string
  to?: string
  preset?: 'last_24h' | 'last_48h' | 'last_7d' | 'last_30d'
}

export interface AiGeoFilter {
  latMin?: number
  latMax?: number
  lngMin?: number
  lngMax?: number
  regionName?: string
}

export interface AiQueryRequest {
  query: string
  mode?: AiQueryMode
  scope?: AiDataScope
  time?: AiTimeFilter
  geo?: AiGeoFilter
  language?: 'uk' | 'en'
  topKPerType?: number
}

export interface AiCitationRef {
  type: 'event' | 'task' | 'target' | 'report'
  id: string
  title?: string
  summary?: string
}

export interface AiSuggestedAction {
  type: 'create_task' | 'create_target' | 'create_report'
  title: string
  description?: string
  relatedItems?: AiCitationRef[]
  payload?: Record<string, any>
}

export interface AiQueryResponse {
  answer: string
  citations: AiCitationRef[]
  suggestedActions: AiSuggestedAction[]
  meta?: {
    tokens?: {
      promptTokens: number
      completionTokens: number
    }
    model?: string
    resolvedFilters?: {
      time?: { from?: string; to?: string }
      types?: string[]
    }
  }
}

export async function aiQuery(
  payload: AiQueryRequest,
): Promise<AiQueryResponse> {
  const res = await api.post<AiQueryResponse>('/ai/query', payload)
  return res.data
}