// avesint-ai-client/src/lib/api/events.ts
import type { Event } from '@/features/events/data/schema';
import { api } from './client';


export interface EventDto {
  id: string
  title: string
  summary: string | null
  description: string | null
  type: string
  severity: string
  status: string
  latitude: number | null
  longitude: number | null
  occurredAt: string
  createdAt: string
  updatedAt: string
  confidence: number | null
  externalRef: string | null
  imageUrl: string | null
  tags?: string[] | null
}

export type EventEvidenceItem = {
  osintItemId: string
  relation: 'support' | 'duplicate' | 'contradict'
  weight: number | null
  createdAt: string
  source: {
    id: string
    name: string
    category: string | null
    externalId: string
  }
  item: {
    externalId: string
    title: string | null
    summary: string | null
    content: string
    parseDate: string
    eventDate: string | null
    rawUrl: string | null
    mediaUrl: string | null
    credibility: number | null
    tags: string[] | null
  }
}

export async function listEventEvidence(
  eventId: string
): Promise<EventEvidenceItem[]> {
  const res = await api.get<EventEvidenceItem[]>(
    `/events/${eventId}/evidence`,
    {
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    }
  )
  return res.data
}


export interface ListEventsQuery {
  page?: number
  pageSize?: number
  status?: string[] | string
  severity?: string[] | string
  type?: string[] | string
  search?: string
  from?: string
  to?: string
  latMin?: number
  latMax?: number
  lngMin?: number
  lngMax?: number
}

export interface ListEventsResponse {
  items: Event[]
  page: number
  pageSize: number
  total: number
}

function mapDtoToEvent(dto: EventDto): Event {
  return {
    id: dto.id,
    title: dto.title,
    summary: dto.summary ?? undefined,
    description: dto.description ?? undefined,
    type: dto.type as Event['type'], // виправлено суворий тип
    severity: dto.severity as Event['severity'],
    status: mapServerStatusToClient(dto.status),
    // ДОДАНО: дефолти для обов'язкових у клієнтському типі полів
    theater: 'ua',           // бекенд не повертає — встановлюємо безпечний дефолт
    sourceIds: [],           // бекенд не повертає — порожній список
    latitude: dto.latitude ?? undefined,
    longitude: dto.longitude ?? undefined,
    occurredAt: dto.occurredAt,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    confidence: dto.confidence ?? undefined,
    externalRef: dto.externalRef ?? undefined,
    imageUrl: dto.imageUrl ?? undefined,
    tags: Array.isArray(dto.tags) ? dto.tags : undefined,
  }
}

// ... existing code ...
export async function listEvents(
  query: ListEventsQuery,
): Promise<ListEventsResponse> {
  const params = transformClientQueryToServer(query)

  const res = await api.get<{
    items: EventDto[]
    page: number
    pageSize: number
    total: number
  }>('/events', {
    params,
  })

  const data = res.data
  return {
    page: data.page,
    pageSize: data.pageSize,
    total: data.total,
    items: data.items.map(mapDtoToEvent),
  }
}

// Helpers: статуси клієнта ↔ бекенда
type ServerStatus = 'pending' | 'confirmed' | 'disproved'

function mapServerStatusToClient(s: string): Event['status'] {
  switch (s as ServerStatus) {
    case 'pending':
      return 'triage'
    case 'confirmed':
      return 'confirmed'
    case 'disproved':
      return 'dismissed'
    default:
      return 'triage'
  }
}

function mapClientStatusToServer(s: Event['status']): ServerStatus[] {
  switch (s) {
    case 'new':
    case 'triage':
      return ['pending']
    case 'confirmed':
      return ['confirmed']
    case 'dismissed':
      return ['disproved']
    case 'archived':
      return ['confirmed', 'disproved']
    default:
      return ['pending']
  }
}

// суворий тип для параметрів запиту до сервера (без any)
type ServerListParams = {
  page?: number
  pageSize?: number
  status?: ServerStatus[] | ServerStatus
  severity?: string[] | string
  type?: string[] | string
  search?: string
  from?: string
  to?: string
  latMin?: number
  latMax?: number
  lngMin?: number
  lngMax?: number
}

function transformClientQueryToServer(query: ListEventsQuery): ServerListParams {
  const params: ServerListParams = { ...query }

  if (query.status != null) {
    const statuses = Array.isArray(query.status) ? query.status : [query.status]
    const serverSet = new Set<ServerStatus>()
    statuses.forEach((st) => {
      mapClientStatusToServer(st as Event['status']).forEach((ss) => serverSet.add(ss))
    })
    params.status = Array.from(serverSet)
  }

  return params
}

export async function getEvent(id: string): Promise<Event> {
  const res = await api.get<EventDto>(`/events/${id}`)
  return mapDtoToEvent(res.data)
}

export async function createEvent(
  payload: Partial<Event>,
): Promise<Event> {
  const res = await api.post<EventDto>('/events', payload)
  return mapDtoToEvent(res.data)
}

export async function updateEvent(
  id: string,
  payload: Partial<Event>,
): Promise<Event> {
  const res = await api.patch<EventDto>(`/events/${id}`, payload)
  return mapDtoToEvent(res.data)
}

export async function deleteEvent(id: string): Promise<void> {
  await api.delete(`/events/${id}`)
}