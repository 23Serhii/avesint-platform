// src/features/tasks/components/task-details-page.tsx
'use client'

import { useEffect, useState } from 'react'
import type { Task } from '../data/tasks'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

// тип підзадачі з бекенду (спрощений TaskDto)
type SubtaskStatus = 'new' | 'in_progress' | 'done' | string

type Subtask = {
    id: string
    title: string
    status: SubtaskStatus
    description?: string | null
    assigneeCallsign?: string | null
    priority?: string | null
    dueAt?: string | null
}

type TaskDetailsPageProps = {
    task: Task
}

const statusLabel: Record<'new' | 'in_progress' | 'done', string> = {
    new: 'Нова',
    in_progress: 'В роботі',
    done: 'Виконана',
}

export function TaskDetailsPage({ task }: TaskDetailsPageProps) {
    const [subtasks, setSubtasks] = useState<Subtask[]>([])
    const [loadingSubtasks, setLoadingSubtasks] = useState(false)
    const [errorSubtasks, setErrorSubtasks] = useState<string | null>(null)

    const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
    const [newSubtaskNotes, setNewSubtaskNotes] = useState('')
    const [creatingSubtask, setCreatingSubtask] = useState(false)

    const taskId = task.id

    // завантаження підзадач
    const loadSubtasks = async () => {
        try {
            setLoadingSubtasks(true)
            setErrorSubtasks(null)

            const res = await fetch(`/api/tasks/${taskId}/subtasks?page=1&pageSize=50`, {
                credentials: 'include',
            })

            if (!res.ok) {
                throw new Error(`Failed to load subtasks: ${res.status}`)
            }

            const data = (await res.json()) as {
                items: Subtask[]
                page: number
                pageSize: number
                total: number
            }

            setSubtasks(data.items ?? [])
        } catch (e: any) {
            const msg =
                typeof e?.message === 'string'
                    ? e.message
                    : 'Не вдалося завантажити підзадачі'
            setErrorSubtasks(msg)
            toast.error(msg)
        } finally {
            setLoadingSubtasks(false)
        }
    }

    useEffect(() => {
        if (!taskId) return
        void loadSubtasks()
    }, [taskId])

    const addSubtask = async () => {
        const title = newSubtaskTitle.trim()
        if (!title) return

        try {
            setCreatingSubtask(true)

            const res = await fetch(`/api/tasks/${taskId}/subtasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    title,
                    description: newSubtaskNotes.trim() || undefined,
                }),
            })

            if (!res.ok) {
                let msg = `Не вдалося створити підзадачу (${res.status})`

                try {
                    const data = await res.json()
                    if (typeof data?.message === 'string' && data.message.trim().length > 0) {
                        msg = data.message
                    }
                } catch {
                    const text = await res.text()
                    if (text.trim().length > 0) msg = text
                }

                toast.error(msg)
                throw new Error(msg)
            }

            await loadSubtasks()

            setNewSubtaskTitle('')
            setNewSubtaskNotes('')
            toast.success('Підзадачу створено')
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('Error creating subtask', e)
        } finally {
            setCreatingSubtask(false)
        }
    }

    const renderStatusLabel = (status: SubtaskStatus) => {
        if (status === 'new' || status === 'in_progress' || status === 'done') {
            return statusLabel[status]
        }
        return status
    }

    const isSubtask = !!task.parentTaskId

    return (
        <div className="flex flex-col gap-6">
            {/* Заголовок задачі */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {task.title}
                    </h1>

                    <div className="flex flex-wrap gap-2">
                        {isSubtask && (
                            <Badge variant="secondary">
                                Підзадача{' '}
                                {task.parentTaskId && (
                                    <a
                                        href={`/_authenticated/tasks/${task.parentTaskId}`}
                                        className="ml-1 underline underline-offset-2 hover:text-primary"
                                    >
                                        задачі #{task.parentTaskId}
                                    </a>
                                )}
                            </Badge>
                        )}
                    </div>

                    {task.description && (
                        <p className="max-w-2xl text-sm text-muted-foreground">
                            {task.description}
                        </p>
                    )}

                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {task.assigneeCallsign && (
                            <span>
                Виконавець: <strong>«{task.assigneeCallsign}»</strong>
              </span>
                        )}
                        {task.role && <span>Роль: {task.role}</span>}
                        {task.dueAt && (
                            <span>
                Дедлайн{' '}
                                {new Date(task.dueAt).toLocaleString('uk-UA', {
                                    dateStyle: 'short',
                                    timeStyle: 'short',
                                })}
              </span>
                        )}
                    </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                    <Badge variant="outline">
                        Пріоритет: {task.priority.toUpperCase()}
                    </Badge>
                    <Badge>{task.status}</Badge>
                    {task.archived && (
                        <Badge variant="secondary">
                            Архівована
                        </Badge>
                    )}
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[2fr,1.4fr]">
                {/* Ліва колонка: підзадачі */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm uppercase text-muted-foreground">
                                Підзадачі
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Форма створення підзадачі */}
                            <div className="space-y-2 rounded-md border bg-muted/40 p-3">
                                <p className="text-xs text-muted-foreground">
                                    Розбий основну задачу на конкретні кроки для аналітиків /
                                    виконавців.
                                </p>
                                <Input
                                    placeholder="Назва підзадачі..."
                                    value={newSubtaskTitle}
                                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                />
                                <Textarea
                                    rows={2}
                                    placeholder="Деталі, джерела, формат результату (необовʼязково)..."
                                    value={newSubtaskNotes}
                                    onChange={(e) => setNewSubtaskNotes(e.target.value)}
                                />
                                <Button
                                    size="sm"
                                    onClick={addSubtask}
                                    disabled={creatingSubtask || !newSubtaskTitle.trim()}
                                >
                                    {creatingSubtask ? 'Створення…' : 'Додати підзадачу'}
                                </Button>
                            </div>

                            {/* Список підзадач */}
                            <div className="space-y-2">
                                {loadingSubtasks && (
                                    <p className="text-xs text-muted-foreground">
                                        Завантаження підзадач…
                                    </p>
                                )}

                                {errorSubtasks && !loadingSubtasks && (
                                    <p className="text-xs text-red-500">
                                        {errorSubtasks}
                                    </p>
                                )}

                                {!loadingSubtasks &&
                                    !errorSubtasks &&
                                    subtasks.map((st) => (
                                        <div
                                            key={st.id}
                                            className="flex items-start justify-between gap-3 rounded-md border bg-background p-3 text-sm"
                                        >
                                            <div>
                                                <div className="font-medium">{st.title}</div>
                                                {st.description && (
                                                    <div className="text-xs text-muted-foreground">
                                                        {st.description}
                                                    </div>
                                                )}
                                                {st.assigneeCallsign && (
                                                    <div className="mt-1 text-[11px] text-muted-foreground">
                                                        Виконавець: «{st.assigneeCallsign}»
                                                    </div>
                                                )}
                                            </div>
                                            <Badge variant="outline" className="shrink-0 text-[11px]">
                                                {renderStatusLabel(st.status)}
                                            </Badge>
                                        </div>
                                    ))}

                                {!loadingSubtasks &&
                                    !errorSubtasks &&
                                    subtasks.length === 0 && (
                                        <p className="text-xs text-muted-foreground">
                                            Підзадач поки немає. Додай першу вище.
                                        </p>
                                    )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Права колонка: інструменти (плейсхолдери) */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm uppercase text-muted-foreground">
                                Аналітичні інструменти
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm text-muted-foreground">
                            <p>
                                Тут будуть інтегровані модулі: мапа, часові лінії, AI-помічник,
                                граф звʼязків, файли розвідданих.
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">Графік виконання</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-xs text-muted-foreground">
                            <p>
                                Плейсхолдер під міні-таймлайн / Gantt / графік. Сюди можна
                                винести часові привʼязки підзадач.
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">Звʼязки та обʼєкти</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-xs text-muted-foreground">
                            <p>
                                Плейсхолдер під граф обʼєктів: населені пункти, цілі, підрозділи,
                                джерела. Пізніше можна прикрутити graph-візуалізацію.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}