// src/features/events/index.tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { getEvent, listEvents } from '@/lib/api/events'
import { listOsintSources, type OsintSource } from '@/lib/api/osint-sources'
import { createTask } from '@/lib/api/tasks'
import { cn } from '@/lib/utils'
import { useOsintStream, type OsintStreamItem } from '@/hooks/useOsintStream'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AiInlineBar } from '@/features/ai/ai-inline-bar'
import type {
  Event,
  EventStatus,
  EventSeverity,
} from '@/features/events/data/schema'
import { TasksCreateDialog } from '@/features/tasks/components/tasks-create-dialog'
import { EventCreateDialog } from './components/event-create-dialog'
import { EventDetails } from './components/event-details'
import { EventsTable } from './components/events-table'

// src/features/events/index.tsx

// src/features/events/index.tsx

type StatusFilter = 'all' | EventStatus
type SeverityFilter = 'all' | EventSeverity

const LS_AI_SOURCES_KEY = 'avesint.ai.eventSources'

const readSearchParams = (): {
  search: string
  statusFilter: StatusFilter
  severityFilter: SeverityFilter
  eventId?: string | null
} => {
  const params = new URLSearchParams(window.location.search)
  return {
    search: params.get('q') ?? '',
    statusFilter: (params.get('status') as StatusFilter | null) ?? 'all',
    severityFilter: (params.get('severity') as SeverityFilter | null) ?? 'all',
    eventId: params.get('eventId'),
  }
}

const writeSearchParams = (
  search: string,
  statusFilter: StatusFilter,
  severityFilter: SeverityFilter
) => {
  const params = new URLSearchParams(window.location.search)

  if (search.trim()) params.set('q', search.trim())
  else params.delete('q')

  if (statusFilter !== 'all') params.set('status', statusFilter)
  else params.delete('status')

  if (severityFilter !== 'all') params.set('severity', severityFilter)
  else params.delete('severity')

  const newUrl = `${window.location.pathname}?${params.toString()}`
  window.history.replaceState({}, '', newUrl)
}

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function getDedupInfo(meta: unknown): {
  matchedEventId?: string
  qdrantScore?: number
  createdEventId?: string
} | null {
  if (!meta || typeof meta !== 'object') return null
  const m = meta as Record<string, unknown>
  const dedup = m.dedup
  if (!dedup || typeof dedup !== 'object') return null
  const d = dedup as Record<string, unknown>

  return {
    matchedEventId:
      typeof d.matchedEventId === 'string' ? d.matchedEventId : undefined,
    createdEventId:
      typeof d.createdEventId === 'string' ? d.createdEventId : undefined,
    qdrantScore: typeof d.qdrantScore === 'number' ? d.qdrantScore : undefined,
  }
}

export function Events() {
  const initial = readSearchParams()

  const [items, setItems] = useState<Event[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selected, setSelected] = useState<Event | null>(null)

  const [searchInput, setSearchInput] = useState(initial.search)
  const [searchQuery, setSearchQuery] = useState(initial.search)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    initial.statusFilter
  )
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>(
    initial.severityFilter
  )

  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [taskEvent, setTaskEvent] = useState<Event | null>(null)

  const [focusedEventId] = useState<string | null>(initial.eventId ?? null)

  const user = useAuthStore((s) => s.auth.user)
  const currentUserCallsign = user?.callsign

  // Джерела (залишаємо тільки як фільтр “які WS‑івенти слухати”, UI можна прибрати окремо)
  const [sourcesLoading, setSourcesLoading] = useState(false)
  const [sourcesError, setSourcesError] = useState<string | null>(null)
  const [availableSources, setAvailableSources] = useState<OsintSource[]>([])
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([])
  const [sourcesMode, setSourcesMode] = useState<'all' | 'selected'>('all')

  useEffect(() => {
    const loadSources = async () => {
      try {
        setSourcesLoading(true)
        setSourcesError(null)
        const srcs = await listOsintSources({ isActive: true })
        setAvailableSources(srcs)

        const raw = localStorage.getItem(LS_AI_SOURCES_KEY)
        const saved = safeParseJson<string[]>(raw)
        const filtered =
          Array.isArray(saved) && saved.length > 0
            ? saved.filter((id) => srcs.some((s) => s.id === id))
            : []

        setSelectedSourceIds(
          filtered.length > 0 ? filtered : srcs.map((s) => s.id)
        )
        setSourcesMode('all')
      } catch {
        setSourcesError('Не вдалося завантажити список джерел OSINT')
      } finally {
        setSourcesLoading(false)
      }
    }

    void loadSources()
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(LS_AI_SOURCES_KEY, JSON.stringify(selectedSourceIds))
    } catch {
      // ignore
    }
  }, [selectedSourceIds])

  const toggleSource = (id: string) => {
    setSelectedSourceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
    setSourcesMode('selected')
  }

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await listEvents({
        page: 1,
        pageSize: 100,
        search: searchQuery || undefined,
        status: statusFilter === 'all' ? undefined : [statusFilter],
        severity: severityFilter === 'all' ? undefined : [severityFilter],
      })
      setItems(res.items)
    } catch {
      setError('Не вдалося завантажити події')
    } finally {
      setLoading(false)
    }
  }, [searchQuery, statusFilter, severityFilter])

  const upsertEventInList = useCallback((incoming: Event) => {
    setItems((prev) => {
      const idx = prev.findIndex((e) => e.id === incoming.id)
      if (idx === -1) return [incoming, ...prev]
      const copy = [...prev]
      copy[idx] = incoming
      return copy
    })
  }, [])

  const refreshSingleEvent = useCallback(
    async (eventId: string) => {
      try {
        const ev = await getEvent(eventId)
        upsertEventInList(ev)
      } catch {
        void load()
      }
    },
    [upsertEventInList, load]
  )

  // ✅ ВАЖЛИВО: WS‑OSINT подія використовується ТІЛЬКИ як тригер оновлення агрегованої “Події”.
  // Ніякого RAW UI/локалстораджу.
  const handleOsintItem = useCallback(
    (osint: OsintStreamItem) => {
      const srcId = osint.source.id
      if (selectedSourceIds.length > 0 && !selectedSourceIds.includes(srcId)) {
        return
      }

      const dedup = getDedupInfo(osint.item.meta)
      const eventId = dedup?.createdEventId ?? dedup?.matchedEventId

      if (eventId) {
        void refreshSingleEvent(eventId)
      } else {
        void load()
      }
    },
    [selectedSourceIds, refreshSingleEvent, load]
  )

  useOsintStream({ onItem: handleOsintItem })

  useEffect(() => {
    const id = setTimeout(() => setSearchQuery(searchInput), 400)
    return () => clearTimeout(id)
  }, [searchInput])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void load()
  }, [searchQuery, statusFilter, severityFilter, load])

  useEffect(() => {
    writeSearchParams(searchQuery, statusFilter, severityFilter)
  }, [searchQuery, statusFilter, severityFilter])

  useEffect(() => {
    if (!focusedEventId) return
    if (!items.length) return

    const ev = items.find((e) => e.id === focusedEventId)
    if (ev) {
      setSelected(ev)
      setDetailsOpen(true)
    }
  }, [items, focusedEventId])

  const handleOpenDetails = (event: Event) => {
    setSelected(event)
    setDetailsOpen(true)
  }

  const handleDetailsOpenChange = (open: boolean) => {
    setDetailsOpen(open)
    if (!open) setSelected(null)
  }

  const handleCreated = async () => {
    setCreateOpen(false)
    await load()
  }

  const handleCreateTaskFromEvent = (event: Event) => {
    setTaskEvent(event)
    setTaskDialogOpen(true)
  }

  const handleTaskCreated = async (values: {
    title: string
    description?: string
    priority: 'high' | 'medium' | 'low'
    assignee?: string
    dueAt?: string
    targetId?: string
    eventId?: string
  }) => {
    try {
      await createTask({
        title: values.title,
        description: values.description,
        priority: values.priority,
        assigneeCallsign: values.assignee,
        dueAt: values.dueAt,
        targetId: values.targetId,
        eventId: values.eventId,
      })
      toast.success('Задачу по події створено')
    } catch {
      toast.error('Не вдалося створити задачу')
    } finally {
      setTaskDialogOpen(false)
      setTaskEvent(null)
    }
  }

  const selectedCount = selectedSourceIds.length
  const totalSources = availableSources.length

  const sourcesHeaderText = useMemo(() => {
    if (sourcesMode === 'all') return 'Усі активні джерела'
    return `Вибрані джерела: ${selectedCount}/${totalSources}`
  }, [sourcesMode, selectedCount, totalSources])

  return (
    <div className='flex h-full flex-col gap-4'>
      {(import.meta.env.VITE_FEATURE_AI_ASSISTANT ?? 'false') === 'true' && (
        <AiInlineBar />
      )}

      <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
        <div className='space-y-1'>
          <h1 className='text-2xl font-bold tracking-tight'>Події</h1>
          <p className='text-muted-foreground text-xs'>
            Агреговані події з evidence (підтвердженням з джерел).
          </p>
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <Button type='button' size='sm' onClick={() => setCreateOpen(true)}>
            + Нова подія
          </Button>
        </div>
      </div>

      <Card className='bg-background/60 space-y-2 border p-3'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div className='text-muted-foreground flex flex-wrap items-center gap-2 text-[11px]'>
            <span className='font-semibold tracking-wide uppercase'>
              Джерела
            </span>
            <span className='text-[10px]'>{sourcesHeaderText}</span>
          </div>

          <Select
            value={sourcesMode}
            onValueChange={(v: 'all' | 'selected') => {
              if (v === 'all') {
                setSelectedSourceIds(availableSources.map((s) => s.id))
                setSourcesMode('all')
              } else {
                setSourcesMode('selected')
              }
            }}
          >
            <SelectTrigger className='h-8 w-[220px] text-xs'>
              <SelectValue placeholder='Режим джерел' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Усі активні джерела</SelectItem>
              <SelectItem value='selected'>Лише вибрані</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className='bg-muted/40 rounded-md border px-2 py-1.5'>
          {sourcesLoading && (
            <p className='text-muted-foreground text-[11px]'>
              Завантаження списку джерел…
            </p>
          )}
          {sourcesError && (
            <p className='text-[11px] text-red-500'>{sourcesError}</p>
          )}

          {!sourcesLoading && !sourcesError && (
            <div className='flex max-h-28 flex-wrap gap-1.5 overflow-y-auto'>
              {availableSources.map((s) => {
                const checked = selectedSourceIds.includes(s.id)
                const tags = (s as unknown as { tags?: string[] }).tags

                return (
                  <button
                    key={s.id}
                    type='button'
                    onClick={() => toggleSource(s.id)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition',
                      checked
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-emerald-50'
                        : 'border-border/70 bg-background text-muted-foreground hover:bg-muted/60'
                    )}
                    title={s.name}
                  >
                    <span className='font-medium'>{s.handle || s.name}</span>
                    {Array.isArray(tags) && tags.length > 0 && (
                      <span className='text-muted-foreground/80 flex gap-1 text-[9px]'>
                        {tags.slice(0, 2).map((tag) => (
                          <span key={tag}>#{tag}</span>
                        ))}
                        {tags.length > 2 && <span>+{tags.length - 2}</span>}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </Card>

      <div className='flex-1'>
        {loading && items.length === 0 && (
          <div className='text-muted-foreground flex h-40 items-center justify-center text-sm'>
            Завантаження…
          </div>
        )}

        {error && !loading && (
          <div className='flex h-40 items-center justify-center text-sm text-red-500'>
            {error}
          </div>
        )}

        {!loading && !error && (
          <EventsTable
            items={items}
            search={searchInput}
            statusFilter={statusFilter}
            severityFilter={severityFilter}
            onSearchChange={setSearchInput}
            onStatusFilterChange={setStatusFilter}
            onSeverityFilterChange={setSeverityFilter}
            onOpenEvent={handleOpenDetails}
            onCreateTaskFromEvent={handleCreateTaskFromEvent}
          />
        )}
      </div>

      <EventCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreated}
      />

      {selected && (
        <EventDetails
          event={selected}
          open={detailsOpen}
          onOpenChange={handleDetailsOpenChange}
        />
      )}

      {taskEvent && (
        <TasksCreateDialog
          open={taskDialogOpen}
          onOpenChange={(open) => {
            setTaskDialogOpen(open)
            if (!open) setTaskEvent(null)
          }}
          onTaskCreated={handleTaskCreated}
          parentTask={null}
          currentUserCallsign={currentUserCallsign}
          isAdminOrOfficer={!!user?.role}
          linkedEventId={taskEvent.id}
          linkedEventTitle={taskEvent.title}
          initialTitle={`[Подія] ${taskEvent.title}`}
          initialDescription={taskEvent.summary ?? taskEvent.description ?? ''}
        />
      )}
    </div>
  )
}
