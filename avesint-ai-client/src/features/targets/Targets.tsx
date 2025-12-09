// avesint-ai-client/src/features/targets/Targets.tsx
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import type { TargetObject } from '@/features/targets/data/schema'
import { listTargets } from '@/lib/api/targets'
import { TargetsTable } from './components/targets-table'
import { TargetCreateDialog } from './components/target-create-dialog'
import { TargetDetails } from './components/target-details'
import { toast } from 'sonner'
import { createTask } from '@/lib/api/tasks'
import { TasksCreateDialog } from '@/features/tasks/components/tasks-create-dialog'
import { useAuthStore } from '@/stores/auth-store'

type Mode = 'active' | 'archived'
type StatusFilter = 'all' | TargetObject['status']
type PriorityFilter = 'all' | TargetObject['priority']

const readSearchParams = (): {
    mode: Mode
    search: string
    statusFilter: StatusFilter
    priorityFilter: PriorityFilter
} => {
    const params = new URLSearchParams(window.location.search)
    const modeParam = params.get('mode') === 'archived' ? 'archived' : 'active'
    const q = params.get('q') ?? ''
    const statusParam = (params.get('status') as StatusFilter | null) ?? 'all'
    const priorityParam = (params.get('priority') as PriorityFilter | null) ?? 'all'

    return {
        mode: modeParam,
        search: q,
        statusFilter: statusParam,
        priorityFilter: priorityParam,
    }
}

const writeSearchParams = (
    mode: Mode,
    search: string,
    statusFilter: StatusFilter,
    priorityFilter: PriorityFilter,
) => {
    const params = new URLSearchParams(window.location.search)

    params.set('mode', mode)
    if (search.trim()) params.set('q', search.trim())
    else params.delete('q')

    if (statusFilter !== 'all') params.set('status', statusFilter)
    else params.delete('status')

    if (priorityFilter !== 'all') params.set('priority', priorityFilter)
    else params.delete('priority')

    const newUrl = `${window.location.pathname}?${params.toString()}`
    window.history.replaceState({}, '', newUrl)
}

export function Targets() {
    const initial = readSearchParams()

    const [mode, setMode] = useState<Mode>(initial.mode)
    const [items, setItems] = useState<TargetObject[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [createOpen, setCreateOpen] = useState(false)
    const [detailsOpen, setDetailsOpen] = useState(false)
    const [selected, setSelected] = useState<TargetObject | null>(null)

    const [search, setSearch] = useState(initial.search)
    const [statusFilter, setStatusFilter] = useState<StatusFilter>(initial.statusFilter)
    const [priorityFilter, setPriorityFilter] =
        useState<PriorityFilter>(initial.priorityFilter)

    const [taskDialogOpen, setTaskDialogOpen] = useState(false)
    const [taskTarget, setTaskTarget] = useState<TargetObject | null>(null)

    const user = useAuthStore((s) => s.auth.user)
    const isAdminOrOfficer =
        user?.role === 'ADMIN' || user?.role === 'OFFICER' || user?.role === 'officer'
    const currentUserCallsign = user?.callsign

    const load = async (currentMode: Mode) => {
        try {
            setLoading(true)
            setError(null)
            const res = await listTargets({ archived: currentMode === 'archived' })
            setItems(res.items)
        } catch {
            setError('Не вдалося завантажити цілі')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void load(mode)
    }, [mode])

    useEffect(() => {
        writeSearchParams(mode, search, statusFilter, priorityFilter)
    }, [mode, search, statusFilter, priorityFilter])

    const handleOpenDetails = (target: TargetObject) => {
        setSelected(target)
        setDetailsOpen(true)
    }

    const handleArchived = async () => {
        await load(mode)
    }

    const handleCreateOpenChange = (open: boolean) => {
        setCreateOpen(open)
    }

    const handleCreate = async () => {
        setCreateOpen(false)
        setMode('active')
        await load('active')
    }

    const handleDetailsOpenChange = (open: boolean) => {
        setDetailsOpen(open)
        if (!open) {
            setSelected(null)
        }
    }

    const handleCreateTaskFromTarget = (target: TargetObject) => {
        setTaskTarget(target)
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
            toast.success('Задачу створено')
        } catch {
            toast.error('Не вдалося створити задачу')
        } finally {
            setTaskDialogOpen(false)
            setTaskTarget(null)
        }
    }

    return (
        <div className="flex h-full flex-col gap-4">
            {/* Верхній бар з режимами та створенням */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <div className="inline-flex rounded-full border bg-background p-0.5">
                        <Button
                            type="button"
                            variant={mode === 'active' ? 'default' : 'ghost'}
                            size="sm"
                            className={cn(
                                'h-7 rounded-full px-4 text-xs',
                                mode === 'active' && 'shadow-sm',
                            )}
                            onClick={() => setMode('active')}
                        >
                            Активні
                        </Button>
                        <Button
                            type="button"
                            variant={mode === 'archived' ? 'default' : 'ghost'}
                            size="sm"
                            className={cn(
                                'h-7 rounded-full px-4 text-xs',
                                mode === 'archived' && 'shadow-sm',
                            )}
                            onClick={() => setMode('archived')}
                        >
                            Архів
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Перемикайтеся між чинними цілями та архівом для ретроспективного аналізу.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        size="sm"
                        onClick={() => setCreateOpen(true)}
                    >
                        + Нова ціль
                    </Button>
                </div>
            </div>

            {/* Реєстр цілей у картці з контролем overflow */}
            <Card className="flex min-h-0 flex-1 flex-col">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b px-4 py-2">
                    <div className="min-w-0">
                        <CardTitle className="text-sm">Реєстр цілей та обʼєктів</CardTitle>
                        <CardDescription className="truncate text-xs">
                            Табличний перелік цілей з фільтрами по статусу, пріоритету та пошуку.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden px-0 pb-0 pt-0">
                    {loading && items.length === 0 && (
                        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                            Завантаження…
                        </div>
                    )}

                    {error && !loading && (
                        <div className="flex h-40 items-center justify-center px-4 text-center text-sm text-red-500">
                            {error}
                        </div>
                    )}

                    {!loading && !error && (
                        <div className="h-full overflow-x-auto">
                            <div className="min-w-full">
                                <TargetsTable
                                    items={items}
                                    mode={mode}
                                    search={search}
                                    statusFilter={statusFilter}
                                    priorityFilter={priorityFilter}
                                    onSearchChange={setSearch}
                                    onStatusFilterChange={setStatusFilter}
                                    onPriorityFilterChange={setPriorityFilter}
                                    onOpenTarget={handleOpenDetails}
                                    onArchived={handleArchived}
                                    onCreateTaskFromTarget={handleCreateTaskFromTarget}
                                />
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Діалог створення цілі */}
            <TargetCreateDialog
                open={createOpen}
                onOpenChange={handleCreateOpenChange}
                onCreate={handleCreate}
            />

            {/* Деталі цілі */}
            {selected && (
                <TargetDetails
                    target={selected}
                    open={detailsOpen}
                    onOpenChange={handleDetailsOpenChange}
                />
            )}

            {/* Діалог створення задачі по цілі */}
            {taskTarget && (
                <TasksCreateDialog
                    open={taskDialogOpen}
                    onOpenChange={(open) => {
                        setTaskDialogOpen(open)
                        if (!open) setTaskTarget(null)
                    }}
                    onTaskCreated={handleTaskCreated}
                    parentTask={null}
                    currentUserCallsign={currentUserCallsign}
                    isAdminOrOfficer={!!isAdminOrOfficer}
                    linkedTargetId={taskTarget.id}
                    linkedTargetTitle={taskTarget.title}
                    initialTitle={`[Ціль] ${taskTarget.title}`}
                    initialDescription={taskTarget.notes ?? ''}
                />
            )}
        </div>
    )
}