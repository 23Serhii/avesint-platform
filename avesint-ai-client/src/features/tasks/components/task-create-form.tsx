// src/features/tasks/components/task-create-form.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api/client'
import type { TaskDto } from '@/lib/api/tasks'

export type TaskCreateFormValues = {
    title: string
    description?: string
    priority: 'high' | 'medium' | 'low'
    assignee?: string
    dueAt?: string
    targetId?: string
    eventId?: string
}

type TaskCreateFormProps = {
    onCreate: (values: TaskCreateFormValues) => void
    parentTask?: TaskDto | null
    currentUserCallsign?: string
    isAdminOrOfficer?: boolean
    initialTitle?: string
    initialDescription?: string
    // якщо true — ставимо поле позивного першим і фокус на нього
    preferAssigneeFirst?: boolean
    // якщо true — показуємо поле позивного незалежно від ролі
    forceAssigneeInput?: boolean
}

type UserSuggestion = {
    id: string
    callsign: string
    displayName?: string | null
    role?: string | null
}

export function TaskCreateForm({
                                   onCreate,
                                   parentTask,
                                   currentUserCallsign,
                                   isAdminOrOfficer,
                                   initialTitle,
                                   initialDescription,
                                   preferAssigneeFirst,
                                   forceAssigneeInput,
                               }: TaskCreateFormProps) {
    const [title, setTitle] = useState(initialTitle ?? '')
    const [description, setDescription] = useState(initialDescription ?? '')
    const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium')
    const [assignee, setAssignee] = useState('')
    const [dueAt, setDueAt] = useState('')

    const [suggestions, setSuggestions] = useState<UserSuggestion[]>([])
    const [suggestionsOpen, setSuggestionsOpen] = useState(false)
    const [loadingSuggestions, setLoadingSuggestions] = useState(false)

    const assigneeInputRef = useRef<HTMLInputElement | null>(null)

    const isSubtask = !!parentTask
    // поле показуємо або для адмінів/офіцерів, або якщо форсуємо
    const showAssigneeInput = !!isAdminOrOfficer || !!forceAssigneeInput

    useEffect(() => {
        setTitle(initialTitle ?? '')
    }, [initialTitle])

    useEffect(() => {
        setDescription(initialDescription ?? '')
    }, [initialDescription])

    // для не-admin/officer раніше ми автоматично ставили задачу на себе.
    // Тепер, якщо forceAssigneeInput=true, НЕ автозаповнюємо, щоб юзер ввів позивний.
    useEffect(() => {
        if (!isAdminOrOfficer && currentUserCallsign && !forceAssigneeInput) {
            setAssignee(currentUserCallsign)
        }
    }, [isAdminOrOfficer, currentUserCallsign, forceAssigneeInput])

    // фокус на поле позивного, якщо треба вводити його першим
    useEffect(() => {
        if (preferAssigneeFirst && showAssigneeInput && assigneeInputRef.current) {
            assigneeInputRef.current.focus()
        }
    }, [preferAssigneeFirst, showAssigneeInput])

    // Пошук виконавців по позивному
    useEffect(() => {
        if (!showAssigneeInput) return

        const q = assignee.trim()
        if (q.length < 2) {
            setSuggestions([])
            setSuggestionsOpen(false)
            return
        }

        let cancelled = false

        const load = async () => {
            try {
                setLoadingSuggestions(true)
                const res = await api.get<{
                    items: Array<{
                        id: string
                        callsign: string
                        displayName?: string | null
                        role?: string | null
                    }>
                }>('/users', {
                    params: {
                        username: q,
                        status: ['active'],
                    },
                })

                if (cancelled) return

                const items = res.data?.items ?? []
                setSuggestions(
                    items.map((u) => ({
                        id: u.id,
                        callsign: u.callsign,
                        displayName: u.displayName ?? null,
                        role: u.role ?? null,
                    })),
                )
                setSuggestionsOpen(items.length > 0)
            } catch {
                if (!cancelled) {
                    setSuggestions([])
                    setSuggestionsOpen(false)
                }
            } finally {
                if (!cancelled) setLoadingSuggestions(false)
            }
        }

        const timer = setTimeout(load, 250)
        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    }, [assignee, showAssigneeInput])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        const trimmedTitle = title.trim()
        if (!trimmedTitle) return

        onCreate({
            title: trimmedTitle,
            description: description.trim() || undefined,
            priority,
            assignee: assignee.trim() || undefined,
            dueAt: dueAt || undefined,
        })
    }

    const handleSelectSuggestion = (s: UserSuggestion) => {
        setAssignee(s.callsign)
        setSuggestionsOpen(false)
    }

    const assigneeBlock = showAssigneeInput && (
        <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
                Позивний виконавця
            </label>
            <div className="relative">
                <Input
                    ref={assigneeInputRef}
                    placeholder="Почніть вводити позивний (наприклад, FALCON)…"
                    value={assignee}
                    onChange={(e) => {
                        setAssignee(e.target.value)
                    }}
                />

                {suggestionsOpen && (
                    <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover text-sm shadow">
                        {loadingSuggestions && (
                            <div className="px-2 py-1 text-xs text-muted-foreground">
                                Пошук виконавців…
                            </div>
                        )}
                        {!loadingSuggestions &&
                            suggestions.map((s) => (
                                <button
                                    key={s.id}
                                    type="button"
                                    className="flex w-full items-center justify-between px-2 py-1 text-left hover:bg-muted/60"
                                    onClick={() => handleSelectSuggestion(s)}
                                >
                                    <span className="font-medium">{s.callsign}</span>
                                    <span className="ml-2 text-xs text-muted-foreground">
                                        {s.displayName || s.role || ''}
                                    </span>
                                </button>
                            ))}
                        {!loadingSuggestions && suggestions.length === 0 && (
                            <div className="px-2 py-1 text-xs text-muted-foreground">
                                Нічого не знайдено
                            </div>
                        )}
                    </div>
                )}
            </div>
            <p className="text-[11px] text-muted-foreground">
                Вкажіть позивний того, хто буде виконувати цю задачу.
            </p>
        </div>
    )

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {preferAssigneeFirst && assigneeBlock}

            <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                    Назва
                </label>
                <Input
                    placeholder={isSubtask ? 'Назва підзадачі' : 'Назва задачі'}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                />
            </div>

            <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                    Опис
                </label>
                <Textarea
                    rows={4}
                    placeholder="Коротко опишіть, що саме потрібно зробити, важливі деталі, обмеження…"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                        Пріоритет
                    </label>
                    <select
                        className="h-8 w-full rounded border bg-background px-2 text-xs"
                        value={priority}
                        onChange={(e) =>
                            setPriority(e.target.value as 'high' | 'medium' | 'low')
                        }
                    >
                        <option value="high">Високий</option>
                        <option value="medium">Середній</option>
                        <option value="low">Низький</option>
                    </select>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                        Дедлайн (опційно)
                    </label>
                    <Input
                        type="datetime-local"
                        value={dueAt}
                        onChange={(e) => setDueAt(e.target.value)}
                    />
                </div>
            </div>

            {!preferAssigneeFirst && assigneeBlock}

            {!showAssigneeInput && currentUserCallsign && (
                <p className="text-[11px] text-muted-foreground">
                    Задача буде призначена на вас (позивний «{currentUserCallsign}»).
                </p>
            )}

            <div className="flex justify-end pt-2">
                <Button type="submit" size="sm" disabled={!title.trim()}>
                    {isSubtask ? 'Створити підзадачу' : 'Створити задачу'}
                </Button>
            </div>
        </form>
    )
}