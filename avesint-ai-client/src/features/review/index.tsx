import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { listEventEvidence, type EventEvidenceItem } from '@/lib/api/events';
import { reviewOsintItem } from '@/lib/api/osint-items';
import { listStream, reviewStreamItem, type IntelligenceItemDto, type IntelligenceItemType, type ReviewStreamPayload } from '@/lib/api/stream';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ConfigDrawer } from '@/components/config-drawer';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { Search as GlobalSearch } from '@/components/search';
import { ThemeSwitch } from '@/components/theme-switch';


// --- Типи та утиліти ---

type ReviewBaseStatus = 'pending' | 'confirmed' | 'disproved'
type ReviewStatusFilter = ReviewBaseStatus | 'all'
type ReviewPriorityFilter = 'critical' | 'high' | 'medium' | 'low' | 'all'

type AiClassification = NonNullable<IntelligenceItemDto['aiClassification']>

type ReviewItem = IntelligenceItemDto & {
  reviewComment?: string
}

type AnalystDecision = {
  // NOTE: це “ручний override” статусу event (опціонально).
  // Реальний workflow: status формується evidence‑вердиктами.
  status: ReviewBaseStatus
  priority: 'P0' | 'P1' | 'P2' | 'P3'
  tags: string[]
  comment: string
}

const STATUS_TEXT: Record<ReviewBaseStatus, string> = {
  pending: 'Очікує ревʼю',
  confirmed: 'Підтверджено',
  disproved: 'Спростовано',
}

const STATUS_VARIANT: Record<ReviewBaseStatus, 'default' | 'secondary' | 'outline'> = {
  pending: 'outline',
  confirmed: 'default',
  disproved: 'secondary',
}

const PRIORITY_TEXT: Record<ReviewPriorityFilter, string> = {
  critical: 'Критичний',
  high: 'Високий',
  medium: 'Середній',
  low: 'Низький',
  all: 'Усі',
}

const TYPE_TEXT: Record<IntelligenceItemType | 'all', string> = {
  event: 'Події',
  osint: 'OSINT',
  all: 'Усі типи',
}

function normalizeStatus(status: IntelligenceItemDto['status']): ReviewBaseStatus {
  if (status === 'confirmed') return 'confirmed'
  if (status === 'disproved') return 'disproved'
  return 'pending'
}

function priorityFromConfidence(
  confidence: number | null | undefined,
): Exclude<ReviewPriorityFilter, 'all'> {
  const c = confidence ?? 0
  if (c >= 0.85) return 'critical'
  if (c >= 0.6) return 'high'
  if (c >= 0.3) return 'medium'
  return 'low'
}

function buildExternalLink(ref: string | null | undefined): string | null {
  if (!ref) return null
  if (/^https?:\/\//i.test(ref)) return ref
  if (ref.startsWith('telegram:')) {
    const [, channel, msgId] = ref.split(':')
    if (channel && msgId) {
      return `https://t.me/${channel}/${msgId}`
    }
  }
  return null
}

// --- Компонент сторінки ревʼю ---

export function ReviewPage() {
  const queryClient = useQueryClient()

  // фільтри
  const [statusFilter, setStatusFilter] =
    useState<ReviewStatusFilter>('pending')
  const [priorityFilter, setPriorityFilter] =
    useState<ReviewPriorityFilter>('all')
  const [typeFilter, setTypeFilter] = useState<IntelligenceItemType | 'all'>(
    'all'
  )
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [categoryFilter, setCategoryFilter] = useState<AiClassification['mainCategory'] | 'all'>(
    'all',
  )
  const [threatFilter, setThreatFilter] = useState<AiClassification['threatLevel'] | 'all'>(
    'all',
  )
  const [eventKindFilter, setEventKindFilter] = useState<AiClassification['eventKind'] | 'all'>(
    'all',
  )

  // рішення аналітика (ручний override + нотатки)
  const [decision, setDecision] = useState<AnalystDecision | null>(null)

  // --- Завантаження стріму з бекенда ---
  const streamQuery = useQuery({
    queryKey: ['review-stream', { statusFilter, typeFilter }],
    queryFn: async () => {
      const res = await listStream({
        page: 1,
        limit: 100,
        status: statusFilter === 'all' ? undefined : statusFilter,

        // ✅ НЕ шлемо type=event, бо на бекенді це фільтр по events.type (strike/movement/...)
        type: typeFilter === 'osint' ? 'osint' : undefined,
      })
      return res.items as ReviewItem[]
    },
  })


  const items = streamQuery.data ?? []

  const selected = useMemo(() => {
    return items.find((i) => i.id === selectedId) ?? items[0] ?? null
  }, [items, selectedId])

  // --- Evidence по вибраному event ---
  const evidenceQuery = useQuery({
    queryKey: ['event-evidence', selected?.id],
    enabled: Boolean(selected?.id) && selected?.type === 'event',
    queryFn: async () => {
      if (!selected?.id) return []
      return listEventEvidence(selected.id)
    },
  })

  const evidence = evidenceQuery.data ?? []

  // --- init decision при зміні selected ---
  useEffect(() => {
    if (!selected) {
      setDecision(null)
      return
    }

    const ai = selected.aiClassification ?? null
    const baseStatus = normalizeStatus(selected.status)
    const aiPriorityBand = priorityFromConfidence(selected.confidence)

    const mappedPriority: AnalystDecision['priority'] =
      ai?.priority ??
      (aiPriorityBand === 'critical'
        ? 'P0'
        : aiPriorityBand === 'high'
          ? 'P1'
          : aiPriorityBand === 'medium'
            ? 'P2'
            : 'P3')

    setDecision({
      status: baseStatus,
      priority: mappedPriority,
      tags: ai?.tags ?? (Array.isArray(selected.tags) ? selected.tags : []),
      comment: '',
    })
  }, [selected])

  // --- Клієнтська фільтрація ---
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    return items.filter((i) => {
      if (q) {
        const text = ((i.title ?? '') + ' ' + (i.summary ?? '') + ' ' + (i.source ?? '')).toLowerCase()
        if (!text.includes(q)) return false
      }

      if (priorityFilter !== 'all') {
        const band = priorityFromConfidence(i.confidence)
        if (band !== priorityFilter) return false
      }

      const cl = i.aiClassification
      if (categoryFilter !== 'all') {
        if (!cl || cl.mainCategory !== categoryFilter) return false
      }
      if (threatFilter !== 'all') {
        if (!cl || cl.threatLevel !== threatFilter) return false
      }
      if (eventKindFilter !== 'all') {
        if (!cl || cl.eventKind !== eventKindFilter) return false
      }

      return true
    })
  }, [items, search, priorityFilter, categoryFilter, threatFilter, eventKindFilter])

  const handleSelect = (id: string) => setSelectedId(id)

  const handleAcceptAi = () => {
    if (!selected) return
    const ai = selected.aiClassification
    if (!ai) {
      toast.info('Для цього елемента AI‑класифікація ще не доступна')
      return
    }

    setDecision((prev) => ({
      status: normalizeStatus(selected.status),
      priority: ai.priority,
      tags: ai.tags.slice(),
      comment: prev?.comment ?? '',
    }))
  }

  // --- Evidence verdict mutation ---
  const reviewEvidenceMutation = useMutation({
    mutationFn: async (payload: {
      osintItemId: string
      verdict: 'confirmed' | 'disproved' | 'unknown'
    }) => {
      return reviewOsintItem(payload.osintItemId, payload.verdict)
    },
    onSuccess: async () => {
      toast.success('Review збережено (event статус оновлено автоматично)')
      await queryClient.invalidateQueries({ queryKey: ['review-stream'] })
      await queryClient.invalidateQueries({ queryKey: ['event-evidence'] })
    },
    onError: () => {
      toast.error('Не вдалося зберегти review')
    },
  })

  // --- Manual override mutation (optional) ---
  const manualOverrideMutation = useMutation({
    mutationFn: async (payload: { id: string; body: ReviewStreamPayload }) => {
      return reviewStreamItem(payload.id, payload.body)
    },
    onSuccess: async () => {
      toast.success('Рішення по події збережено (manual override)')
      await queryClient.invalidateQueries({ queryKey: ['review-stream'] })
      await queryClient.invalidateQueries({ queryKey: ['event-evidence'] })
    },
    onError: () => {
      toast.error('Не вдалося зберегти рішення по події')
    },
  })

  const handleSaveDecision = () => {
    if (!selected || !decision) return

    if (selected.type !== 'event') {
      toast.info('Поки що ручний override доступний лише для event')
      return
    }

    const payload: ReviewStreamPayload = {
      status: decision.status,
      priority: decision.priority,
      tags: decision.tags,
      comment: decision.comment || undefined,
    }

    manualOverrideMutation.mutate({ id: selected.id, body: payload })
  }

  // --- UI ---

  return (
    <>
      <Header fixed>
        <GlobalSearch />
        <div className="ms-auto flex items-center space-x-4">
          <ThemeSwitch />
          <ConfigDrawer />
        </div>
      </Header>

      <Main className="flex flex-1 flex-col gap-4 lg:gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Ревʼю / верифікація розвідданих</h1>
            {/* <p className="max-w-2xl text-sm text-muted-foreground">
              Основний workflow: підтверджуєш/спростовуєш evidence (OSINT-айтеми) → статус event рахується автоматично.
            </p> */}
          </div>
          <Button variant="outline" size="sm" onClick={() => void streamQuery.refetch()}>
            Оновити
          </Button>
        </div>

        {/* Фільтри */}
        <Card className="px-3 py-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Статус:</span>
              <Select value={statusFilter} onValueChange={(v: ReviewStatusFilter) => setStatusFilter(v)}>
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Очікує ревʼю</SelectItem>
                  <SelectItem value="confirmed">Підтверджено</SelectItem>
                  <SelectItem value="disproved">Спростовано</SelectItem>
                  <SelectItem value="all">Усі</SelectItem>
                </SelectContent>
              </Select>
            </div>

             <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Тип:</span>
               <Select
                 value={typeFilter}
                 onValueChange={(v: IntelligenceItemType | 'all') => setTypeFilter(v)}
               >
                 <SelectTrigger className="h-8 w-32 text-xs">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">{TYPE_TEXT.all}</SelectItem>

                   {/* ✅ event залишаємо в UI, але він тепер працює як "без фільтра" */}
                   <SelectItem value="event">{TYPE_TEXT.event}</SelectItem>

                   {/* ⚠ osint поки не підтримується бекендом /stream, тому не вводимо в оману */}
                   {/* <SelectItem value="osint">{TYPE_TEXT.osint}</SelectItem> */}
                 </SelectContent>
               </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Пріоритет:</span>
              <Select value={priorityFilter} onValueChange={(v: ReviewPriorityFilter) => setPriorityFilter(v)}>
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{PRIORITY_TEXT.all}</SelectItem>
                  <SelectItem value="critical">{PRIORITY_TEXT.critical}</SelectItem>
                  <SelectItem value="high">{PRIORITY_TEXT.high}</SelectItem>
                  <SelectItem value="medium">{PRIORITY_TEXT.medium}</SelectItem>
                  <SelectItem value="low">{PRIORITY_TEXT.low}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="ms-auto flex items-center gap-2">
              <Input
                placeholder="Пошук по заголовку, summary, джерелу…"
                className="h-8 w-56 text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3 border-t pt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Категорія:</span>
              <Select
                value={categoryFilter}
                onValueChange={(v) => setCategoryFilter(v as AiClassification['mainCategory'] | 'all')}
              >
                <SelectTrigger className="h-8 w-44 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Усі</SelectItem>
                  <SelectItem value="military_activity">Військова активність</SelectItem>
                  <SelectItem value="strikes_threats">Удари / загрози</SelectItem>
                  <SelectItem value="infrastructure">Інфраструктура / обʼєкти</SelectItem>
                  <SelectItem value="territorial">Територіальні події</SelectItem>
                  <SelectItem value="political_info">Політична / інф. активність</SelectItem>
                  <SelectItem value="social">Соціальні / цивільні</SelectItem>
                  <SelectItem value="technical_meta">Технічні / метадані</SelectItem>
                  <SelectItem value="other">Інше</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Рівень загрози:</span>
              <Select
                value={threatFilter}
                onValueChange={(v) => setThreatFilter(v as AiClassification['threatLevel'] | 'all')}
              >
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Усі</SelectItem>
                  <SelectItem value="low">Низький</SelectItem>
                  <SelectItem value="medium">Середній</SelectItem>
                  <SelectItem value="high">Високий</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Тип події:</span>
              <Select
                value={eventKindFilter}
                onValueChange={(v) => setEventKindFilter(v as AiClassification['eventKind'] | 'all')}
              >
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Усі</SelectItem>
                  <SelectItem value="fact">Факт</SelectItem>
                  <SelectItem value="assessment">Оцінка</SelectItem>
                  <SelectItem value="assumption">Припущення</SelectItem>
                  <SelectItem value="forecast">Прогноз</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {streamQuery.isLoading && (
          <div className="text-xs text-muted-foreground">Завантаження елементів ревʼю…</div>
        )}
        {streamQuery.isError && (
          <div className="text-xs text-red-500">Не вдалося завантажити стрім для ревʼю.</div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)] lg:gap-6">
          {/* Ліва колонка */}
          <Card className="max-h-[640px] overflow-hidden">
            <div className="border-b px-3 py-2 text-xs text-muted-foreground">
              {filtered.length} елементів
            </div>
            <div className="h-[600px] overflow-auto">
              {filtered.map((item) => {
                const normStatus = normalizeStatus(item.status)
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item.id)}
                    className={cn(
                      'flex w-full flex-col gap-1 border-b px-3 py-2 text-left text-xs',
                      (selected?.id ?? null) === item.id ? 'bg-muted/80' : 'hover:bg-muted/40',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="line-clamp-2 text-sm font-medium">
                        {item.title ?? 'Без назви'}
                      </span>
                      <Badge variant={STATUS_VARIANT[normStatus]} className="shrink-0 text-[10px]">
                        {STATUS_TEXT[normStatus]}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      {item.type && (
                        <span className="rounded bg-muted px-1 py-0.5 text-[10px] uppercase">
                          {item.type}
                        </span>
                      )}
                      {typeof item.confidence === 'number' && (
                        <span>conf: {Math.round(item.confidence * 100)}%</span>
                      )}
                      {item.source && <span className="line-clamp-1">Джерело: {item.source}</span>}
                      {item.time && (
                        <span className="ms-auto">
                          {new Date(item.time).toLocaleString('uk-UA', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </span>
                      )}
                    </div>

                    {Array.isArray(item.tags) && item.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.tags.slice(0, 4).map((t) => (
                          <Badge key={t} variant="outline" className="px-1.5 py-0 text-[10px]">
                            #{t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </button>
                )
              })}

              {filtered.length === 0 && !streamQuery.isLoading && (
                <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
                  Немає елементів для поточних фільтрів.
                </div>
              )}
            </div>
          </Card>

          {/* Права колонка */}
          <Card className="flex min-h-[400px] flex-col gap-3 p-3 lg:p-4">
            {!selected || !decision ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Оберіть елемент зі списку ліворуч для верифікації.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold leading-snug">
                      {selected.title ?? 'Без назви'}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      {selected.source && <span>{selected.source}</span>}
                      {selected.type && (
                        <>
                          <span>·</span>
                          <span className="rounded bg-muted px-1 py-0.5 text-[10px] uppercase">
                            {selected.type}
                          </span>
                        </>
                      )}
                      {selected.time && (
                        <>
                          <span>·</span>
                          <span>
                            Час:{' '}
                            {new Date(selected.time).toLocaleString('uk-UA', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <Badge
                      variant={STATUS_VARIANT[normalizeStatus(selected.status)]}
                      className="text-[10px]"
                    >
                      {STATUS_TEXT[normalizeStatus(selected.status)]}
                    </Badge>
                    {typeof selected.confidence === 'number' && (
                      <Badge variant="outline" className="text-[10px]">
                        Довіра AI: {Math.round(selected.confidence * 100)}%
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Evidence (основна робоча частина) */}
                {selected.type === 'event' && (
                  <div className="space-y-2 rounded-md border bg-background/40 p-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-semibold uppercase text-muted-foreground">
                        Evidence (підтвердження)
                      </div>
                      {evidenceQuery.isLoading ? (
                        <span className="text-[11px] text-muted-foreground">завантаження…</span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">{evidence.length} шт.</span>
                      )}
                    </div>

                    {!evidenceQuery.isLoading && evidence.length === 0 && (
                      <div className="text-[11px] text-muted-foreground">
                        Немає evidence для цього event (або ще не приклеїлось).
                      </div>
                    )}

                    {evidence.slice(0, 25).map((ev: EventEvidenceItem) => {
                      const url = ev.item.rawUrl || buildExternalLink(ev.item.externalId)
                      const busy = reviewEvidenceMutation.isPending

                      return (
                        <div key={ev.osintItemId} className="border-t pt-2 first:border-t-0 first:pt-0">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            <Badge variant="outline" className="text-[10px]">
                              {ev.relation}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {ev.source.name}
                              {ev.source.category ? ` · ${ev.source.category}` : ''}
                            </Badge>
                          </div>

                          <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
                            <div className="text-xs">
                              <div className="line-clamp-2 text-muted-foreground">
                                {ev.item.summary ?? ev.item.content}
                              </div>
                              {url ? (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="break-all text-[11px] text-blue-600 hover:underline"
                                >
                                  {url}
                                </a>
                              ) : null}
                            </div>

                            <div className="flex shrink-0 flex-wrap gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[11px]"
                                disabled={busy}
                                onClick={() =>
                                  reviewEvidenceMutation.mutate({ osintItemId: ev.osintItemId, verdict: 'confirmed' })
                                }
                              >
                                Confirm
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[11px]"
                                disabled={busy}
                                onClick={() =>
                                  reviewEvidenceMutation.mutate({ osintItemId: ev.osintItemId, verdict: 'disproved' })
                                }
                              >
                                Disprove
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[11px]"
                                disabled={busy}
                                onClick={() =>
                                  reviewEvidenceMutation.mutate({ osintItemId: ev.osintItemId, verdict: 'unknown' })
                                }
                              >
                                Unknown
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* AI info */}
                {selected.aiClassification && (
                  <div className="rounded-md border bg-muted/40 p-2 text-xs">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-medium">Категоризація AI</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[11px]"
                        onClick={handleAcceptAi}
                      >
                        Прийняти пропозицію AI
                      </Button>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <span className="text-[11px] text-muted-foreground">Категорія:</span>{' '}
                        <span className="font-medium">{selected.aiClassification.mainCategory}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-muted-foreground">Загроза:</span>{' '}
                        <span className="font-medium">{selected.aiClassification.threatLevel}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-muted-foreground">Пріоритет:</span>{' '}
                        <span className="font-medium">{selected.aiClassification.priority}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-muted-foreground">Тип судження:</span>{' '}
                        <span className="font-medium">{selected.aiClassification.eventKind}</span>
                      </div>
                      {selected.aiClassification.tags?.length > 0 && (
                        <div className="sm:col-span-2">
                          <span className="text-[11px] text-muted-foreground">Теги AI:</span>{' '}
                          {selected.aiClassification.tags.map((t) => (
                            <Badge key={t} variant="outline" className="me-1 px-1.5 py-0 text-[10px]">
                              #{t}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Manual override panel (optional) */}
                <div className="space-y-2 text-xs">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Manual override: статус event
                      </span>
                      <Select
                        value={decision.status}
                        onValueChange={(v: ReviewBaseStatus) =>
                          setDecision((d) => (d ? { ...d, status: v } : d))
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">pending</SelectItem>
                          <SelectItem value="confirmed">confirmed</SelectItem>
                          <SelectItem value="disproved">disproved</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Пріоритет (рішення)
                      </span>
                      <Select
                        value={decision.priority}
                        onValueChange={(v: AnalystDecision['priority']) =>
                          setDecision((d) => (d ? { ...d, priority: v } : d))
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="P0">P0 — негайна увага</SelectItem>
                          <SelectItem value="P1">P1 — важливо</SelectItem>
                          <SelectItem value="P2">P2 — середнє</SelectItem>
                          <SelectItem value="P3">P3 — низьке</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Робочі теги (через кому)
                    </span>
                    <Input
                      className="h-8 text-xs"
                      value={decision.tags.join(', ')}
                      onChange={(e) =>
                        setDecision((d) =>
                          d
                            ? {
                              ...d,
                              tags: e.target.value
                                .split(',')
                                .map((t) => t.trim())
                                .filter(Boolean),
                            }
                            : d,
                        )
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Коментар аналітика
                    </span>
                    <Textarea
                      rows={3}
                      className="text-xs"
                      value={decision.comment}
                      onChange={(e) =>
                        setDecision((d) => (d ? { ...d, comment: e.target.value } : d))
                      }
                      placeholder="Нотатки (manual override payload)…"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Посилання на оригінал
                    </span>
                    {(() => {
                      const url = buildExternalLink(selected.externalRef)
                      if (url) {
                        return (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="break-all text-[11px] text-blue-600 hover:underline"
                          >
                            {url}
                          </a>
                        )
                      }

                      if (selected.externalRef) {
                        return <div className="break-all text-[11px]">{selected.externalRef}</div>
                      }

                      return <div className="text-[11px] text-muted-foreground">Немає externalRef</div>
                    })()}
                  </div>

                  <div className="mt-2 flex justify-end gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveDecision}
                      disabled={manualOverrideMutation.isPending || selected.type !== 'event'}
                    >
                      {manualOverrideMutation.isPending ? 'Збереження…' : 'Зберегти (override)'}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>
      </Main>
    </>
  )
}