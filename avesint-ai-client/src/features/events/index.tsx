// src/features/events/index.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { AiInlineBar } from '@/features/ai/ai-inline-bar'

import { EventsTable } from './components/events-table'
import { EventCreateDialog } from './components/event-create-dialog'
import { EventDetails } from './components/event-details'
import { TasksCreateDialog } from '@/features/tasks/components/tasks-create-dialog'
import { createTask } from '@/lib/api/tasks'
import { useAuthStore } from '@/stores/auth-store'
import { listEvents } from '@/lib/api/events'
import type {
    Event,
    EventStatus,
    EventSeverity,
} from '@/features/events/data/schema'
import {
    useOsintStream,
    type OsintStreamItem,
} from '@/hooks/useOsintStream'
import {
    listOsintSources,
    type OsintSource,
} from '@/lib/api/osint-sources'
import { Badge } from 'lucide-react'  // 🔹 новий імпорт

type StatusFilter = 'all' | EventStatus
type SeverityFilter = 'all' | EventSeverity

const readSearchParams = (): {
    search: string
    statusFilter: StatusFilter
    severityFilter: SeverityFilter
    eventId?: string | null
} => {
    const params = new URLSearchParams(window.location.search)
    const q = params.get('q') ?? ''
    const statusParam =
        (params.get('status') as StatusFilter | null) ?? 'all'
    const severityParam =
        (params.get('severity') as SeverityFilter | null) ?? 'all'
    const eventId = params.get('eventId')

    return {
        search: q,
        statusFilter: statusParam,
        severityFilter: severityParam,
        eventId,
    }
}

const writeSearchParams = (
    search: string,
    statusFilter: StatusFilter,
    severityFilter: SeverityFilter,
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


// 🔹 локальний ключ для вибраних джерел AI
const LS_AI_SOURCES_KEY = 'avesint.ai.eventSources'

// Головний компонент сторінки "Стрічка подій"
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

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>(initial.statusFilter)
  const [severityFilter, setSeverityFilter] =
    useState<SeverityFilter>(initial.severityFilter)

  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [taskEvent, setTaskEvent] = useState<Event | null>(null)

  const [focusedEventId] = useState<string | null>(initial.eventId ?? null)

  const user = useAuthStore((s) => s.auth.user)
  const currentUserCallsign = user?.callsign

  // --- Налаштування джерел OSINT для стрічки ---

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

        try {
          const raw = localStorage.getItem(LS_AI_SOURCES_KEY)
          if (raw) {
            const saved = JSON.parse(raw) as string[]
            const filtered = saved.filter((id) => srcs.some((s) => s.id === id))
            setSelectedSourceIds(filtered.length > 0 ? filtered : srcs.map((s) => s.id))
          } else {
            setSelectedSourceIds(srcs.map((s) => s.id))
          }
        } catch {
          setSelectedSourceIds(srcs.map((s) => s.id))
        }

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
    setSelectedSourceIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      return next
    })
    setSourcesMode('selected')
  }

  const normalizeForTable = (raw: Event[]): Event[] => raw

  // завантаження подій із бекенду
  const load = async () => {
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
      setItems(normalizeForTable(res.items))
    } catch {
      setError('Не вдалося завантажити події')
    } finally {
      setLoading(false)
    }
  }

  // --- OSINT live → Event ---
  const mapOsintToEvent = useCallback(
    (entry: OsintStreamItem): Event => {
      const { source, item } = entry

      let severity: EventSeverity = 'medium'
      switch (item.priority) {
        case 'critical':
          severity = 'critical'
          break
        case 'high':
          severity = 'high'
          break
        case 'low':
          severity = 'low'
          break
        case 'medium':
        default:
          severity = 'medium'
          break
      }

      const status: EventStatus = 'new'
      const occurredAt = item.eventDate ?? item.parseDate
      const nowIso = new Date().toISOString()

      const externalRef =
        item.rawUrl ??
        (item.externalId && item.externalId.startsWith('telegram:')
          ? item.externalId
          : undefined)

      return {
        id: `osint:${entry.id}`,
        title: item.title || item.summary || item.content || 'Без назви',
        summary: item.summary || undefined,
        description: item.content,
        type: (item.type as any) || 'other_enemy_activity',
        severity,
        status,
        theater: 'ru',
        confidence:
          typeof item.credibility === 'number'
            ? Math.max(0, Math.min(1, item.credibility))
            : undefined,
        latitude: null,
        longitude: null,
        incidentId: null,
        sourceIds: [source.name],
        occurredAt,
        createdAt: nowIso,
        updatedAt: nowIso,
        tags: item.tags ?? [],
        imageUrl: undefined,
        externalRef,
      }
    },
    [],
  )

  const handleOsintItem = useCallback(
    (osint: OsintStreamItem) => {
      const srcId = osint.source.id

      // фільтр тільки за вибраними джерелами
      if (selectedSourceIds.length > 0 && !selectedSourceIds.includes(srcId)) {
        return
      }

      const ev = mapOsintToEvent(osint)
      setItems((prev) => [ev, ...prev].slice(0, 300))
      // eslint-disable-next-line no-console
      console.log('[Events] New OSINT item mapped to event:', ev)
    },
    [mapOsintToEvent, selectedSourceIds],
  )

  useOsintStream({ onItem: handleOsintItem })

  // debounce пошуку
  useEffect(() => {
    const id = setTimeout(() => {
      setSearchQuery(searchInput)
    }, 400)
    return () => clearTimeout(id)
  }, [searchInput])

  // перезавантажуємо дані при зміні фільтрів / searchQuery
  useEffect(() => {
    void load()
  }, [searchQuery, statusFilter, severityFilter])

  // оновлюємо query‑строку
  useEffect(() => {
    writeSearchParams(searchQuery, statusFilter, severityFilter)
  }, [searchQuery, statusFilter, severityFilter])

  // якщо прийшли з задачі з eventId — відкриваємо деталі
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
    if (!open) {
      setSelected(null)
    }
  }

  const handleCreateOpenChange = (open: boolean) => {
    setCreateOpen(open)
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

  return (
    <div className="flex h-full flex-col gap-4">
      {(import.meta.env.VITE_FEATURE_AI_ASSISTANT ?? 'false') === 'true' && (
        <AiInlineBar />
      )}

      {/* Заголовок */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Стрічка подій
          </h1>
          <p className="text-xs text-muted-foreground">
            Вхідні OSINT‑події, ситрепи та тригери від парсерів. Швидкий
            огляд, фільтрація та постановка задач.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            + Нова подія
          </Button>
        </div>
      </div>

      {/* Джерела OSINT — повністю новий лейаут */}
      <Card className="space-y-2 border bg-background/60 p-3">
        {/* Верхній рядок */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="font-semibold uppercase tracking-wide">
              Джерела OSINT
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10px]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              live
            </span>
            <span className="text-[10px]">
              Всього: {totalSources} · Вибрано: {selectedCount}
            </span>
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
            <SelectTrigger className="h-8 w-[190px] text-xs">
              <SelectValue placeholder="Режим джерел" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Усі активні джерела</SelectItem>
              <SelectItem value="selected">Лише вибрані</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Чіпи джерел */}
        <div className="rounded-md border bg-muted/40 px-2 py-1.5">
          {sourcesLoading && (
            <p className="text-[11px] text-muted-foreground">
              Завантаження списку джерел…
            </p>
          )}
          {sourcesError && (
            <p className="text-[11px] text-red-500">{sourcesError}</p>
          )}

          {!sourcesLoading && !sourcesError && (
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
              {availableSources.map((s) => {
                const checked = selectedSourceIds.includes(s.id)
                const tags = (s as any).tags as string[] | undefined

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSource(s.id)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition',
                      checked
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-emerald-50'
                        : 'border-border/70 bg-background text-muted-foreground hover:bg-muted/60',
                    )}
                    title={s.name}
                  >
                    <span className="font-medium">
                      {s.handle || s.name}
                    </span>
                    {Array.isArray(tags) && tags.length > 0 && (
                      <span className="flex gap-1 text-[9px] text-muted-foreground/80">
                        {tags.slice(0, 2).map((tag) => (
                          <span key={tag}>#{tag}</span>
                        ))}
                        {tags.length > 2 && (
                          <span>+{tags.length - 2}</span>
                        )}
                      </span>
                    )}
                  </button>
                )
              })}

              {availableSources.length === 0 && (
                <span className="text-[11px] text-muted-foreground">
                  Немає активних джерел.
                </span>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Таблиця на всю ширину */}
      <div className="flex-1">
        {loading && items.length === 0 && (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            Завантаження…
          </div>
        )}

        {error && !loading && (
          <div className="flex h-40 items-center justify-center text-sm text-red-500">
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

      {/* Діалог створення події */}
      <EventCreateDialog
        open={createOpen}
        onOpenChange={handleCreateOpenChange}
        onCreate={handleCreated}
      />

      {/* Деталі події */}
      {selected && (
        <EventDetails
          event={selected}
          open={detailsOpen}
          onOpenChange={handleDetailsOpenChange}
        />
      )}

      {/* Діалог створення задачі по події */}
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
          initialDescription={
            taskEvent.summary ?? taskEvent.description ?? ''
          }
        />
      )}
    </div>
  )
}