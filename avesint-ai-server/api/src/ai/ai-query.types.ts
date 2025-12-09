// src/ai/ai-query.types.ts

export type AiQueryMode = 'search' | 'analysis' | 'report'

export interface AiDataScope {
  includeEvents?: boolean
  includeTasks?: boolean
  includeTargets?: boolean
  includeReports?: boolean
}

export interface AiTimeFilter {
  from?: string // ISO
  to?: string   // ISO
  preset?: 'last_24h' | 'last_7d' | 'last_30d'
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

// --- DTO для даних, які ми даємо моделі ---

export interface AiEventSnippet {
  id: string
  title: string
  summary?: string
  description?: string
  type: string
  severity: string
  status: string
  occurredAt: string
  latitude?: number
  longitude?: number
  tags?: string[]
}

export interface AiQueryDataPayload {
  events: AiEventSnippet[]
  // На майбутнє:
  // tasks: AiTaskSnippet[]
  // targets: AiTargetSnippet[]
  // reports: AiReportSnippet[]
}