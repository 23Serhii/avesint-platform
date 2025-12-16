// src/features/tasks/index.tsx
import {useEffect, useState} from 'react'
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query'
import {Header} from '@/components/layout/header'
import {Main} from '@/components/layout/main'
import {Search} from '@/components/search'
import {ThemeSwitch} from '@/components/theme-switch'
import {ConfigDrawer} from '@/components/config-drawer'
import {ProfileDropdown} from '@/components/profile-dropdown'
import {Tabs, TabsList, TabsTrigger} from '@/components/ui/tabs'

import {TasksTable} from './components/tasks-table'
import {TasksCreateDialog} from './components/tasks-create-dialog'
import {useAuthStore} from '@/stores/auth-store'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {listTasks, createTask, deleteTask, updateTask, type TaskDto, TaskPriority, TaskStatus} from '@/lib/api/tasks'

import {toast} from 'sonner'
import type {TaskCreateFormValues} from './components/task-create-form'
import {AxiosError} from "axios";
import {useRouter} from "@tanstack/react-router";

function normalizeRoles(raw: unknown): string[] {
    if (!raw) return []
    if (Array.isArray(raw)) {
        return raw.map((r) => String(r).toLowerCase().replace(/^role_/, ''))
    }

    return String(raw)
        .split(',')
        .map((r) => r.trim().toLowerCase().replace(/^role_/, ''))
}

export function Tasks() {
    const queryClient = useQueryClient()
    const {auth} = useAuthStore()
    const roles = normalizeRoles(auth.user?.role ?? (auth.user as any)?.roles)

    const isAdmin = roles.includes('admin')
    const isOfficer = roles.includes('officer')
    const isAnalyst = roles.includes('analyst')
    const isUser = roles.includes('user')
    const isAdminOrOfficer = isAdmin || isOfficer

    const canViewAll = isAdmin || isOfficer
    const canViewMy = isOfficer || isAnalyst || isUser

    const [view, setView] = useState<'all' | 'my'>(() => {
        if (canViewAll) return 'all'
        if (canViewMy) return 'my'
        return 'all'
    })

    useEffect(() => {
        setView((current) => {
            if (current === 'all' && !canViewAll && canViewMy) return 'my'
            if (current === 'my' && !canViewMy && canViewAll) return 'all'
            return current
        })
    }, [canViewAll, canViewMy])

    // Прапорець: активні чи архівні задачі
    const [showArchived, setShowArchived] = useState(false)

    const {data, isLoading} = useQuery({
        queryKey: ['tasks', {view, showArchived}],
        queryFn: () =>
            listTasks({
                page: 1,
                pageSize: 50,
                archived: showArchived ? true : false,
            }),
    })

    const allItems: TaskDto[] = data?.items ?? []

    const filteredItems =
        view === 'all'
            ? allItems
            : allItems.filter((t) => t.assigneeCallsign === auth.user?.callsign)

    const [createOpen, setCreateOpen] = useState(false)
    const [selectedTask, setSelectedTask] = useState<TaskDto | null>(null)
    const [detailsOpen, setDetailsOpen] = useState(false)
    const [archivingTask, setArchivingTask] = useState<TaskDto | null>(null)
    const [parentForSubtask, setParentForSubtask] = useState<TaskDto | null>(null)
    const handleTaskCreated = async (values: TaskCreateFormValues) => {
        try {
            await createTask({
                title: values.title,
                description: values.description || undefined,
                priority: values.priority,
                assigneeCallsign:
                    parentForSubtask && !isAdminOrOfficer
                        ? auth.user?.callsign
                        : values.assignee,
                dueAt: values.dueAt || undefined,
                parentTaskId: parentForSubtask ? parentForSubtask.id : undefined,
            } as any)

            await queryClient.invalidateQueries({queryKey: ['tasks']})
            setCreateOpen(false)
            setParentForSubtask(null)
            toast.success(
                parentForSubtask ? 'Підзадачу створено' : 'Задачу створено',
            )
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error(err)

            let msg = parentForSubtask
                ? 'Не вдалося створити підзадачу'
                : 'Не вдалося створити задачу'

            if (err instanceof AxiosError) {
                const backendMsg =
                    (err.response?.data as any)?.message ??
                    (err.response?.data as any)?.title

                if (typeof backendMsg === 'string' && backendMsg.trim().length > 0) {
                    msg = backendMsg
                }
            }

            toast.error(msg)
        }
    }

    const handleOpenTask = (task: TaskDto) => {
        setSelectedTask(task)
        setDetailsOpen(true)
    }

    const handleCreateSubtask = (task: TaskDto) => {
        setParentForSubtask(task)
        setCreateOpen(true)
    }

    // Мутація "видалення" → архівування
    const deleteMutation = useMutation({
        mutationFn: (id: string) => deleteTask(id),
        onSuccess: async () => {
            toast.success('Задачу архівовано')
            await queryClient.invalidateQueries({queryKey: ['tasks']})
        },
        onError: () => {
            toast.error('Не вдалося архівувати задачу')
        },
    })

    const handleDeleteTask = (task: TaskDto) => {
        setArchivingTask(task)
    }

    // Мутація оновлення задачі (редагування)
    const updateMutation = useMutation({
        mutationFn: (params: { id: string; data: Partial<TaskDto> }) =>
            updateTask(params.id, params.data),
        onSuccess: async () => {
            toast.success('Задачу оновлено')
            await queryClient.invalidateQueries({queryKey: ['tasks']})
        },
        onError: () => {
            toast.error('Не вдалося оновити задачу')
        },
    })

    return (
        <>
            <Header fixed>
                <Search/>
                <div className="ms-auto flex items-center space-x-4">
                    <ThemeSwitch/>
                    <ConfigDrawer/>
                    {/* <ProfileDropdown/> */}
                </div>
            </Header>

            <Main className="flex flex-col gap-6">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            Задачі відділу
                        </h1>
                        <p className="text-muted-foreground">
                            Панель начальника та посадових осіб для постановки й контролю задач.
                        </p>
                    </div>
                    {isLoading && (
                        <div className="text-xs text-muted-foreground">
                            Завантаження задач…
                        </div>
                    )}
                </div>

                <Tabs
                    value={view}
                    onValueChange={(val) => setView(val as 'all' | 'my')}
                    className="flex flex-1 flex-col gap-4"
                >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <TabsList>
                            {canViewAll && <TabsTrigger value="all">Усі задачі</TabsTrigger>}
                            {canViewMy && <TabsTrigger value="my">Мої задачі</TabsTrigger>}
                        </TabsList>

                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant={showArchived ? 'outline' : 'ghost'}
                                size="sm"
                                onClick={() => setShowArchived((v) => !v)}
                            >
                                {showArchived ? 'Показати активні' : 'Показати архів'}
                            </Button>

                            {isAdminOrOfficer && (
                                <Button size="sm" onClick={() => {
                                    setParentForSubtask(null)
                                    setCreateOpen(true)
                                }}>
                                    + Нова задача
                                </Button>
                            )}
                        </div>
                    </div>

                    <TasksTable
                        items={filteredItems}
                        mode={view}
                        currentCallsign={auth.user?.callsign}
                        currentRole={undefined}
                        showRoleFilter={view === 'all' && canViewAll}
                        onCreateClick={() => {
                            setParentForSubtask(null)
                            setCreateOpen(true)
                        }}
                        onOpenTask={handleOpenTask}
                        onDeleteTask={handleDeleteTask}
                        onCreateSubtask={handleCreateSubtask} // ← привʼязка
                        canArchive={!showArchived}
                    />
                </Tabs>
            </Main>

            <TasksCreateDialog
                open={createOpen}
                onOpenChange={(open) => {
                    setCreateOpen(open)
                    if (!open) setParentForSubtask(null)
                }}
                onTaskCreated={handleTaskCreated}
                parentTask={parentForSubtask}
                currentUserCallsign={auth.user?.callsign}
                isAdminOrOfficer={isAdminOrOfficer}
            />
            <TaskDetailsDialog
                task={selectedTask}
                open={detailsOpen}
                onOpenChange={(open) => {
                    setDetailsOpen(open)
                    if (!open) setSelectedTask(null)
                }}
                onSave={(partial) => {
                    if (!selectedTask) return
                    updateMutation.mutate({id: selectedTask.id, data: partial})
                }}
                saving={updateMutation.isPending}
            />

            <ArchiveTaskDialog
                task={archivingTask}
                onCancel={() => setArchivingTask(null)}
                onConfirm={() => {
                    if (!archivingTask) return
                    deleteMutation.mutate(archivingTask.id)
                    setArchivingTask(null)
                }}
            />
        </>
    )
}

type TaskDetailsDialogProps = {
    task: TaskDto | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSave: (partial: { status?: TaskStatus; priority?: TaskPriority }) => void
    saving: boolean
}

function TaskDetailsDialog({
                               task,
                               open,
                               onOpenChange,
                               onSave,
                               saving,
                           }: TaskDetailsDialogProps) {
    const router = useRouter()

    if (!task) return null

    const [localStatus, setLocalStatus] = useState<TaskStatus>(task.status)
    const [localPriority, setLocalPriority] = useState<TaskPriority>(task.priority)

    // якщо міняємо task – синхронізуємо локальний стейт
    useEffect(() => {
        if (!task) return
        setLocalStatus(task.status)
        setLocalPriority(task.priority)
    }, [task])

    const title = task.title ?? `Задача #${task.id}`
    const description = task.description ?? ''
    const assignee = task.assigneeCallsign
    const createdAt = task.createdAt
    const dueDate = task.dueAt
    const isArchived = task.archived

    const handleSave = () => {
        if (isArchived) return
        onSave({status: localStatus, priority: localPriority})
    }

    const statusLabel = (s: TaskStatus) =>
        s === 'new' ? 'Нова' : s === 'in_progress' ? 'В роботі' : 'Виконана'

    const priorityLabel = (p: TaskPriority) =>
        p === 'high' ? 'Високий' : p === 'medium' ? 'Середній' : 'Низький'
    const goToTarget = async () => {
        if (!task.targetId) return
        await router.navigate({
            to: '/targets',
        })
    }

    const goToEvent = async () => {
        if (!task.eventId) return
        await router.navigate({
            to: '/events',
            // додаємо ідентифікатор події в query; типізацію спрощуємо через any
            search: { eventId: task.eventId } as any,
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        Детальна інформація по задачі штабу.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {(task.targetId || task.eventId) && (
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            {task.targetId && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-6 rounded-full px-2"
                                    onClick={goToTarget}
                                >
                                    <Badge
                                        variant="outline"
                                        className="mr-1 px-1 py-0 text-[10px]"
                                    >
                                        Ціль
                                    </Badge>
                                    Перейти до цілі
                                </Button>
                            )}

                            {task.eventId && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-6 rounded-full px-2"
                                    onClick={goToEvent}
                                >
                                    <Badge
                                        variant="outline"
                                        className="mr-1 px-1 py-0 text-[10px]"
                                    >
                                        Подія
                                    </Badge>
                                    Перейти до події
                                </Button>
                            )}
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                        {assignee && (
                            <Badge variant="outline">
                                Виконавець: {String(assignee)}
                            </Badge>
                        )}
                        {isArchived && (
                            <Badge variant="secondary">
                                Архівована
                            </Badge>
                        )}
                    </div>

                    {description && (
                        <div>
                            <h4 className="mb-1 text-sm font-medium text-muted-foreground">
                                Опис
                            </h4>
                            <p className="whitespace-pre-wrap text-sm">
                                {description}
                            </p>
                        </div>
                    )}

                    <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                        {createdAt && (
                            <div>
                                <span className="font-medium">Створено:</span>{' '}
                                {new Date(createdAt).toLocaleString('uk-UA')}
                            </div>
                        )}
                        {dueDate && (
                            <div>
                                <span className="font-medium">Дедлайн:</span>{' '}
                                {new Date(dueDate).toLocaleString('uk-UA')}
                            </div>
                        )}
                    </div>

                    {/* Блок редагування статусу / пріоритету */}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                Статус
              </span>
                            <select
                                className="h-8 w-full rounded border bg-background px-2 text-xs"
                                disabled={isArchived || saving}
                                value={localStatus}
                                onChange={(e) => setLocalStatus(e.target.value as TaskStatus)}
                            >
                                <option value="new">Нова</option>
                                <option value="in_progress">В роботі</option>
                                <option value="done">Виконана</option>
                            </select>
                            <p className="text-[11px] text-muted-foreground">
                                Поточний: {statusLabel(task.status)}
                            </p>
                        </div>

                        <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                Пріоритет
              </span>
                            <select
                                className="h-8 w-full rounded border bg-background px-2 text-xs"
                                disabled={isArchived || saving}
                                value={localPriority}
                                onChange={(e) =>
                                    setLocalPriority(e.target.value as TaskPriority)
                                }
                            >
                                <option value="high">Високий</option>
                                <option value="medium">Середній</option>
                                <option value="low">Низький</option>
                            </select>
                            <p className="text-[11px] text-muted-foreground">
                                Поточний: {priorityLabel(task.priority)}
                            </p>
                        </div>
                    </div>

                    <div className="mt-4 flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Закрити
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSave}
                            disabled={isArchived || saving}
                        >
                            {saving ? 'Збереження…' : 'Зберегти зміни'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

type ArchiveTaskDialogProps = {
    task: TaskDto | null
    onCancel: () => void
    onConfirm: () => void
}

function ArchiveTaskDialog({task, onCancel, onConfirm}: ArchiveTaskDialogProps) {
    return (
        <Dialog open={!!task} onOpenChange={(open) => !open && onCancel()}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Архівувати задачу</DialogTitle>
                    <DialogDescription>
                        Задача буде позначена як архівна і зникне з основного списку, але
                        залишиться в базі та журналі дій.
                    </DialogDescription>
                </DialogHeader>

                {task && (
                    <div className="mt-4 space-y-2 text-sm">
                        <p className="font-medium">{task.title}</p>
                        {task.description && (
                            <p className="text-muted-foreground text-xs">
                                {task.description}
                            </p>
                        )}
                    </div>
                )}

                <div className="mt-6 flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onCancel}>
                        Скасувати
                    </Button>
                    <Button type="button" variant="destructive" onClick={onConfirm}>
                        Архівувати
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}