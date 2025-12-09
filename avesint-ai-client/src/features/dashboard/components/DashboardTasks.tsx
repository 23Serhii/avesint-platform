'use client'

import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge.tsx'
import { listTasks } from '@/lib/api/tasks'

type DashboardTask = {
    id: string
    title: string
    assigneeCallsign?: string | null
    assigneeRank?: string | null
    assigneeUnit?: string | null
    status: string
}

type Props = {
    onTaskClick?: (taskId: string) => void
}

export function DashboardTasks({ onTaskClick }: Props) {
    const [tasks, setTasks] = useState<DashboardTask[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true)
                setError(null)
                const res = await listTasks({
                    page: 1,
                    pageSize: 4,
                    archived: false,
                })

                setTasks(
                    res.items.map((t: any) => ({
                        id: t.id,
                        title: t.title,
                        assigneeCallsign: t.assigneeCallsign ?? null,
                        assigneeRank: t.assigneeRank ?? null,
                        assigneeUnit: t.assigneeUnit ?? null,
                        status: t.status,
                    })),
                )
            } catch (e) {
                setError('Не вдалося завантажити задачі')
            } finally {
                setLoading(false)
            }
        }

        void load()
    }, [])

    const statusLabel = (status: string) =>
        status === 'new'
            ? 'Нова'
            : status === 'in_progress'
                ? 'В роботі'
                : status === 'done'
                    ? 'Виконана'
                    : status

    return (
        <div className="space-y-4">
            {loading && !tasks.length && (
                <p className="text-xs text-muted-foreground">Завантаження…</p>
            )}

            {error && !loading && (
                <p className="text-xs text-red-500">{error}</p>
            )}

            {!loading &&
                !error &&
                tasks.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => onTaskClick?.(t.id)}
                        className="flex w-full items-center justify-between gap-3 rounded-md border border-transparent px-3 py-2 text-left text-sm transition-colors hover:border-border hover:bg-muted/60"
                    >
                        <div className="min-w-0">
                            <p className="truncate font-medium">{t.title}</p>
                            <p className="text-xs text-muted-foreground">
                                Виконавець: {t.assigneeCallsign ?? '—'}
                                {t.assigneeRank && ` · ${t.assigneeRank}`}
                                {t.assigneeUnit && ` · ${t.assigneeUnit}`}
                            </p>
                        </div>
                        <Badge variant="secondary" className="shrink-0 text-[11px]">
                            {statusLabel(t.status)}
                        </Badge>
                    </button>
                ))}

            {!loading && !error && tasks.length === 0 && (
                <p className="text-xs text-muted-foreground">
                    Немає задач для відображення.
                </p>
            )}
        </div>
    )
}