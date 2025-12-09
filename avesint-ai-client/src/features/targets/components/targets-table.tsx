// avesint-ai-client/src/features/targets/components/targets-table.tsx
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

import type { TargetObject } from '@/features/targets/data/schema'
import { TargetRowActions } from './data-table-row-actions'

type StatusFilter = 'all' | TargetObject['status']
type PriorityFilter = 'all' | TargetObject['priority']

type Props = {
    items: TargetObject[]
    mode: 'active' | 'archived'
    search: string
    statusFilter: StatusFilter
    priorityFilter: PriorityFilter
    onSearchChange: (value: string) => void
    onStatusFilterChange: (value: StatusFilter) => void
    onPriorityFilterChange: (value: PriorityFilter) => void
    onOpenTarget?: (target: TargetObject) => void
    onArchived?: () => void
    onCreateTaskFromTarget?: (target: TargetObject) => void
}

const priorityLabel = (p: TargetObject['priority']) => {
    switch (p) {
        case 'high':
            return 'Високий'
        case 'medium':
            return 'Середній'
        case 'low':
            return 'Низький'
        default:
            return p
    }
}

const statusLabel = (s: TargetObject['status']) => {
    switch (s) {
        case 'candidate':
            return 'Кандидат'
        case 'observed':
            return 'Спостерігається'
        case 'confirmed':
            return 'Підтверджена'
        case 'tasked':
            return 'В роботі'
        case 'neutralized':
            return 'Нейтралізована'
        default:
            return s
    }
}

const priorityVariant = (p: TargetObject['priority']) => {
    switch (p) {
        case 'high':
            return 'destructive'
        case 'medium':
            return 'default'
        case 'low':
        default:
            return 'outline'
    }
}

export function TargetsTable({
                                 items,
                                 mode,
                                 search,
                                 statusFilter,
                                 priorityFilter,
                                 onSearchChange,
                                 onStatusFilterChange,
                                 onPriorityFilterChange,
                                 onOpenTarget,
                                 onArchived,
                                 onCreateTaskFromTarget,
                             }: Props) {
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()

        return items.filter((t) => {
            if (statusFilter !== 'all' && t.status !== statusFilter) return false
            if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false

            if (!q) return true

            const text = [
                t.title,
                t.type,
                t.priority,
                t.status,
                t.notes,
                t.locationText,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()

            return text.includes(q)
        })
    }, [items, search, statusFilter, priorityFilter])

    const handleArchivedInternal = () => {
        onArchived?.()
    }

    return (
        <div className="rounded-xl border bg-background/40 shadow-sm">
            {/* Верхня панель з пошуком та фільтрами */}
            <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="font-semibold">
                        {mode === 'active' ? 'Цілі та обʼєкти' : 'Архів цілей та обʼєктів'}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                        {mode === 'active'
                            ? 'Актуальні обʼєкти/цілі для подальшого аналізу та планування.'
                            : 'Архівні обʼєкти/цілі для ретроспективного аналізу.'}
                    </p>
                </div>

                <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                    <Input
                        placeholder="Пошук за назвою, типом, статусом…"
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
                            <SelectItem value="candidate">Кандидати</SelectItem>
                            <SelectItem value="observed">Спостерігаються</SelectItem>
                            <SelectItem value="confirmed">Підтверджені</SelectItem>
                            <SelectItem value="tasked">В роботі</SelectItem>
                            <SelectItem value="neutralized">Нейтралізовані</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select
                        value={priorityFilter}
                        onValueChange={(v: PriorityFilter) => onPriorityFilterChange(v)}
                    >
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Пріоритет" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Будь-який пріоритет</SelectItem>
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
                        <TableHead>Назва</TableHead>
                        <TableHead>Тип</TableHead>
                        <TableHead>Пріоритет</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead className="hidden md:table-cell">
                            Локація / нотатки
                        </TableHead>
                        <TableHead className="text-right">Дії</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filtered.map((target) => (
                        <TableRow
                            key={target.id}
                            className="cursor-pointer hover:bg-muted/40"
                            onClick={() => onOpenTarget?.(target)}
                        >
                            <TableCell className="align-top">
                                <div className="font-medium">{target.title}</div>
                                {target.notes && (
                                    <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                        {target.notes}
                                    </div>
                                )}
                            </TableCell>
                            <TableCell className="align-top text-xs">
                                {target.type}
                            </TableCell>
                            <TableCell className="align-top">
                                <Badge variant={priorityVariant(target.priority) as never}>
                                    {priorityLabel(target.priority)}
                                </Badge>
                            </TableCell>
                            <TableCell className="align-top">
                                <Badge variant="outline">{statusLabel(target.status)}</Badge>
                            </TableCell>
                            <TableCell className="hidden align-top text-xs text-muted-foreground md:table-cell">
                                {target.locationText || '—'}
                            </TableCell>
                            <TableCell
                                className="align-top text-right"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <TargetRowActions
                                    target={target}
                                    mode={mode}
                                    onOpen={onOpenTarget}
                                    onArchived={handleArchivedInternal}
                                    onCreateTask={onCreateTaskFromTarget}
                                />
                            </TableCell>
                        </TableRow>
                    ))}

                    {filtered.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} className="py-6 text-center text-sm">
                                Немає цілей. Змініть фільтри або створіть нову ціль.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    )
}