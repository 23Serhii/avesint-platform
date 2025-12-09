// avesint-ai-client/src/features/targets/components/data-table-row-actions.tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { MoreHorizontal } from 'lucide-react'

import type { TargetObject } from '@/features/targets/data/schema'
import { deleteTarget } from '@/lib/api/targets'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

type Props = {
    target: TargetObject
    mode: 'active' | 'archived'
    onOpen?: (target: TargetObject) => void
    onArchived?: (targetId: string) => void
    onCreateTask?: (target: TargetObject) => void
}

export function TargetRowActions({
                                     target,
                                     mode,
                                     onOpen,
                                     onArchived,
                                     onCreateTask,
                                 }: Props) {
    const [loading, setLoading] = useState(false)

    const handleArchive = async () => {
        if (mode === 'archived') return

        try {
            setLoading(true)
            await deleteTarget(target.id)
            toast.success(`Ціль "${target.title}" архівовано`)
            onArchived?.(target.id)
        } catch (error) {
            toast.error('Не вдалося архівувати ціль')
        } finally {
            setLoading(false)
        }
    }

    const handleCreateTask = () => {
        onCreateTask?.(target)
    }

    return (
        <div className="flex items-center justify-end gap-2">
            <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => onOpen?.(target)}
                title="Відкрити деталі"
            >
                <span className="sr-only">Відкрити</span>
                <MoreHorizontal className="h-4 w-4 rotate-90" />
            </Button>

            {mode === 'active' && !target.archived && (
                <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                        <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                        >
                            <span className="sr-only">Дії</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content
                        align="end"
                        className="z-20 min-w-[180px] rounded-md border bg-popover p-1 text-sm shadow"
                    >
                        <DropdownMenu.Item
                            className="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 outline-none hover:bg-muted"
                            onSelect={handleCreateTask}
                        >
                            <span>Створити задачу</span>
                        </DropdownMenu.Item>

                        <DropdownMenu.Separator className="my-1 h-px bg-border" />

                        <DropdownMenu.Item
                            className="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-red-600 outline-none hover:bg-red-50 dark:hover:bg-red-950/40"
                            onSelect={handleArchive}
                            disabled={loading}
                        >
                            <span>Архівувати ціль</span>
                        </DropdownMenu.Item>
                    </DropdownMenu.Content>
                </DropdownMenu.Root>
            )}
        </div>
    )
}