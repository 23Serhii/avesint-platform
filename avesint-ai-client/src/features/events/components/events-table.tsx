// src/features/events/components/events-table.tsx
import { useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

import type {
    Event,
    EventSeverity,
    EventStatus,
} from '@/features/events/data/schema'
import { EventRowActions } from './event-row-actions'

type StatusFilter = 'all' | EventStatus
type SeverityFilter = 'all' | EventSeverity

type Props = {
    items: Event[]
    search: string
    statusFilter: StatusFilter
    severityFilter: SeverityFilter
    onSearchChange: (value: string) => void
    onStatusFilterChange: (value: StatusFilter) => void
    onSeverityFilterChange: (value: SeverityFilter) => void
    onOpenEvent?: (event: Event) => void
    onCreateTaskFromEvent?: (event: Event) => void
}

const severityLabel = (s: EventSeverity) => {
    switch (s) {
        case 'critical':
            return 'Критичний'
        case 'high':
            return 'Високий'
        case 'medium':
            return 'Середній'
        case 'low':
            return 'Низький'
        default:
            return s
    }
}

const statusLabel = (s: EventStatus) => {
    switch (s) {
        case 'new':
            return 'Нова'
        case 'triage':
            return 'На верифікації'
        case 'confirmed':
            return 'Підтверджено'
        case 'dismissed':
            return 'Відкинуто'
        case 'archived':
            return 'Архів'
        default:
            return s
    }
}

const severityVariant = (s: EventSeverity) => {
    switch (s) {
        case 'critical':
            return 'destructive'
        case 'high':
            return 'default'
        case 'medium':
            return 'outline'
        case 'low':
        default:
            return 'outline'
    }
}

// Локальне обрізання ТІЛЬКИ ДЛЯ ВІДОБРАЖЕННЯ в таблиці
function truncate(text: string | null | undefined, max: number): string {
    if (!text) return ''
    if (text.length <= max) return text
    return text.slice(0, max - 1).trimEnd() + '…'
}

export function EventsTable({
                                items,
                                search,
                                statusFilter,
                                severityFilter,
                                onSearchChange,
                                onStatusFilterChange,
                                onSeverityFilterChange,
                                onOpenEvent,
                                onCreateTaskFromEvent,
                            }: Props) {
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()

        return items.filter((e) => {
            if (statusFilter !== 'all' && e.status !== statusFilter) return false
            if (severityFilter !== 'all' && e.severity !== severityFilter) return false

            if (!q) return true

            const text = [
                e.title,
                e.summary,
                e.description,
                e.incidentId,
                e.sourceIds?.join(' '),
                e.tags?.join(' '),
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()

            return text.includes(q)
        })
    }, [items, search, statusFilter, severityFilter])

    return (
        <div className="w-full rounded-xl border bg-background/40 shadow-sm">
            {/* Верхня панель */}
            <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="font-semibold">Стрічка подій</h3>
                    <p className="text-xs text-muted-foreground">
                        Вхідні OSINT‑події, ситрепи та тригери від парсерів. Фільтруйте за
                        статусом та важливістю.
                    </p>
                </div>

                <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                    <Input
                        placeholder="Пошук за текстом, тегами, інцидентом…"
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="max-w-xs"
                    />

                    <Select
                        value={statusFilter}
                        onValueChange={(v: StatusFilter) => onStatusFilterChange(v)}
                    >
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Статус" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Будь-який статус</SelectItem>
                            <SelectItem value="new">Нові</SelectItem>
                            <SelectItem value="triage">На верифікації</SelectItem>
                            <SelectItem value="confirmed">Підтверджені</SelectItem>
                            <SelectItem value="dismissed">Відкинуті</SelectItem>
                            <SelectItem value="archived">Архів</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select
                        value={severityFilter}
                        onValueChange={(v: SeverityFilter) =>
                            onSeverityFilterChange(v)
                        }
                    >
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Важливість" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Будь-яка</SelectItem>
                            <SelectItem value="critical">Критичний</SelectItem>
                            <SelectItem value="high">Високий</SelectItem>
                            <SelectItem value="medium">Середній</SelectItem>
                            <SelectItem value="low">Низький</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Таблиця */}
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[45%]">Подія</TableHead>
                        <TableHead className="w-[15%]">Час</TableHead>
                        <TableHead className="w-[10%]">Важливість</TableHead>
                        <TableHead className="w-[10%]">Статус</TableHead>
                        <TableHead className="hidden w-[10%] md:table-cell">
                            Інцидент / джерела
                        </TableHead>
                        <TableHead className="w-[10%] text-right">Дії</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filtered.map((event) => (
                        <TableRow
                            key={event.id}
                            className="cursor-pointer hover:bg-muted/40"
                            onClick={() => onOpenEvent?.(event)}
                        >
                            <TableCell className="align-top">
                                <div className="font-medium">
                                    {truncate(event.title, 70)}
                                </div>
                                {event.summary && (
                                    <div className="mt-0.5 text-xs text-muted-foreground">
                                        {truncate(event.summary, 120)}
                                    </div>
                                )}
                                {event.tags && event.tags.length > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {event.tags.map((tag) => (
                                            <Badge
                                                key={tag}
                                                variant="outline"
                                                className="text-[10px]"
                                            >
                                                {tag}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </TableCell>
                            <TableCell className="align-top text-xs text-muted-foreground">
                                {new Date(event.occurredAt).toLocaleString('uk-UA', {
                                    dateStyle: 'short',
                                    timeStyle: 'short',
                                })}
                            </TableCell>
                            <TableCell className="align-top">
                                <Badge
                                    variant={severityVariant(event.severity) as never}
                                >
                                    {severityLabel(event.severity)}
                                </Badge>
                            </TableCell>
                            <TableCell className="align-top">
                                <Badge variant="outline">
                                    {statusLabel(event.status)}
                                </Badge>
                            </TableCell>
                            <TableCell className="hidden align-top text-xs text-muted-foreground md:table-cell">
                                {event.incidentId ||
                                    event.sourceIds?.join(', ') ||
                                    '—'}
                            </TableCell>
                            <TableCell
                                className="align-top text-right"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <EventRowActions
                                    event={event}
                                    onOpen={onOpenEvent}
                                    onCreateTask={onCreateTaskFromEvent}
                                />
                            </TableCell>
                        </TableRow>
                    ))}

                    {filtered.length === 0 && (
                        <TableRow>
                            <TableCell
                                colSpan={6}
                                className="py-6 text-center text-sm"
                            >
                                Немає подій. Змініть фільтри або створіть нову подію.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    )
}