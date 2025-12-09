// avesint-ai-client/src/features/tasks/components/data-table-row-actions.tsx
import { useState } from 'react'
import type { Row } from '@tanstack/react-table'

import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

import type { Task } from '../data/tasks'
import { deleteTask } from '@/lib/api/tasks'

type DataTableRowActionsProps = {
    row: Row<Task>
    onOpenTask?: (task: Task) => void
    onAfterArchive?: () => void
}

export function DataTableRowActions({
                                        row,
                                        onOpenTask,
                                        onAfterArchive,
                                    }: DataTableRowActionsProps) {
    const task = row.original
    const [loading, setLoading] = useState(false)

    const handleOpen = () => {
        onOpenTask?.(task)
    }

    const handleArchive = async () => {
        if (task.archived) {
            // зайвий клік по вже архівній задачі — просто ігноруємо на фронті
            return
        }

        try {
            setLoading(true)
            await deleteTask(task.id)
            toast.success(`Задачу "${task.title}" архівовано`)
            onAfterArchive?.()
        } catch (error: unknown) {
            // бекенд уже має перевірку "Task is already archived"
            toast.error('Не вдалося архівувати задачу')
            // можна додати більш детальну обробку error, якщо треба
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex items-center justify-end gap-2">
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleOpen}
            >
                Відкрити
            </Button>

            {/* Кнопку архівації показуємо тільки для неархівних задач */}
            {!task.archived && (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleArchive}
                    disabled={loading}
                >
                    Архівувати
                </Button>
            )}
        </div>
    )
}